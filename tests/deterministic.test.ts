import { describe, expect, it } from "vitest";
import { selectRules } from "@/lib/compliance/applicable";
import { runDeterministic } from "@/lib/compliance/deterministic";
import type { AssetContext, ProductFacts, RuleConfig, RuleDef } from "@/lib/compliance/types";

function rule(code: string, config: RuleConfig, over: Partial<RuleDef> = {}): RuleDef {
  return {
    code,
    title: code,
    description: "",
    category: "Test",
    severity: "medium",
    kind: config.type === "none" ? "ai" : config.type,
    products: [],
    channels: [],
    checkInstruction: "",
    config,
    citation: "n/a",
    guidance: "",
    enabled: true,
    ...over,
  };
}

function ctx(content: string, over: Partial<AssetContext> = {}): AssetContext {
  return { product: "personal_loan", channel: "email", states: [], content, isAffiliate: false, ...over };
}

const loanFacts: ProductFacts = {
  product: "personal_loan",
  facts: {
    displayName: "ClearPath Personal Loan",
    aprMin: 8.99,
    aprMax: 29.99,
    amountMin: 2000,
    amountMax: 50000,
    termMonthsMin: 24,
    termMonthsMax: 60,
    notes: [],
  },
  approvedSnippets: [],
};
const cardFacts: ProductFacts = {
  product: "credit_card",
  facts: { displayName: "ClearPath Card", aprMin: 19.99, aprMax: 29.99, introAprPercent: 0, introMonths: 15, notes: [] },
  approvedSnippets: [],
};

const guarantee = rule("UDAAP-GUARANTEE", {
  type: "phrase",
  patterns: ["guaranteed\\s+approval", "no credit check", "everyone qualifies"],
  issue: "Absolute approval claim.",
  suggestion: "Say 'subject to credit approval'.",
});
const apr = rule("NUM-APR", { type: "numeric", check: "apr_below_floor", issue: "Rate not offered." });
const amt = rule("NUM-AMT", { type: "numeric", check: "amount_above_max", issue: "Amount not offered" });
const term = rule("NUM-TERM", { type: "numeric", check: "term_above_max", issue: "Term not offered." });
const intro = rule("NUM-INTRO", { type: "numeric", check: "intro_period_exceeds", issue: "Intro period too long." });

const fixtureRules: RuleDef[] = [
  guarantee,
  apr,
  amt,
  term,
  intro,
  rule("REQ-NMLS", { type: "required", satisfiedBy: ["NMLS\\s*(?:ID|#)?\\s*:?\\s*\\d+"], issue: "Missing NMLS." }),
  rule("REQ-TRIG", {
    type: "required",
    triggers: ["\\$\\d+\\s*/\\s*month", "up to \\d+ months"],
    satisfiedBy: ["\\bAPR\\b"],
    issue: "Triggering term without APR.",
  }),
  rule("REQ-CA", { type: "required", statesAny: ["CA"], satisfiedBy: ["California Financing Law"], issue: "CA license." }),
  rule("REQ-AD", { type: "required", affiliateOnly: true, satisfiedBy: ["#ad", "sponsored"], issue: "Disclose." }),
];

const quotesOk = (content: string, findings: { quote: string }[]) =>
  findings.every((f) => f.quote.length > 0 && content.includes(f.quote));

describe("selectRules", () => {
  const all = [
    rule("ALL", { type: "none" }),
    rule("LOAN", { type: "none" }, { products: ["personal_loan"] }),
    rule("CARD", { type: "none" }, { products: ["credit_card"] }),
    rule("SMS", { type: "none" }, { channels: ["sms"] }),
    rule("EMAIL_LOAN", { type: "none" }, { products: ["personal_loan"], channels: ["email", "social"] }),
    rule("OFF", { type: "none" }, { enabled: false }),
  ];
  it("filters by product, channel and enabled", () => {
    const codes = selectRules(ctx("x"), all).map((r) => r.code);
    expect(codes).toEqual(["ALL", "LOAN", "EMAIL_LOAN"]);
    expect(selectRules(ctx("x", { product: "credit_card", channel: "sms" }), all).map((r) => r.code)).toEqual([
      "ALL",
      "CARD",
      "SMS",
    ]);
  });
  it("deterministic runner ignores out-of-scope and disabled rules", () => {
    const text = "Guaranteed approval!";
    const rules = [
      { ...guarantee, code: "A", products: ["credit_card" as const] },
      { ...guarantee, code: "B", channels: ["sms" as const] },
      { ...guarantee, code: "C", enabled: false },
      { ...guarantee, code: "D" },
    ];
    expect(runDeterministic(ctx(text), rules, loanFacts).map((f) => f.ruleCode)).toEqual(["D"]);
  });
});

describe("phrase rules", () => {
  it("quotes the verbatim match with rule fields", () => {
    const text = "Apply today. GUARANTEED   Approval for all.";
    const [f] = runDeterministic(ctx(text), [guarantee], loanFacts);
    expect(f).toMatchObject({
      source: "rule",
      ruleCode: "UDAAP-GUARANTEE",
      severity: "medium",
      quote: "GUARANTEED   Approval",
      issue: "Absolute approval claim.",
      suggestion: "Say 'subject to credit approval'.",
    });
  });
  it("dedupes identical quotes and caps at 5 distinct", () => {
    const dup = "no credit check. no credit check. no credit check.";
    expect(runDeterministic(ctx(dup), [guarantee], loanFacts)).toHaveLength(1);
    const many = rule("MANY", { type: "phrase", patterns: ["offer\\d"], issue: "x" });
    const text = Array.from({ length: 9 }, (_, i) => `offer${i}`).join(" ");
    const out = runDeterministic(ctx(text), [many], loanFacts);
    expect(out.map((f) => f.quote)).toEqual(["offer0", "offer1", "offer2", "offer3", "offer4"]);
  });
  it("widens a mid-word match to whole words", () => {
    const r = rule("W", { type: "phrase", patterns: ["approv"], issue: "x" });
    const text = "Get preapproved instantly. Unapprovable? No.";
    const out = runDeterministic(ctx(text), [r], loanFacts);
    expect(out.map((f) => f.quote)).toEqual(["preapproved", "Unapprovable"]);
  });
  it("keeps non-ASCII quotes intact", () => {
    const r = rule("U", { type: "phrase", patterns: ["café"], issue: "x" });
    const text = "Visit our café today";
    expect(runDeterministic(ctx(text), [r], loanFacts)[0].quote).toBe("café");
  });
});

describe("required rules", () => {
  const nmls = fixtureRules.find((r) => r.code === "REQ-NMLS")!;
  const trig = fixtureRules.find((r) => r.code === "REQ-TRIG")!;
  const ca = fixtureRules.find((r) => r.code === "REQ-CA")!;
  const ad = fixtureRules.find((r) => r.code === "REQ-AD")!;

  it("without triggers: quote is the first ~80 chars trimmed to a word boundary", () => {
    const text = "  " + "word ".repeat(40);
    const [f] = runDeterministic(ctx(text), [nmls], loanFacts);
    expect(f.ruleCode).toBe("REQ-NMLS");
    expect(f.quote.length).toBeLessThanOrEqual(80);
    expect(f.quote.length).toBeGreaterThan(60);
    expect(f.quote.endsWith("word")).toBe(true);
    expect(text.includes(f.quote)).toBe(true);
  });
  it("without triggers: satisfied by any pattern", () => {
    expect(runDeterministic(ctx("Lender. NMLS ID: 123456"), [nmls], loanFacts)).toHaveLength(0);
  });
  it("blank content yields no finding", () => {
    expect(runDeterministic(ctx("   \n"), [nmls], loanFacts)).toHaveLength(0);
  });
  it("with triggers: no trigger, no finding", () => {
    expect(runDeterministic(ctx("A great loan for you."), [trig], loanFacts)).toHaveLength(0);
  });
  it("with triggers: fires on the first trigger when unsatisfied", () => {
    const text = "Borrow up to 60 months. Or pay $199/month.";
    const out = runDeterministic(ctx(text), [trig], loanFacts);
    expect(out).toHaveLength(1);
    expect(out[0].quote).toBe("up to 60 months");
  });
  it("with triggers: satisfied anywhere in content", () => {
    const text = "Pay $199/month. See rates at the bottom. 9.99% APR.";
    expect(runDeterministic(ctx(text), [trig], loanFacts)).toHaveLength(0);
  });
  it("statesAny: explicit states", () => {
    const text = "Fast cash.";
    expect(runDeterministic(ctx(text, { states: ["TX"] }), [ca], loanFacts)).toHaveLength(0);
    expect(runDeterministic(ctx(text, { states: ["TX", "ca"] }), [ca], loanFacts)).toHaveLength(1);
  });
  it("statesAny: nationwide asset only triggers when the copy names the state", () => {
    expect(runDeterministic(ctx("Fast cash for everyone."), [ca], loanFacts)).toHaveLength(0);
    expect(runDeterministic(ctx("Fast cash for California residents."), [ca], loanFacts)).toHaveLength(1);
    expect(runDeterministic(ctx("Available in CA and NV."), [ca], loanFacts)).toHaveLength(1);
    expect(runDeterministic(ctx("Cash in, cash out. Mocha, ca-ching."), [ca], loanFacts)).toHaveLength(0);
    expect(runDeterministic(ctx("Available in CA. California Financing Law license 123."), [ca], loanFacts)).toHaveLength(0);
  });
  it("statesAny: a postal address in the footer is not a targeting claim", () => {
    const footer = "ClearPath Financial, 400 Market Street, San Francisco, CA 94111";
    expect(runDeterministic(ctx(`Fast cash for everyone. ${footer}`), [ca], loanFacts)).toHaveLength(0);
    expect(runDeterministic(ctx(`Fast cash in CA. ${footer}`), [ca], loanFacts)).toHaveLength(1);
  });
  it("affiliateOnly: skipped for in-house submissions", () => {
    expect(runDeterministic(ctx("Check out this loan"), [ad], loanFacts)).toHaveLength(0);
    expect(runDeterministic(ctx("Check out this loan", { isAffiliate: true }), [ad], loanFacts)).toHaveLength(1);
    expect(runDeterministic(ctx("Check out this loan #ad", { isAffiliate: true }), [ad], loanFacts)).toHaveLength(0);
  });
});

describe("numeric: apr_below_floor", () => {
  const run = (text: string, over: Partial<AssetContext> = {}, facts = loanFacts) =>
    runDeterministic(ctx(text, over), [apr], facts);

  it("flags 'rates from 4.99% APR' on a personal loan with the numbers in the issue", () => {
    const text = "Personal loans with rates from 4.99% APR. Apply now.";
    const out = run(text);
    expect(out).toHaveLength(1);
    expect(out[0].quote).toBe("rates from 4.99% APR");
    expect(out[0].issue).toBe(
      "Rate not offered. Advertised 4.99% is below the lowest APR ClearPath offers (8.99%).",
    );
  });
  it("flags 'as low as' rate claims and bare APR mentions", () => {
    expect(run("Rates as low as 3.5%!")).toHaveLength(1);
    expect(run("Get 2.9% APR today")).toHaveLength(1);
    expect(run("APR: 5.25% for qualified borrowers")).toHaveLength(1);
  });
  it("does not flag rates at or above the floor", () => {
    expect(run("Rates from 8.99% APR. Up to 29.99% APR.")).toHaveLength(0);
  });
  it("ignores small percentages that are not rates", () => {
    expect(run("Earn 2% cash back. 1% origination fee. 0% down. Save 5% off. 100% online. APR 12.99%")).toHaveLength(0);
  });
  it("allows a labelled intro APR on a credit card", () => {
    const text = "Get 0% intro APR for 15 months on purchases, then 21.99% variable APR.";
    expect(run(text, { product: "credit_card" }, cardFacts)).toHaveLength(0);
    expect(run("0% APR for 15 months on purchases", { product: "credit_card" }, cardFacts)).toHaveLength(0);
  });
  it("flags an unlabelled 0% APR on a credit card", () => {
    const out = run("Enjoy 0% APR!", { product: "credit_card" }, cardFacts);
    expect(out).toHaveLength(1);
    expect(out[0].issue).toContain("Advertised 0% is below the lowest APR ClearPath offers (19.99%).");
  });
  it("flags a below-floor rate that follows an intro offer ('then')", () => {
    const text = "0% intro APR for 15 months, then 4.99% APR.";
    const out = run(text, { product: "credit_card" }, cardFacts);
    expect(out.map((f) => f.quote)).toEqual(["4.99% APR"]);
  });
  it("does not excuse 'intro' on products with no intro offer", () => {
    expect(run("0% intro APR for 15 months")).toHaveLength(1);
  });
  it("no aprMin means no check", () => {
    const f: ProductFacts = { ...loanFacts, facts: { displayName: "x", notes: [] } };
    expect(run("Rates from 1% APR", {}, f)).toHaveLength(0);
  });
});

describe("numeric: amount_above_max", () => {
  const run = (text: string) => runDeterministic(ctx(text), [amt], loanFacts);
  it("flags k suffix, comma and plain forms", () => {
    const a = run("Borrow up to $75k for anything.");
    expect(a).toHaveLength(1);
    expect(a[0].quote).toBe("Borrow up to $75k");
    expect(a[0].issue).toBe("Amount not offered. Advertised $75,000 exceeds the largest amount ClearPath offers ($50,000).");
    expect(run("Loans of $100,000 available")).toHaveLength(1);
    expect(run("Get $60000 in funds")).toHaveLength(1);
    expect(run("Borrow $1.5 million")).toHaveLength(1);
  });
  it("accepts amounts within the maximum and ignores payment-style amounts", () => {
    expect(run("Borrow $2,000 to $50,000.")).toHaveLength(0);
    expect(run("Loan payments from $1,200/month")).toHaveLength(0);
  });
});

describe("numeric: term_above_max", () => {
  const run = (text: string) => runDeterministic(ctx(text), [term], loanFacts);
  it("flags months and years beyond the max", () => {
    const m = run("Flexible repayment terms up to 84 months.");
    expect(m).toHaveLength(1);
    expect(m[0].quote).toBe("terms up to 84 months");
    expect(m[0].issue).toBe("Term not offered. Advertised 84 months exceeds the longest term ClearPath offers (60 months).");
    const y = run("Loan terms up to 7 years");
    expect(y).toHaveLength(1);
    expect(y[0].issue).toContain("7 years (84 months)");
  });
  it("accepts terms within the max, and ignores unrelated durations", () => {
    expect(run("Loan terms up to 60 months or 5 years")).toHaveLength(0);
    expect(run("Loan servicing by experts with 20 years of experience")).toHaveLength(0);
  });
});

describe("numeric: intro_period_exceeds", () => {
  const run = (text: string) => runDeterministic(ctx(text, { product: "credit_card" }), [intro], cardFacts);
  it("flags a promotional period longer than introMonths", () => {
    const out = run("0% intro APR for 18 months on purchases.");
    expect(out).toHaveLength(1);
    expect(out[0].issue).toBe(
      "Intro period too long. Advertised promotional period of 18 months exceeds the 15 months ClearPath offers.",
    );
    expect(run("No interest for 2 years")[0].issue).toContain("2 years (24 months)");
  });
  it("accepts a period within the offer and ignores non-promotional durations", () => {
    expect(run("0% intro APR for 15 months")).toHaveLength(0);
    expect(run("0% intro APR for 12 months, then 21.99% variable APR. Account open 36 months.")).toHaveLength(0);
  });
  it("is off when the product has no intro offer", () => {
    expect(runDeterministic(ctx("0% intro for 36 months"), [intro], loanFacts)).toHaveLength(0);
  });
});

describe("invariants", () => {
  it("quote is always an exact substring, with deterministic order by position then ruleCode", () => {
    const text =
      "Guaranteed approval! Loans up to $75k, terms up to 84 months, rates from 4.99% APR. " +
      "Pay $199/month. Available in CA. No credit check. Guaranteed approval!";
    const out = runDeterministic(ctx(text, { isAffiliate: true }), fixtureRules, loanFacts);
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(quotesOk(text, out)).toBe(true);
    const pos = out.map((f) => text.indexOf(f.quote));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    expect(runDeterministic(ctx(text, { isAffiliate: true }), [...fixtureRules].reverse(), loanFacts)).toEqual(out);
    // equal positions are ordered by ruleCode
    const tie = [rule("B", { type: "phrase", patterns: ["hello"], issue: "x" }), rule("A", { type: "phrase", patterns: ["hello"], issue: "x" })];
    expect(runDeterministic(ctx("hello"), tie, loanFacts).map((f) => f.ruleCode)).toEqual(["A", "B"]);
  });
  it("tolerates invalid regexes without throwing", () => {
    const rules = [
      rule("BAD1", { type: "phrase", patterns: ["(", "[a-", "no credit check"], issue: "x" }),
      rule("BAD2", { type: "required", triggers: ["(("], satisfiedBy: ["x"], issue: "x" }),
      rule("BAD3", { type: "required", satisfiedBy: ["(", "\\"], issue: "x" }),
      rule("BAD4", { type: "none" }),
    ];
    const out = runDeterministic(ctx("No credit check at all"), rules, loanFacts);
    expect(out.map((f) => f.ruleCode).sort()).toEqual(["BAD1", "BAD3"]);
  });
  it("runs a 20k-character adversarial input through every fixture rule in under 200 ms", () => {
    const inputs = [
      "a".repeat(20000),
      " ".repeat(20000),
      "1% APR rate ".repeat(1700),
      "$9,9,9,9 up to 99 months ".repeat(800),
      "0% intro for 99 months ".repeat(900),
      "%".repeat(10000) + "$".repeat(10000),
      "guaranteed " + " ".repeat(19980) + "approval",
    ];
    for (const content of inputs) {
      const t0 = performance.now();
      const out = runDeterministic(ctx(content.slice(0, 20000), { isAffiliate: true, product: "credit_card" }), fixtureRules, cardFacts);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(200);
      expect(quotesOk(content, out)).toBe(true);
    }
  });
});

describe("regression: fee percentages are not APR claims", () => {
  const aprRule = { ...rule("REGZ-24-AVAIL", { type: "numeric", check: "apr_below_floor", issue: "Below floor." }) };
  const run = (text: string) => runDeterministic(ctx(text), [aprRule], loanFacts);

  it("does not read a fee range followed by 'included in the APR' as an APR (QA report)", () => {
    expect(run("APRs from 8.99% to 35.99% APR. An origination fee of 0% to 8% may apply and is included in the APR.")).toHaveLength(0);
    expect(run("An origination fee of 0% to 8% may apply and is included in the APR.")).toHaveLength(0);
  });
  it("ignores other non-rate subjects even when APR or rate words are nearby", () => {
    expect(run("Earn 1.5% cash back, and the APR is 8.99% to 35.99%.")).toHaveLength(0);
    expect(run("A 3% balance transfer fee applies; see the APR for details.")).toHaveLength(0);
    expect(run("Put 5% down payment toward a loan with a competitive rate.")).toHaveLength(0);
  });
  it("still flags real rate claims, including after a fee in the same sentence", () => {
    expect(run("Rates from 4.99% APR.")).toHaveLength(1);
    expect(run("A 5% fee applies and rates start from 4.99% APR.")).toHaveLength(1);
    expect(run("APRs as low as 5.25%.")).toHaveLength(1);
  });
});
