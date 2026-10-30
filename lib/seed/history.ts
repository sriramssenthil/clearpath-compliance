/**
 * Seeded review history for the demo: ~40 submissions over the previous 8 weeks, with versions,
 * findings, decisions and audit events, so the queue, dashboard and partner scorecards are populated.
 *
 * Everything is fictional. `buildHistoryPlan` is pure and deterministic: all randomness comes from a
 * seeded PRNG and all timestamps are expressed relative to the `now` argument. Findings come from the
 * real engine in rules-only mode (so quotes and offsets are genuine); a handful of hand-written "ai" and
 * reviewer findings stand in for model output.
 */
import { createHash } from "node:crypto";
import type { Channel, Product, Severity } from "../compliance/types";
import { selectAiRules } from "../compliance/applicable";
import { analyzeAsset } from "../compliance/engine";
import { computeRisk } from "../compliance/risk";
import { AUDIT, type AuditAction } from "../workflow/audit-actions";
import { computeDueAt, type Status } from "../workflow/flow";
import { PARTNERS, PARTNER_PROFILE, USERS } from "./people";
import { PRODUCT_FACTS } from "./product-facts";
import { RULES } from "./rules";
// ------------------------------------------------------------------ seed content

interface Live {
  ideal: number;
  min: number;
  max: number;
}

interface AiSpec {
  rule: string;
  sev: Severity;
  conf: "low" | "medium" | "high";
  quote: string;
  issue: string;
  sugg: string;
}

interface VSpec {
  content: string;
  /** Hand-written stand-ins for model findings. */
  ai?: AiSpec[];
  /** Findings the reviewer adds by hand while reviewing this version. */
  add?: AiSpec[];
  /** Reviewer note on this version's decision. */
  note?: string;
  /** Reasons for dismissing specific rules' findings on this version. */
  dismiss?: Record<string, string>;
  /** Place this (re)submission at a fixed distance before now instead of deriving it. */
  live?: Live;
}

interface Spec {
  key: string;
  title: string;
  product: Product;
  channel: Channel;
  states?: string[];
  /** Submitter's name from lib/seed/people.ts. */
  by: string;
  start: { biz?: number; live?: Live };
  final: Status;
  /** One reviewer letter per reviewed version: P = Priya Raman, D = Daniel Okafor. */
  rv: string;
  pri?: string;
  notes?: string;
  launch?: number | null;
  wdAfterCr?: boolean;
  wdReason?: string;
  v: VSpec[];
}

const snip = (product: Product, id: string): string => {
  const s = PRODUCT_FACTS.find((p) => p.product === product)?.approvedSnippets.find((x) => x.id === id);
  if (!s) throw new Error(`Missing approved snippet ${product}/${id}`);
  return s.text;
};
const PL = (id: string) => snip("personal_loan", id);
const CC = (id: string) => snip("credit_card", id);
const MT = (id: string) => snip("mortgage_prequal", id);

const FOOTER = PL("can_spam_footer");
const SMS_OPT = PL("sms_optout");
const AFF_DISC = PL("affiliate_disclosure");
const AFF_TAG = PL("affiliate_hashtag");

const ai = (rule: string, sev: Severity, conf: AiSpec["conf"], quote: string, issue: string, sugg: string): AiSpec => ({
  rule,
  sev,
  conf,
  quote,
  issue,
  sugg,
});

const SPECS: Spec[] = [
  // ---------------------------------------------------------------- in-house marketing (Maya Chen)
  {
    key: "m1",
    title: "October debt consolidation newsletter feature",
    product: "personal_loan",
    channel: "email",
    by: "Maya Chen",
    start: { biz: 40 },
    final: "approved",
    rv: "D",
    notes: "Goes to the 'carrying card balances' segment on Thursday.",
    v: [
      {
        content: `Subject: Simplify your monthly payments with one loan

Hi there,

If keeping track of several card due dates feels like a second job, a ClearPath Personal Loan can fold them into one fixed monthly payment. Borrow $2,000 to $50,000 with terms of 24 to 60 months.

${PL("apr_disclosure")}

${PL("representative_example")}

${PL("soft_pull_notice")}

See your options: https://clearpath.example/loans

${FOOTER}`,
      },
    ],
  },
  {
    key: "m2",
    title: "Cash Rewards Card autumn display set A",
    product: "credit_card",
    channel: "display",
    by: "Maya Chen",
    start: { biz: 33 },
    final: "approved",
    rv: "P",
    pri: "Media buy closes Friday; creative has to be uploaded to the exchange by Thursday noon.",
    v: [
      {
        content: `Earn 1.5% cash back on every eligible purchase.

${CC("intro_apr_disclosure")} ${CC("fee_disclosure")}

${CC("soft_pull_notice")}`,
        note: "Clean, and the disclosures sit right under the headline. Approved for the buy.",
      },
    ],
  },
  {
    key: "m3",
    title: "First-time buyer prequalification email, California",
    product: "mortgage_prequal",
    channel: "email",
    states: ["CA"],
    by: "Maya Chen",
    start: { biz: 26 },
    final: "approved",
    rv: "P",
    notes: "California-only send, roughly 40k contacts.",
    v: [
      {
        content: `Subject: Thinking about buying? See what you may prequalify for

Hi there,

Buying a home is a big step, and knowing your budget makes every other decision easier. ClearPath Home Lending can show you what you may prequalify for before you start touring.

What to expect:
- Answer a few questions about your income, savings and the home you have in mind.
- Review your prequalification estimate in about ten minutes.
- Talk with a licensed loan officer about next steps whenever you are ready.

${MT("soft_pull_notice")}

${MT("representative_example")}

${MT("apr_disclosure")}

${MT("prequal_disclaimer")}

Start your prequalification: https://clearpath.example/home/start

${MT("nmls_ehl")}
${MT("ca_license")}

${FOOTER}`,
        note: "Textbook disclosures. Use this as the template for future California mortgage sends.",
      },
    ],
  },
  {
    key: "m4",
    title: "Cash Rewards Card welcome offer, email 1",
    product: "credit_card",
    channel: "email",
    by: "Maya Chen",
    start: { biz: 22 },
    final: "approved",
    rv: "PP",
    notes: "Replaces the old welcome series opener.",
    v: [
      {
        content: `Subject: You're pre-approved: 0% interest for 15 months

Hi there,

Good news: you're pre-approved for the ClearPath Cash Rewards Card. Enjoy 0% interest for 15 months on everything you buy, plus 1.5% cash back on every purchase and no annual fee.

Why people love it:
- Pay no interest for 15 months
- Earn 1.5% cash back with no categories to track
- Keep more of what you earn with a $0 annual fee

Claim your card today: https://clearpath.example/card

ClearPath Financial, Inc., 100 Market Street, Suite 200, Austin, TX 78701. Unsubscribe at any time.`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "Enjoy 0% interest for 15 months on everything you buy",
            "The promotional rate is not called an introductory APR, does not say it applies to purchases from account opening, and the go-to APR is not stated anywhere near the first mention.",
            "Use the approved intro APR disclosure: '0% intro APR on purchases for 15 months from account opening. After that, a variable APR of 20.24% to 29.99% applies.'",
          ),
        ],
        note: "Replace the pre-approved and 'no interest' wording with prequalify and intro APR language, and put the go-to variable APR and fee disclosure next to the first 0% mention. All three are in the snippet library.",
      },
      {
        content: `Subject: Your ClearPath Cash Rewards Card offer: 0% intro APR for 15 months

Hi there,

You may prequalify for the ClearPath Cash Rewards Card. Check in minutes with no impact to your credit score.

Why people love it:
- ${CC("intro_apr_disclosure")}
- Earn 1.5% cash back on eligible purchases with no categories to track
- $0 annual fee

${CC("fee_disclosure")}

See if you prequalify: https://clearpath.example/card

${CC("soft_pull_notice")}

${FOOTER}`,
        note: "Good turnaround. Intro APR, go-to APR and fees are all next to the first mention now.",
      },
    ],
  },
  {
    key: "m5",
    title: "Fraud-awareness tip, loan scam post",
    product: "personal_loan",
    channel: "social",
    by: "Maya Chen",
    start: { biz: 19 },
    final: "approved",
    rv: "D",
    v: [
      {
        content: `Scam alert: if a lender promises guaranteed approval before looking at your credit, walk away. Real lenders review every application.

Checking your rate with ClearPath uses a soft inquiry that will not affect your credit score. Approval and terms depend on your credit and other factors.

Learn how to spot lending scams: https://clearpath.example/security`,
        dismiss: {
          "UDAAP-GUARANTEE": "Quoted in a consumer warning, not a claim. The post tells readers to walk away from lenders that promise approval.",
        },
        note: "Warning copy only, so the guarantee flag is a false positive. Approved.",
      },
    ],
  },
  {
    key: "m6",
    title: "Rate check reminder text",
    product: "personal_loan",
    channel: "sms",
    by: "Maya Chen",
    start: { biz: 18 },
    final: "approved",
    rv: "P",
    v: [
      {
        content: `Hi Sam, your ClearPath rate check is ready to finish. Checking uses a soft credit pull that will not affect your credit score. Rates from 8.99% to 35.99% APR; your rate depends on your credit. https://clearpath.example/r/h7n2 Terms apply. ${SMS_OPT}`,
      },
    ],
  },
  {
    key: "m7",
    title: "Cash Rewards Card activation text",
    product: "credit_card",
    channel: "sms",
    by: "Maya Chen",
    start: { biz: 3 },
    final: "changes_requested",
    rv: "P",
    v: [
      {
        content: `You're pre-approved for the ClearPath Cash Rewards Card! 0% APR and no annual fee. Activate your offer: https://clearpath.example/c/a81q`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "0% APR",
            "The 0% rate is not called an introductory APR, no end point is given and the go-to APR is missing.",
            "Say '0% intro APR on purchases for 15 months' and include the go-to variable APR of 20.24% to 29.99%.",
          ),
        ],
        dismiss: { "REGZ-24-AVAIL": "0% is the card's introductory APR, not a standard rate; the missing intro wording is covered by the REGZ-16-INTRO finding." },
        note: "Remove 'pre-approved', add the intro APR terms and fee disclosure or drop the 0% claim, and add the STOP opt-out line. Texts have to carry all of it in the message itself.",
      },
    ],
  },
  {
    key: "m8",
    title: "Debt consolidation display, 300x250",
    product: "personal_loan",
    channel: "display",
    by: "Maya Chen",
    start: { live: { ideal: 20, min: 3, max: 55 } },
    final: "submitted",
    rv: "",
    v: [
      {
        content: `Pay off high-interest cards faster.

Consolidate with a ClearPath Personal Loan: $5,000 to $50,000, terms up to 60 months, and rates as low as 8.99% APR.

Check your rate in minutes. It will not affect your credit score.`,
        ai: [
          ai(
            "UDAAP-APR",
            "medium",
            "medium",
            "rates as low as 8.99% APR",
            "The best-case APR is the only rate shown, which can read as the typical rate. The full 8.99% to 35.99% range is not shown.",
            "Show the full range: 'Rates from 8.99% to 35.99% APR. Your actual APR depends on your credit, loan amount and term.'",
          ),
        ],
      },
    ],
  },
  {
    key: "m9",
    title: "Spring homebuyer rate-watch email",
    product: "mortgage_prequal",
    channel: "email",
    by: "Maya Chen",
    start: { biz: 1 },
    final: "in_review",
    rv: "P",
    notes: "Wants to go out Friday with the spring promotion.",
    v: [
      {
        content: `Subject: Lock in your dream home with the lowest rates

Hi there,

Home prices are rising and rates move every day. Get pre-approved with ClearPath Home Lending and shop with confidence.

Our 30-year fixed-rate loans start at 5.25% and come with payments as low as $1,650 a month. Close in as little as 21 days.

Get pre-approved today: https://clearpath.example/home/start

ClearPath Home Lending, NMLS ID 1234567. Equal Housing Lender.

${FOOTER}`,
        ai: [
          ai(
            "UDAAP-APR",
            "medium",
            "medium",
            "Close in as little as 21 days",
            "A closing-speed claim with no substantiation or conditions. Closing time depends on appraisal, verification and the borrower's file.",
            "Remove the timing claim, or state typical timelines with the conditions that apply.",
          ),
        ],
      },
    ],
  },
  {
    key: "m10",
    title: "Everyday cash back social post",
    product: "credit_card",
    channel: "social",
    by: "Maya Chen",
    start: { biz: 14 },
    final: "withdrawn",
    rv: "",
    wdReason: "Campaign deferred to next quarter; will resubmit with new creative.",
    v: [
      {
        content: `Cash back that keeps up with your spending. 1.5% on every purchase, $0 annual fee. Learn more at clearpath.example/card #ClearPathCard`,
      },
    ],
  },

  // ---------------------------------------------------------------- RateRover (bad record)
  {
    key: "r1",
    title: "Best loans for bad credit, October update",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Jordan Ellis",
    start: { biz: 39 },
    final: "rejected",
    rv: "P",
    v: [
      {
        content: `Best Loans for Bad Credit (Updated October)

Struggling with a low credit score? Skip the bank. RateRover compared 14 online lenders and ClearPath Personal Loans came out on top.

What you get with ClearPath:
- Guaranteed approval for bad credit borrowers. No credit check, ever.
- Rates as low as 4.5% APR, the lowest rates in the industry.
- Borrow up to $75,000 with terms up to 84 months.
- Payments from $215/month.

Everyone qualifies, so there is nothing to lose. Click below and get your money this week:

https://clearpath.example/apply?partner=raterover&subid=bc-1002`,
        ai: [
          ai(
            "CFPB-STEERING",
            "medium",
            "medium",
            "ClearPath Personal Loans came out on top",
            "The page presents ClearPath as the winner of a comparison without describing any criteria, and the partner is paid per application.",
            "Describe how lenders were compared and disclose that rankings are influenced by compensation, or present options neutrally.",
          ),
        ],
        note: "Guaranteed approval, no credit check, a below-floor APR and an amount and term we do not offer, all with no affiliate disclosure. This cannot be fixed by editing; please re-brief the page from the partner kit.",
      },
    ],
  },
  {
    key: "r2",
    title: "Cash Rewards Card review, is 0% APR worth it",
    product: "credit_card",
    channel: "affiliate_page",
    by: "Jordan Ellis",
    start: { biz: 32 },
    final: "approved",
    rv: "DD",
    v: [
      {
        content: `ClearPath Cash Rewards Card Review: Is 0% APR Worth It?

The ClearPath Cash Rewards Card gives you 0% APR for 15 months and no annual fee, which makes it one of the easiest cards to get approved for. Rewards are generous too: 1.5% back on every purchase.

Pros
- 0% APR on purchases and balance transfers
- No annual fee
- Cash back with no categories

Apply through our link below. You can be approved in minutes.

https://clearpath.example/card?ref=raterover-cc`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "0% APR for 15 months",
            "The rate is not called an introductory APR and the variable go-to APR is never stated.",
            "Use the approved intro APR disclosure with the go-to APR range next to the first mention.",
          ),
          ai(
            "UDAAP-APR",
            "high",
            "high",
            "0% APR on purchases and balance transfers",
            "The 0% intro rate applies to purchases only. Balance transfers carry a 3% fee and are not covered by the intro APR.",
            "Remove the balance transfer claim and state the 3% balance transfer fee.",
          ),
        ],
        dismiss: { "REGZ-24-AVAIL": "0% is the card's introductory APR, not a standard rate; the missing intro wording is covered by the REGZ-16-INTRO finding." },
        note: "Missing affiliate disclosure, and the 0% intro APR is described as applying to balance transfers, which it does not. Add the paid-link disclosure and the intro APR wording from the snippet library.",
      },
      {
        content: `ClearPath Cash Rewards Card Review: Is the Intro APR Worth It?

${AFF_DISC}

The ClearPath Cash Rewards Card pairs an introductory APR with flat cash back, which makes it a reasonable fit if you are planning a big purchase. Rewards are simple: 1.5% back on every purchase.

Pros
- ${CC("intro_apr_disclosure")}
- Cash back with no categories to track
- ${CC("fee_disclosure")}

${CC("soft_pull_notice")}

You can check whether you prequalify through our link below.

https://clearpath.example/card?ref=raterover-cc`,
        note: "Disclosure, intro terms and fees are all in place. Approved.",
      },
    ],
  },
  {
    key: "r3",
    title: "Stop paying 25% on cards, social post",
    product: "personal_loan",
    channel: "social",
    by: "Jordan Ellis",
    start: { biz: 27 },
    final: "rejected",
    rv: "D",
    v: [
      {
        content: `Stop paying 25% interest on your cards!

ClearPath will approve you in minutes, even with bad credit. Borrow up to $60,000 and pay it back over 7 years. No credit check, no hassle.

Link in bio.`,
        ai: [
          ai(
            "FCRA-PREQUAL",
            "high",
            "high",
            "ClearPath will approve you in minutes",
            "Promises approval in minutes. ClearPath underwrites every application, and a rate check is a prequalification, not an approval.",
            "Say 'Check your rate in minutes. Approval depends on your credit and other factors.'",
          ),
        ],
        note: "Repeats the approval-guarantee and amount-and-term problems from earlier submissions and has no paid-partnership tag. Rejecting rather than sending back; please review the partner guidelines before the next submission.",
      },
    ],
  },
  {
    key: "r4",
    title: "Mortgage relief refinance landing page",
    product: "mortgage_prequal",
    channel: "affiliate_page",
    states: ["CA", "TX"],
    by: "Jordan Ellis",
    start: { biz: 21 },
    final: "rejected",
    rv: "P",
    v: [
      {
        content: `Mortgage Relief 2026: Wipe Out Your Payments with a Government-Approved Refi

Are you a Wells Fargo customer paying too much on your mortgage? Thanks to a new government-approved relief program, homeowners are using ClearPath to lock in a fixed-rate 5/1 ARM and cut payments by hundreds a month.

- Pre-approved in under 5 minutes
- No closing costs
- Guaranteed approval for homeowners with equity
- Rates start at 4.1%, the best rates around

Tap the button and claim your relief today.

https://clearpath.example/home/refi?src=raterover-mtg`,
        add: [
          ai(
            "UDAAP-APR",
            "high",
            "high",
            "cut payments by hundreds a month",
            "An unsubstantiated savings claim presented as typical. Savings depend entirely on the borrower's current loan and cannot be promised.",
            "Remove the savings claim or replace it with the approved illustrative example and APR.",
          ),
        ],
        note: "Implies a government-backed program, names the consumer's current lender, and promises no closing costs and guaranteed approval; none of that is available. Given the history on earlier submissions I am rejecting rather than requesting changes, and flagging this for the partner review.",
      },
    ],
  },
  {
    key: "r5",
    title: "Need cash now display ad",
    product: "personal_loan",
    channel: "display",
    by: "Jordan Ellis",
    start: { biz: 15 },
    final: "rejected",
    rv: "DP",
    v: [
      {
        content: `Need cash now? Get up to $50,000 today with ClearPath. Bad credit welcome. Rates from 6.99% APR.`,
        note: "The 6.99% APR is below our 8.99% floor and 'bad credit welcome' reads as an approval promise. State the real APR range with the APR disclosure and resubmit.",
      },
      {
        content: `Need cash now? Get up to $50,000 with ClearPath. Everyone is welcome to apply. Rates from 5.99% APR, the lowest rates you will find.`,
        note: "The resubmission still advertises a below-floor APR (now 5.99%) and adds an unsubstantiated 'lowest rates' claim. Rejected; please go through the product facts sheet before any further submission.",
      },
    ],
  },
  {
    key: "r6",
    title: "Cash Rewards Card honest review",
    product: "credit_card",
    channel: "affiliate_page",
    by: "Jordan Ellis",
    start: { biz: 5 },
    final: "changes_requested",
    rv: "D",
    v: [
      {
        content: `Is the ClearPath Cash Rewards Card Worth It? Our Honest Review

We've tested a stack of cash back cards, and the ClearPath Cash Rewards Card keeps landing near the top of our list. It pairs an introductory 0% APR with a flat 1.5% cash back rate and no annual fee, so you can earn on everyday spending without worrying about an annual fee.

The intro rate lasts 15 months, which is plenty of time to pay down a big purchase. After that, a variable APR applies.

Commission note: this page contains affiliate links.

Apply here: https://clearpath.example/card?ref=raterover-review`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "medium",
            "medium",
            "After that, a variable APR applies.",
            "The go-to APR is mentioned but not stated, so the reader cannot see what the rate becomes after the intro period.",
            "State the go-to APR next to the intro rate: 'then a variable APR of 20.24% to 29.99%, based on your creditworthiness.'",
          ),
        ],
        note: "Add a proper paid-partnership disclosure (a 'commission note' about affiliate links is not clear enough under the FTC guidance) and put the go-to variable APR and fees next to the 0% intro APR.",
      },
    ],
  },
  {
    key: "r7",
    title: "ClearPath loan review: fast cash",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Jordan Ellis",
    start: { biz: 1 },
    final: "in_review",
    rv: "D",
    v: [
      {
        content: `ClearPath Personal Loan Review: Fast Cash for Almost Anyone

ClearPath is a top pick for borrowers who need money quickly. Loans run from $2,000 to $50,000, and you can choose repayment terms from 24 to 60 months. Rates start at 8.99%.

Basically anyone gets approved, and funds typically land the next day. Compare that to your bank, which will likely turn you down.

Ready to apply? Start at https://clearpath.example/apply?partner=raterover&subid=rev-1007`,
        ai: [
          ai(
            "CFPB-STEERING",
            "medium",
            "medium",
            "ClearPath is a top pick for borrowers who need money quickly",
            "A recommendation with no stated basis on a page whose publisher is paid per application.",
            "Explain the criteria behind the recommendation and disclose the compensation relationship.",
          ),
          ai(
            "UDAAP-APR",
            "low",
            "low",
            "funds typically land the next day",
            "Funding speed is not an approved product fact and depends on verification and the borrower's bank.",
            "Remove the funding-speed claim.",
          ),
        ],
      },
    ],
  },
  {
    key: "r8",
    title: "Fast cash social post",
    product: "personal_loan",
    channel: "social",
    by: "Jordan Ellis",
    start: { live: { ideal: 82, min: 74, max: 120 } },
    final: "submitted",
    rv: "",
    v: [
      {
        content: `Rates starting at 5.5% APR?! ClearPath is the #1 lender for fast cash. Everyone qualifies. Tap the link in my bio to apply. #personalloan`,
      },
    ],
  },

  // ---------------------------------------------------------------- Cardwell Reviews (clean record)
  {
    key: "c1",
    title: "Cash Rewards Card review: flat rewards and a long intro window",
    product: "credit_card",
    channel: "affiliate_page",
    by: "Amara Singh",
    start: { biz: 35 },
    final: "approved",
    rv: "D",
    v: [
      {
        content: `ClearPath Cash Rewards Card Review: Flat Rewards and a Long Intro Window

${AFF_DISC}

Cardwell Reviews tests cards by living with them for 90 days. Here is how the ClearPath Cash Rewards Card held up for a household that spends about the same each month on groceries, gas and streaming.

The short version: a steady cash back rate and a low-friction fee table make it easy to understand, and a 15-month intro window gives you room to spread out a larger purchase.

Key terms
- ${CC("intro_apr_disclosure")}
- ${CC("fee_disclosure")}
- ${CC("rewards_terms")}

Who should skip it: if you expect to carry a balance well past the intro period, compare the variable APR above with other cards first. Cards with a higher rewards rate in specific categories may suit big spenders in those categories better.

${CC("soft_pull_notice")}

Check whether you prequalify: https://clearpath.example/card?ref=cardwell`,
      },
    ],
  },
  {
    key: "c2",
    title: "Is a personal loan the right way to consolidate card debt?",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Amara Singh",
    start: { biz: 28 },
    final: "approved",
    rv: "D",
    v: [
      {
        content: `Is a Personal Loan the Right Way to Consolidate Credit Card Debt?

${AFF_DISC}

Rolling several card balances into one loan can simplify your budget, but it only helps if the new APR is lower than what you pay now. Compare your current card APRs with the range below before you apply.

ClearPath Personal Loans: $2,000 to $50,000, terms of 24 to 60 months. ${PL("apr_disclosure")}

${PL("representative_example")}

${PL("origination_fee")}

${PL("soft_pull_notice")}

Check your rate: https://clearpath.example/loans?ref=cardwell`,
      },
    ],
  },
  {
    key: "c3",
    title: "90 days with the Cash Rewards Card, social post",
    product: "credit_card",
    channel: "social",
    by: "Amara Singh",
    start: { biz: 11 },
    final: "approved",
    rv: "D",
    pri: "Tied to the card's autumn promotion; post is scheduled for Monday morning.",
    v: [
      {
        content: `We spent 90 days using the ClearPath Cash Rewards Card for everyday purchases. Verdict: simple, flat rewards. ${CC("rewards_terms")} Full review: cardwell-reviews.example/clearpath-card ${AFF_TAG}`,
      },
    ],
  },
  {
    key: "c4",
    title: "What a mortgage prequalification can and cannot tell you",
    product: "mortgage_prequal",
    channel: "affiliate_page",
    by: "Amara Singh",
    start: { biz: 13 },
    final: "approved",
    rv: "P",
    v: [
      {
        content: `What a Mortgage Prequalification Can (and Cannot) Tell You

${AFF_DISC}

A prequalification gives you a rough sense of what you may be able to borrow. It is based on information you provide, so it is an estimate rather than a commitment, and it is a useful first step before you start touring homes.

ClearPath Home Lending offers a prequalification that uses a soft credit inquiry. We liked how quickly you get an estimate and that the process does not affect your credit score. Keep in mind that your final terms will depend on a full application.

${MT("soft_pull_notice")}

${MT("prequal_disclaimer")}

${MT("apr_disclosure")}

${MT("representative_example")}

${MT("nmls_ehl")}

If you are comparing lenders, ask each one for a Loan Estimate so you can compare costs side by side. Our picks of the month appear on our lender list.

Start a prequalification: https://clearpath.example/home/start?ref=cardwell`,
        ai: [
          ai(
            "CFPB-STEERING",
            "low",
            "low",
            "Our picks of the month",
            "A ranking of lenders with no description of how picks are chosen on this page.",
            "Link to the methodology or state how picks are chosen.",
          ),
        ],
        dismiss: {
          "CFPB-STEERING": "Ranking basis is the published methodology linked in the site footer; not driven by compensation.",
        },
        note: "Approved. The ranking basis is clear from the site methodology page.",
      },
    ],
  },
  {
    key: "c5",
    title: "Cash back cards compared: ClearPath vs flat-rate rivals",
    product: "credit_card",
    channel: "affiliate_page",
    by: "Amara Singh",
    start: { live: { ideal: 28, min: 8, max: 55 } },
    final: "submitted",
    rv: "",
    v: [
      {
        content: `Cash Back Cards Compared: How the ClearPath Cash Rewards Card Stacks Up

${AFF_DISC}

Flat-rate cash back cards are easy to compare: the rewards rate, the fees and what happens when a promotional period ends. Here is how the ClearPath Cash Rewards Card stacks up.

- ${CC("intro_apr_disclosure")}
- ${CC("fee_disclosure")}
- ${CC("rewards_terms")}

Our current favorite for households that want one simple card is the ClearPath Cash Rewards Card, because the terms are easy to read and the fee table has no surprises. If you plan to carry a balance after the intro period, compare the variable APR against other cards before you apply.

Check whether you prequalify: https://clearpath.example/card?ref=cardwell-compare`,
        ai: [
          ai(
            "CFPB-STEERING",
            "low",
            "low",
            "Our current favorite for households that want one simple card",
            "A preference for one product with a reason given, but no description of how favorites are chosen or whether compensation plays a part.",
            "Link to the site's methodology or state how the favorite was chosen.",
          ),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Ledger & Latte (mixed)
  {
    key: "l1",
    title: "My honest take on a 0% intro APR card",
    product: "credit_card",
    channel: "affiliate_page",
    by: "Tomas Reyes",
    start: { biz: 37 },
    final: "approved",
    rv: "D",
    v: [
      {
        content: `My Honest Take on a 0% Intro APR Card

${AFF_DISC}

I have been using the ClearPath Cash Rewards Card for four months, mostly for groceries and gas, and the experience has been pleasantly boring. Boring is what I want from a card.

The details that matter to me:
- ${CC("intro_apr_disclosure")}
- ${CC("fee_disclosure")}
- ${CC("rewards_terms")}

If you are planning a big purchase you can pay down inside the intro window, it is worth a look. If you usually carry a balance for years, the variable APR after the intro period matters more than the rewards rate, so compare it with other cards first.

${CC("prequal_disclaimer")}

Check whether you prequalify: https://clearpath.example/card?ref=ledgerlatte`,
      },
    ],
  },
  {
    key: "l2",
    title: "How I paid off $12,000 in card debt with a ClearPath loan",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Tomas Reyes",
    start: { biz: 30 },
    final: "approved",
    rv: "DDD",
    notes: "Personal story post; scheduled for the first of the month.",
    v: [
      {
        content: `How I Paid Off $12,000 in Card Debt With a ClearPath Loan

I'll be honest: I was embarrassed by my credit card balances. Last spring I took out a ClearPath personal loan, and it changed everything. Payments of $280 a month, a 36-month term, and a rate of just 7.9%.

If you want the same, you can get approved no matter what your score looks like. Their loan officers made it painless.

Here's my referral link: https://clearpath.example/apply?ref=ledgerlatte

PS: This post contains affiliate links.`,
        ai: [
          ai(
            "UDAAP-GUARANTEE",
            "high",
            "high",
            "you can get approved no matter what your score looks like",
            "Implies approval regardless of credit, which is an absolute approval claim. ClearPath checks credit and underwrites every application.",
            "Say 'Check your rate with no impact to your credit score. Approval and terms depend on your credit and other factors.'",
          ),
        ],
        note: "Your own rate and payment are being presented as typical, the 7.9% is below our floor and is not labelled APR. Please also replace 'approved no matter what' with prequalification language and add a clear paid-link disclosure.",
      },
      {
        content: `How I Paid Off $12,000 in Card Debt With a ClearPath Loan

I'll be honest: I was embarrassed by my credit card balances. Last spring I took out a ClearPath personal loan, and it helped me simplify. My payments were $280 a month over 36 months, at a 12.5% APR.

Your own rate and approval depend on your credit, and rates are 8.99% to 35.99% APR. Their loan officers made the process easy.

Here's my referral link: https://clearpath.example/apply?ref=ledgerlatte

Disclosure: This post contains affiliate links.`,
        add: [
          ai(
            "REGZ-24-TRIGGER",
            "medium",
            "high",
            "$280 a month over 36 months",
            "One borrower's payment is stated without the approved representative example, so the repayment terms and total cost are not shown.",
            "Replace it with the approved representative example, which shows the amount, term, APR and total repayment.",
          ),
        ],
        note: "Much closer. 'Contains affiliate links' is still not a clear disclosure, and the payment example needs the approved representative example with APR and total repayment.",
      },
      {
        content: `How I Paid Off $12,000 in Card Debt With a ClearPath Loan

${AFF_DISC}

I'll be honest: I was embarrassed by my credit card balances. Last spring I took out a ClearPath personal loan, and it helped me simplify. Everyone's numbers are different, so here is the company's own example rather than mine.

${PL("representative_example")}

${PL("apr_disclosure")}

${PL("soft_pull_notice")}

Their loan officers made the process easy. Here's my referral link: https://clearpath.example/apply?ref=ledgerlatte`,
        note: "All three points addressed. Thanks for the quick turnaround.",
      },
    ],
  },
  {
    key: "l3",
    title: "Buying our first home: what prequalification was like",
    product: "mortgage_prequal",
    channel: "affiliate_page",
    states: ["CA"],
    by: "Tomas Reyes",
    start: { biz: 17 },
    final: "approved",
    rv: "PP",
    v: [
      {
        content: `Buying Our First Home: What the Prequalification Process Was Really Like

We started house hunting this spring and spoke to a handful of lenders. ClearPath Home Lending gave us a pre-approval letter in one afternoon, and they had the lowest rates we found. Honestly, I'd recommend them to any couple buying their first place.

Start here if you want to try it: https://clearpath.example/home/start?ref=ledgerlatte`,
        note: "Pre-approval and 'lowest rates' wording need to go, and the mortgage disclosures (NMLS ID, Equal Housing Lender, California license) are missing. Please also add the paid-link disclosure.",
      },
      {
        content: `Buying Our First Home: What the Prequalification Process Was Really Like

${AFF_DISC}

We started house hunting this spring and spoke to a handful of lenders. ClearPath Home Lending gave us a prequalification estimate in one afternoon, and the process was straightforward. Honestly, I'd recommend asking each lender for a Loan Estimate so you can compare costs side by side.

${MT("prequal_disclaimer")}

${MT("soft_pull_notice")}

${MT("nmls_ehl")} ${MT("ca_license")}

Start here if you want to try it: https://clearpath.example/home/start?ref=ledgerlatte`,
        note: "NMLS line and California license are in. Approved.",
      },
    ],
  },
  {
    key: "l4",
    title: "Consolidating three cards into one payment, social",
    product: "personal_loan",
    channel: "social",
    by: "Tomas Reyes",
    start: { biz: 4 },
    final: "changes_requested",
    rv: "P",
    v: [
      {
        content: `Consolidated three cards into one payment and finally feel in control. If you've been paying 25%+ APR on your cards, ClearPath loans start at 8.99% APR. Check your rate (soft pull, no credit impact): clearpath.example/loans #personalfinance`,
        ai: [
          ai(
            "UDAAP-APR",
            "medium",
            "medium",
            "ClearPath loans start at 8.99% APR",
            "Only the lowest APR is shown, next to a comparison with 25% cards, which suggests it is what a typical borrower will get.",
            "Show the full range ('8.99% to 35.99% APR') and say the rate depends on credit.",
          ),
        ],
        note: "Add the paid-partnership tag, and show the APR range next to the 8.99% headline so it does not read as the typical rate.",
      },
    ],
  },

  // ---------------------------------------------------------------- LeadHarbor (mixed)
  {
    key: "h1",
    title: "Compare personal loans, display ad",
    product: "personal_loan",
    channel: "display",
    by: "Keiko Tanaka",
    start: { biz: 31 },
    final: "approved",
    rv: "D",
    v: [
      {
        content: `Consolidate debt with a ClearPath Personal Loan. Loan amounts from $2,000 to $50,000. ${PL("apr_disclosure")} Checking your rate will not affect your credit score. Advertisement.`,
      },
    ],
  },
  {
    key: "h2",
    title: "Quick cash for young professionals, loan matcher",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Keiko Tanaka",
    start: { biz: 24 },
    final: "rejected",
    rv: "P",
    v: [
      {
        content: `Quick Cash for Young Professionals: Compare Personal Loans

LeadHarbor matched 2,000 borrowers last quarter with the lender that fits them best. Today our top match is ClearPath Personal Loans.

This offer is ideal for young, working professionals under 40. Retirees and anyone on a fixed income probably won't qualify, so don't waste your time.

- Pre-approved matches in under a minute
- Rates from 5.99% APR
- Featured lender: ClearPath

Click to see your matches: https://clearpath.example/apply?partner=leadharbor&subid=lh-77`,
        ai: [
          ai(
            "ECOA-DISCOURAGE",
            "high",
            "high",
            "Retirees and anyone on a fixed income probably won't qualify, so don't waste your time.",
            "Discourages older applicants and applicants whose income comes from public assistance or retirement from applying, which Regulation B prohibits.",
            "Remove all age and income-source references. Describe the product neutrally.",
          ),
          ai(
            "CFPB-STEERING",
            "medium",
            "medium",
            "our top match is ClearPath Personal Loans",
            "Presents one lender as the top match without stating the basis, on a lead-generation page paid per application.",
            "State how matches are chosen and disclose the compensation relationship.",
          ),
        ],
        note: "Age-based language ('young professionals under 40', retirees 'probably won't qualify') is a fair-lending problem under Reg B and cannot be edited around. It also uses pre-approved and a below-floor APR. Rejecting; please rebuild the page.",
      },
    ],
  },
  {
    key: "h3",
    title: "Cash Rewards Card 0% banner",
    product: "credit_card",
    channel: "display",
    by: "Keiko Tanaka",
    start: { biz: 9 },
    final: "submitted",
    rv: "D",
    v: [
      {
        content: `0% interest on purchases for 15 months. No annual fee. ClearPath Cash Rewards Card. Apply now.`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "0% interest on purchases for 15 months",
            "The promotional rate is not called an introductory APR and the go-to APR is not stated next to it.",
            "Use the approved intro APR disclosure, including the 20.24% to 29.99% variable go-to APR.",
          ),
        ],
        note: "This is a 0% intro APR, not 'no interest'. The 15-month end point and the go-to variable APR need to sit next to it, along with the fee disclosure.",
      },
      {
        content: `0% intro APR on purchases for 15 months from account opening. After that, a variable APR of 20.24% to 29.99% applies, based on your creditworthiness. $0 annual fee. ClearPath Cash Rewards Card. Apply now.`,
        live: { ideal: 5, min: 1.5, max: 11 },
        ai: [
          ai(
            "UDAAP-APR",
            "medium",
            "low",
            "$0 annual fee",
            "The annual fee is shown without the 3% balance transfer fee, so the fee picture may be incomplete.",
            "Add the approved fee disclosure: 'Annual fee: $0. Balance transfer fee: 3% of the amount of each balance transfer.'",
          ),
        ],
      },
    ],
  },
  {
    key: "h4",
    title: "Own your home sooner, mortgage banner",
    product: "mortgage_prequal",
    channel: "display",
    by: "Keiko Tanaka",
    start: { biz: 8 },
    final: "changes_requested",
    rv: "D",
    v: [
      {
        content: `Own your home sooner. ClearPath Home Lending: fixed-rate ARM options, rates from 5.1%. Get pre-approved in minutes.`,
        note: "A 5/1 ARM cannot be called fixed-rate without saying how long it is fixed. Also remove 'pre-approved', show the APR, and add the NMLS ID and Equal Housing Lender line.",
      },
    ],
  },
  {
    key: "h5",
    title: "Compare personal loan lenders: how ClearPath stacks up",
    product: "personal_loan",
    channel: "affiliate_page",
    by: "Keiko Tanaka",
    start: { live: { ideal: 65, min: 61, max: 71 } },
    final: "submitted",
    rv: "",
    v: [
      {
        content: `Compare Personal Loan Lenders: How ClearPath Stacks Up

${AFF_DISC}

LeadHarbor compares lenders on the numbers that matter: rates, fees and flexibility. ClearPath offers loans from $2,000 to $50,000 with repayment from 24 to 60 months, and rates from 8.99% to 35.99% APR depending on credit.

Our top match for most borrowers is ClearPath, with the lowest fees in our database. See how it compares and check your rate with a soft pull that will not affect your credit score.

${PL("apr_disclosure")}

Check your rate: https://clearpath.example/loans?ref=leadharbor`,
        ai: [
          ai(
            "CFPB-STEERING",
            "medium",
            "high",
            "Our top match for most borrowers is ClearPath",
            "Names one lender as the top match for most borrowers without explaining how matches are made, on a page paid per referral.",
            "Explain the matching criteria, and disclose that matches may be influenced by compensation.",
          ),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Money with Mara (mixed)
  {
    key: "mo1",
    title: "How I handled my card debt, with a rate check",
    product: "personal_loan",
    channel: "social",
    by: "Mara Lindqvist",
    start: { biz: 29 },
    final: "approved",
    rv: "P",
    v: [
      {
        content: `Friends keep asking how I handled my credit card debt. Real talk: checking your rate is not the same as pre-approval. I checked mine with ClearPath's soft pull (no credit score impact) before deciding. Rates 8.99% to 35.99% APR, and your rate depends on your credit. ${AFF_TAG}`,
        dismiss: {
          "FCRA-PREQUAL": "Educational contrast between checking a rate and pre-approval; the post makes no claim that anyone is pre-approved.",
        },
        note: "Fine. It is an educational comparison, not an offer.",
      },
    ],
  },
  {
    key: "mo2",
    title: "Cash Rewards Card reel caption",
    product: "credit_card",
    channel: "social",
    by: "Mara Lindqvist",
    start: { biz: 20 },
    final: "approved",
    rv: "DP",
    v: [
      {
        content: `OMG this card is a game changer! 0% APR for a whole year and a half + 1.5% back on everything. Link in bio, you will get approved, trust me.`,
        ai: [
          ai(
            "UDAAP-GUARANTEE",
            "high",
            "high",
            "you will get approved, trust me",
            "Promises approval, which ClearPath cannot do; every application is underwritten.",
            "Remove it, or say 'See if you prequalify with no impact to your credit score.'",
          ),
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "0% APR for a whole year and a half",
            "The rate is not called an introductory APR, the period is imprecise, and no go-to APR is given.",
            "Use the approved intro APR disclosure with the 15-month period and the variable go-to APR.",
          ),
        ],
        dismiss: { "REGZ-24-AVAIL": "0% is the card's introductory APR, not a standard rate; the missing intro wording is covered by the REGZ-16-INTRO finding." },
        note: "Needs a paid-partnership tag, the intro APR wording (purchases only, 15 months, then a variable APR) and no 'you will get approved'.",
      },
      {
        content: `${AFF_TAG}. I've been using the ClearPath Cash Rewards Card for everyday spending. ${CC("intro_apr_disclosure")} ${CC("rewards_terms")} Check if you prequalify with no impact to your credit score (link in bio).`,
        note: "Looks good now.",
      },
    ],
  },
  {
    key: "mo3",
    title: "Dreaming of owning a home, social post",
    product: "mortgage_prequal",
    channel: "social",
    by: "Mara Lindqvist",
    start: { biz: 12 },
    final: "withdrawn",
    rv: "D",
    wdAfterCr: true,
    wdReason: "Campaign cancelled; will resubmit with new creative.",
    v: [
      {
        content: `Dreaming of owning a home? With ClearPath Home Lending, you can lock in a rate and enjoy no closing costs. Pre-approval takes minutes. DM me for my link!`,
        note: "Remove 'no closing costs' and 'pre-approval', and add a paid-partnership tag plus the NMLS ID and Equal Housing Lender line before this goes live.",
      },
    ],
  },
  {
    key: "mo4",
    title: "Holiday spending with the Cash Rewards Card",
    product: "credit_card",
    channel: "social",
    by: "Mara Lindqvist",
    start: { live: { ideal: 17, min: 13, max: 23 } },
    final: "submitted",
    rv: "",
    pri: "Holiday campaign goes live Friday morning and the influencer post is already scheduled.",
    v: [
      {
        content: `Holiday spending season is here and I'm putting everything on the ClearPath Cash Rewards Card. $0 annual fee, 1.5% cash back and 0% intro APR for 15 months from account opening. Details in my bio!`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "medium",
            "medium",
            "0% intro APR for 15 months from account opening",
            "The intro rate is described correctly but the go-to variable APR is not stated near the first mention.",
            "Add the go-to APR: 'then a variable APR of 20.24% to 29.99%, based on your creditworthiness.'",
          ),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Dollar Dispatch (mixed)
  {
    key: "d1",
    title: "Sponsor spotlight: one payment instead of four",
    product: "personal_loan",
    channel: "email",
    by: "Owen Gallagher",
    start: { biz: 36 },
    final: "approved",
    rv: "P",
    v: [
      {
        content: `Subject: Sponsor spotlight: one payment instead of four

Hi readers,

${AFF_DISC}

If you're juggling several card payments, this week's sponsor, ClearPath, offers personal loans from $2,000 to $50,000 that can roll them into one. ${PL("apr_disclosure")}

${PL("representative_example")}

${PL("soft_pull_notice")}

Check your rate: https://clearpath.example/loans?ref=dd

Owen

${FOOTER}`,
      },
    ],
  },
  {
    key: "d2",
    title: "Pay no interest? Cash Rewards Card sponsor email",
    product: "credit_card",
    channel: "email",
    by: "Owen Gallagher",
    start: { biz: 3 },
    final: "changes_requested",
    rv: "P",
    v: [
      {
        content: `Subject: Pay no interest until 2027?

Hello readers,

Sponsored: this week's featured card is the ClearPath Cash Rewards Card. Pay no interest on purchases for 15 months and earn 1.5% cash back with no annual fee.

Apply today: https://clearpath.example/card?ref=dd-1130

Thanks for reading!
Owen`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "high",
            "Pay no interest on purchases for 15 months",
            "Describes the 0% intro APR as 'no interest', which is not the product, and gives no end point or go-to APR near it.",
            "Use the approved intro APR disclosure with the variable go-to APR.",
          ),
        ],
        note: "'No interest' is not accurate for this card (it has a 0% intro APR), the go-to variable APR is missing, and the email footer needs an unsubscribe link and postal address.",
      },
    ],
  },
  {
    key: "d3",
    title: "Need $15,000 fast? Sponsor loan email",
    product: "personal_loan",
    channel: "email",
    states: ["TX"],
    by: "Owen Gallagher",
    start: { biz: 2 },
    final: "in_review",
    rv: "P",
    v: [
      {
        content: `Subject: Need $15,000 fast? This lender says yes

Hi readers,

This week's sponsor, ClearPath, is offering personal loans with rates as low as 3.9% and payments from $149 a month, plus a no credit check prequalification. Most readers get approved the same day.

Tap here to see your rate: https://clearpath.example/loans?ref=dd-fast

Unsubscribe here if you would rather not get sponsor emails.`,
        ai: [
          ai(
            "UDAAP-APR",
            "medium",
            "medium",
            "Most readers get approved the same day",
            "An approval-speed claim about 'most readers' with no basis, which suggests approval is likely.",
            "Remove it. Say 'Check your rate with no impact to your credit score. Approval depends on your credit.'",
          ),
        ],
      },
    ],
  },
  {
    key: "d4",
    title: "Last chance: holiday card offer ends Friday",
    product: "credit_card",
    channel: "email",
    by: "Owen Gallagher",
    start: { live: { ideal: 31, min: 26, max: 60 } },
    final: "submitted",
    rv: "",
    pri: "Promotion ends Friday and the send is scheduled for tomorrow morning.",
    v: [
      {
        content: `Subject: Last chance: card offer ends Friday

Hello readers,

Our sponsor ClearPath is wrapping up its holiday card promotion this Friday. The Cash Rewards Card offers 0% APR for 15 months and a 1.5% cash back rate on every purchase. No annual fee, ever.

Apply by Friday: https://clearpath.example/card?ref=dd-holiday

You are receiving this email because you subscribed to Dollar Dispatch. Unsubscribe anytime.`,
        ai: [
          ai(
            "REGZ-16-INTRO",
            "high",
            "medium",
            "0% APR for 15 months",
            "The rate is not called an introductory APR and the go-to variable APR is not stated.",
            "Use the approved intro APR disclosure with the variable go-to APR range.",
          ),
          ai(
            "UDAAP-APR",
            "low",
            "low",
            "No annual fee, ever.",
            "'Ever' is an unqualified promise about future fees that is not an approved product fact.",
            "Say '$0 annual fee' and include the balance transfer fee disclosure.",
          ),
        ],
      },
    ],
  },
];

export type FindingStatus = "open" | "accepted" | "dismissed" | "resolved";
export type Outcome = "approved" | "changes_requested" | "rejected";

export interface SubmissionRow {
  id: number;
  code: string;
  title: string;
  product: Product;
  channel: Channel;
  states: string[];
  launchDate: Date | null;
  priority: "standard" | "expedited";
  priorityReason: string | null;
  notes: string | null;
  status: Status;
  submitterId: number;
  partnerId: number | null;
  assigneeId: number | null;
  currentVersion: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  submittedAt: Date;
  dueAt: Date | null;
  decidedAt: Date | null;
  updatedAt: Date;
}

export interface VersionRow {
  id: number;
  submissionId: number;
  number: number;
  content: string;
  sourceUrl: string | null;
  assetUrl: string | null;
  contentHash: string;
  analysisStatus: "complete" | "rules_only";
  analysisSummary: string;
  model: string | null;
  createdBy: number;
  createdAt: Date;
}

export interface FindingRow {
  id: number;
  versionId: number;
  source: "rule" | "ai" | "reviewer";
  ruleCode: string;
  severity: Severity;
  quote: string;
  startOffset: number | null;
  endOffset: number | null;
  issue: string;
  suggestion: string | null;
  confidence: string | null;
  status: FindingStatus;
  dismissReason: string | null;
  actedBy: number | null;
  actedAt: Date | null;
  createdAt: Date;
}

export interface DecisionRow {
  id: number;
  submissionId: number;
  versionId: number;
  reviewerId: number;
  outcome: Outcome;
  note: string | null;
  feedbackDraft: string | null;
  createdAt: Date;
}

export interface AuditRow {
  id: number;
  submissionId: number;
  actorId: number | null;
  action: AuditAction;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface HistoryPlan {
  submissions: SubmissionRow[];
  versions: VersionRow[];
  findings: FindingRow[];
  decisions: DecisionRow[];
  auditEvents: AuditRow[];
}

/** Database ids of the people the plan refers to; resolved from the live database by resetDemoData. */
export interface PeopleIds {
  users: Record<string, number>; // by email
  partners: Record<string, number>; // by name
}

/** Positional ids, matching a fresh database seeded by scripts/seed-people.ts. */
export function defaultPeopleIds(): PeopleIds {
  return {
    users: Object.fromEntries(USERS.map((u, i) => [u.email, i + 1])),
    partners: Object.fromEntries(PARTNERS.map((p, i) => [p.name, i + 1])),
  };
}

// ------------------------------------------------------------------ small utilities

const H = 3_600_000;
const DAY = 24 * H;
const SECOND = 1000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const gauss = (rng: () => number): number =>
  Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng());

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const hourOf = (d: Date) => d.getUTCHours() + d.getUTCMinutes() / 60;

const WORK_START = 13;
const WORK_END = 22;

/** Start of the UTC day `n` business days before `now`, plus `hour` hours. */
function bizDaysBack(now: Date, n: number, hour: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (!isWeekend(d)) count++;
  }
  return new Date(d.getTime() + hour * H);
}

/** A weekday daytime instant inside [now-max, now-min] hours, as close to `ideal` as possible. */
function liveSlot(now: Date, w: { ideal: number; min: number; max: number }): Date {
  const at = (h: number) => new Date(Math.floor((now.getTime() - h * H) / SECOND) * SECOND);
  for (let step = 0; step <= (w.max - w.min) * 4; step++) {
    for (const sign of [1, -1]) {
      const h = w.ideal + sign * step * 0.25;
      if (h < w.min || h > w.max) continue;
      const t = at(h);
      if (!isWeekend(t) && hourOf(t) >= 13 && hourOf(t) < 21.5) return t;
    }
  }
  return at(w.ideal);
}

const firstName = (full: string) => full.split(" ")[0];
const trunc = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}...`);
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const PARTNER_DOMAIN: Record<string, string> = {
  RateRover: "raterover.example",
  "Cardwell Reviews": "cardwell-reviews.example",
  "Ledger & Latte": "ledgerandlatte.example",
  LeadHarbor: "leadharbor.example",
  "Money with Mara": "moneywithmara.example",
  "Dollar Dispatch": "dollardispatch.example",
};

// ------------------------------------------------------------------ dismissal reasons

const DISMISS: Record<string, string[]> = {
  "FCRA-PREQUAL": [
    "Refers to a prequalification check, not a firm offer of credit.",
    "Educational contrast between prequalification and approval; no offer of credit is made.",
  ],
  "UDAAP-SUPERLATIVE": [
    "Claim is attributed to a named, dated source in the footnote.",
    "Describes a feature of the product rather than ranking it against competitors.",
  ],
  "UDAAP-GUARANTEE": ["Quoted in a consumer warning, not a claim.", "Negated in the same sentence; no guarantee is made."],
  "REGZ-24-APR": ["The APR is stated in the next sentence, directly alongside the rate."],
  "REGZ-24-TRIGGER": ["The representative example with APR sits in the disclosure block directly below."],
  "REGZ-24-AVAIL": ["The figure is a competitor benchmark, not an advertised ClearPath term."],
  "REGZ-16-INTRO": ["The intro period and go-to APR are stated in the same sentence; the model read only the footer."],
  "REGZ-16-TRIGGER": ["The fee and APR table directly below the offer covers this."],
  "CFPB-STEERING": ["Ranking basis is the published methodology linked on the page, not compensation."],
  "UDAAP-APR": ["Reviewed in context; the APR range is shown with equal prominence."],
  "ECOA-DISCOURAGE": ["Reviewed in context; the wording does not refer to a protected characteristic."],
};
const LOW_CONF_DISMISS = [
  "Low-confidence model flag; the copy matches the approved wording.",
  "Model flag is a false positive on reading in context.",
];

// ------------------------------------------------------------------ intermediate model

interface FindingM {
  source: "rule" | "ai" | "reviewer";
  ruleCode: string;
  severity: Severity;
  quote: string;
  start: number | null;
  end: number | null;
  issue: string;
  suggestion: string | null;
  confidence: string | null;
  status: FindingStatus;
  dismissReason: string | null;
  actedBy: number | null;
  actedAt: Date | null;
  createdAt: Date;
  id: number;
  version: VersionM;
  order: number;
}

interface VersionM {
  sub: SubM;
  number: number;
  content: string;
  createdAt: Date;
  findings: FindingM[];
  analysisStatus: "complete" | "rules_only";
  summary: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  id: number;
}

interface DecisionM {
  sub: SubM;
  version: VersionM;
  reviewerId: number;
  outcome: Outcome;
  note: string | null;
  feedbackDraft: string | null;
  createdAt: Date;
  id: number;
}

interface EventM {
  sub: SubM;
  actorId: number | null;
  action: AuditAction;
  details: () => Record<string, unknown>;
  createdAt: Date;
  seq: number;
  id: number;
}

interface SubM {
  spec: Spec;
  index: number;
  id: number;
  code: string;
  submitterId: number;
  partnerId: number | null;
  assigneeId: number | null;
  versions: VersionM[];
  decisions: DecisionM[];
  events: EventM[];
  submittedAt: Date;
  dueAt: Date | null;
  decidedAt: Date | null;
  updatedAt: Date;
  launchDate: Date | null;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
}

type Role = "cr" | "approved" | "rejected" | "review" | "open";

interface Act {
  finding: FindingM;
  kind: "accepted" | "dismissed" | "added";
  reason?: string;
}

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function sortFindings(list: FindingM[]) {
  list.sort(
    (a, b) =>
      (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER) ||
      SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
      a.ruleCode.localeCompare(b.ruleCode),
  );
  list.forEach((f, i) => (f.order = i));
}

// ------------------------------------------------------------------ analysis (real engine + hand-written AI)

function aiToFinding(spec: Spec, vNum: number, content: string, a: AiSpec, source: "ai" | "reviewer"): Omit<FindingM, "version" | "id" | "createdAt"> {
  const start = content.indexOf(a.quote);
  if (start < 0) throw new Error(`${spec.key} v${vNum}: ${source} quote not found in content: ${a.quote}`);
  return {
    source,
    ruleCode: a.rule,
    severity: a.sev,
    quote: a.quote,
    start,
    end: start + a.quote.length,
    issue: a.issue,
    suggestion: a.sugg,
    confidence: source === "ai" ? a.conf : null,
    status: "open",
    dismissReason: null,
    actedBy: null,
    actedAt: null,
    order: 0,
  };
}

function summarize(findings: FindingM[], withAi: boolean, engineSummary: string): string {
  if (!withAi) return engineSummary;
  const n = findings.length;
  if (n === 0) return "No issues found by rule checks or model review.";
  const high = findings.filter((f) => f.severity === "high").length;
  const lead = findings.find((f) => f.severity === "high") ?? findings[0];
  return `Flagged ${n} issue${n === 1 ? "" : "s"} (${high} high severity) across rule checks and model review, led by ${lead.ruleCode}.`;
}

// ------------------------------------------------------------------ builder

interface Env {
  now: Date;
  ids: PeopleIds;
  rates: Map<number, number>;
}

const REVIEWERS = {
  P: "Priya Raman",
  D: "Daniel Okafor",
} as const;

const userEmail = (name: string) => {
  const u = USERS.find((x) => x.name === name);
  if (!u) throw new Error(`Unknown seed user: ${name}`);
  return u.email;
};

function pickReason(rng: () => number, f: FindingM, override?: Record<string, string>): string {
  const o = override?.[f.ruleCode];
  if (o) return o;
  if (f.source === "ai" && f.confidence === "low") return LOW_CONF_DISMISS[Math.floor(rng() * LOW_CONF_DISMISS.length)];
  const pool = DISMISS[f.ruleCode] ?? ["Reviewed in context; the copy is consistent with the approved wording."];
  return pool[Math.floor(rng() * pool.length)];
}

/** Which findings the reviewer acts on in a version, in the order they act. */
function planActs(role: Role, vs: Spec["v"][number], findings: FindingM[], rng: () => number): Act[] {
  const analysed = findings.filter((f) => f.source !== "reviewer");
  const adds = findings.filter((f) => f.source === "reviewer");
  const ordered = [...analysed].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.order - b.order);

  if (role === "approved") {
    return ordered.map((f) => ({ finding: f, kind: "dismissed" as const, reason: pickReason(rng, f, vs.dismiss) }));
  }
  if (role === "open") return [];

  const acts: Act[] = [];
  const consider = role === "review" ? ordered.slice(0, Math.max(1, Math.min(ordered.length - 1, Math.ceil(ordered.length / 2)))) : ordered;
  for (const f of consider) {
    const override = vs.dismiss?.[f.ruleCode];
    let kind: "accepted" | "dismissed" | "skip";
    if (override) kind = "dismissed";
    else if (f.severity === "high") kind = "accepted";
    else if (f.severity === "medium") kind = f.source === "ai" && f.confidence !== "high" && rng() < 0.3 ? "dismissed" : "accepted";
    else kind = rng() < 0.5 ? "dismissed" : "skip";
    if (kind === "skip") continue;
    acts.push({ finding: f, kind, reason: kind === "dismissed" ? pickReason(rng, f, vs.dismiss) : undefined });
  }
  if (role !== "review" && !acts.some((a) => a.kind === "accepted") && ordered.length > 0 && !adds.length) {
    const top = ordered.find((f) => !acts.some((a) => a.finding === f)) ?? ordered[0];
    const existing = acts.findIndex((a) => a.finding === top);
    if (existing >= 0) acts.splice(existing, 1);
    acts.push({ finding: top, kind: "accepted" });
  }
  if (role !== "review") for (const f of adds) acts.push({ finding: f, kind: "added" });
  return acts;
}

function buildFeedback(
  submitter: string,
  reviewer: string,
  title: string,
  outcome: Outcome,
  accepted: FindingM[],
): string | null {
  if (outcome === "approved") return null;
  const oneLine = (t: string) => t.replace(/\s+/g, " ");
  const items = [...accepted]
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.order - b.order)
    .slice(0, 3)
    .map((f, i) => `${i + 1}. "${trunc(oneLine(f.quote), 60)}": ${trunc(oneLine(f.suggestion ?? f.issue), 190)}`);
  const lines = [
    `Hi ${firstName(submitter)},`,
    outcome === "rejected"
      ? `Thanks for sending "${title}". We are not able to approve this asset, and it should not run in its current form. The main problems:`
      : `Thanks for sending "${title}". We can't approve it as written. Please fix the following and resubmit:`,
    ...items,
    outcome === "rejected"
      ? "Please check with your ClearPath partner manager before sending a replacement."
      : "Send a new version when it is ready and we will turn it around quickly.",
    "Thanks,",
    firstName(reviewer),
  ];
  return lines.join("\n");
}

interface Attempt {
  S: Date[];
  events: { at: Date; actorId: number | null; action: AuditAction; details: () => Record<string, unknown> }[];
  claimAt: (Date | null)[];
  decisionAt: (Date | null)[];
  actTimes: Map<Act, Date>;
  resolvedAt: Map<FindingM, Date>;
  analysisAt: Date[];
  withdrawnAt: Date | null;
}

async function realize(spec: Spec, index: number, env: Env): Promise<SubM> {
  const { now, ids } = env;
  const submitter = USERS.find((u) => u.name === spec.by);
  if (!submitter) throw new Error(`${spec.key}: unknown submitter ${spec.by}`);
  const submitterId = ids.users[submitter.email];
  const partnerId = submitter.partnerName ? ids.partners[submitter.partnerName] : null;
  const isAffiliate = submitter.role === "affiliate";
  const facts = PRODUCT_FACTS.find((p) => p.product === spec.product)!;
  const rate = partnerId !== null ? env.rates.get(partnerId) : undefined;
  const ctxBase = { product: spec.product, channel: spec.channel, states: spec.states ?? [], isAffiliate };
  const n = spec.v.length;

  const sub: SubM = {
    spec,
    index,
    id: 0,
    code: "",
    submitterId,
    partnerId,
    assigneeId: null,
    versions: [],
    decisions: [],
    events: [],
    submittedAt: new Date(0),
    dueAt: null,
    decidedAt: null,
    updatedAt: new Date(0),
    launchDate: null,
    riskScore: 0,
    riskLevel: "low",
  };

  // 1. Analysis: real rule findings plus hand-written model/reviewer findings.
  for (const [i, vs] of spec.v.entries()) {
    const ctx = { ...ctxBase, content: vs.content };
    const res = await analyzeAsset(ctx, { rules: RULES, facts, skipAi: true });
    const v: VersionM = {
      sub,
      number: i + 1,
      content: vs.content,
      createdAt: new Date(0),
      findings: [],
      analysisStatus: "complete", // in the demo story the model reviewed every version
      summary: "",
      riskScore: 0,
      riskLevel: "low",
      id: 0,
    };
    const base = () => ({ version: v, id: 0, createdAt: new Date(0) });
    for (const f of res.findings) {
      v.findings.push({
        ...base(),
        source: "rule",
        ruleCode: f.ruleCode,
        severity: f.severity,
        quote: f.quote,
        start: f.start,
        end: f.end,
        issue: f.issue,
        suggestion: f.suggestion ?? null,
        confidence: null,
        status: "open",
        dismissReason: null,
        actedBy: null,
        actedAt: null,
        order: 0,
      });
    }
    const aiRuleCodes = new Set(selectAiRules(ctx, RULES).map((r) => r.code));
    for (const a of vs.ai ?? []) {
      if (!aiRuleCodes.has(a.rule)) throw new Error(`${spec.key} v${i + 1}: ${a.rule} is not an AI-reviewed rule for this asset`);
      const ff = { ...base(), ...aiToFinding(spec, i + 1, vs.content, a, "ai") };
      if (v.findings.some((x) => x.ruleCode === ff.ruleCode && x.start !== null && x.end !== null && x.start < ff.end! && ff.start! < x.end))
        throw new Error(`${spec.key} v${i + 1}: AI finding duplicates a rule finding (${a.rule})`);
      v.findings.push(ff);
    }
    for (const a of vs.add ?? []) v.findings.push({ ...base(), ...aiToFinding(spec, i + 1, vs.content, a, "reviewer") });
    sortFindings(v.findings);
    const analysed = v.findings.filter((f) => f.source !== "reviewer");
    v.summary = summarize(analysed, v.analysisStatus === "complete", res.summary);
    const risk = computeRisk(v.findings, ctxBase, rate);
    v.riskScore = risk.score;
    v.riskLevel = risk.level;
    sub.versions.push(v);
  }

  // 2. Lifecycle: what the reviewer does with each version's findings.
  const rv = spec.rv;
  const roleOf = (k: number): Role => {
    if (k < n - 1) return "cr";
    switch (spec.final) {
      case "approved":
        return "approved";
      case "rejected":
        return "rejected";
      case "changes_requested":
        return "cr";
      case "in_review":
        return "review";
      case "withdrawn":
        return spec.wdAfterCr ? "cr" : "open";
      default:
        return "open";
    }
  };
  const rng0 = mulberry32(hashString(spec.key) ^ 0x9e3779b9);
  const roles = spec.v.map((_, k) => roleOf(k));
  const acts: Act[][] = spec.v.map((vs, k) => planActs(roles[k], vs, sub.versions[k].findings, rng0));
  const reviewerOf = (k: number): number | null => {
    const letter = rv[k];
    return letter ? ids.users[userEmail(REVIEWERS[letter as "P" | "D"])] : null;
  };
  const reviewerName = (k: number) => REVIEWERS[rv[k] as "P" | "D"];

  // Findings fixed by a later version become "resolved" at that version's resubmission.
  const resolvedIn = new Map<FindingM, number>();
  const stillOpenAfterReview = (f: FindingM, k: number) => {
    const a = acts[k].find((x) => x.finding === f);
    return !a || a.kind === "accepted" || a.kind === "added";
  };
  for (let k = 1; k < n; k++) {
    const rules = new Set(sub.versions[k].findings.map((f) => f.ruleCode));
    for (let j = 0; j < k; j++) {
      for (const f of sub.versions[j].findings) {
        if (resolvedIn.has(f) || !stillOpenAfterReview(f, j)) continue;
        if (!rules.has(f.ruleCode)) resolvedIn.set(f, k);
      }
    }
  }

  const profile = submitter.partnerName ? PARTNER_PROFILE[submitter.partnerName] : "clean";
  const expedited = Boolean(spec.pri);

  // 3. Timeline. Retry with compressed durations until everything fits before `now`.
  const attempt = (scale: number, norm: boolean): Attempt | null => {
    const rng = mulberry32(hashString(spec.key) ^ 0x51ed270b);
    // Keeps an instant on a weekday between 13:00 and 22:00 UTC (about 9am-6pm US Eastern) without bunching
    // everything at the window edges: off-hours instants move to a random working moment on the same or a later day.
    const snap = (ms: number, floorMs: number): number => {
      if (!norm) return ms;
      let day = Math.floor(ms / DAY) * DAY;
      let t = ms;
      for (;;) {
        const d = new Date(t);
        if (!isWeekend(d)) {
          const inWindow = hourOf(d) >= WORK_START && hourOf(d) < WORK_END;
          const ok = inWindow ? t : day + (WORK_START + rng() * (WORK_END - WORK_START)) * H;
          if (ok >= floorMs + 45 * 60_000) return Math.floor(ok / SECOND) * SECOND;
        }
        day += DAY;
        t = day + (WORK_START + rng() * (WORK_END - WORK_START)) * H;
      }
    };
    const adv = (from: number, hours: number) => snap(from + hours * H, from);
    const S: Date[] = [];
    const out: Attempt = {
      S,
      events: [],
      claimAt: [],
      decisionAt: [],
      actTimes: new Map(),
      resolvedAt: new Map(),
      analysisAt: [],
      withdrawnAt: null,
    };
    let last = 0;
    const push = (at: number, actorId: number | null, action: AuditAction, details: () => Record<string, unknown>, exact = false): Date => {
      const t = new Date(exact ? at : Math.max(at, last + 15 * SECOND + Math.floor(rng() * 20) * SECOND));
      last = t.getTime();
      out.events.push({ at: t, actorId, action, details });
      return t;
    };

    for (let k = 0; k < n; k++) {
      const v = sub.versions[k];
      const vsK = spec.v[k];
      // Resubmission time.
      let start: number;
      if (k === 0) {
        start = (spec.start.live ? liveSlot(now, spec.start.live) : new Date(bizDaysBack(now, spec.start.biz!, 13 + rng() * 7).getTime() + Math.floor(rng() * 60) * 60000)).getTime();
      } else if (vsK.live) {
        start = liveSlot(now, vsK.live).getTime();
        if (start <= last + 60 * SECOND) return null;
      } else {
        start = adv(last, (5 + rng() * 50) * scale);
      }
      S.push(new Date(start));
      if (k === 0) {
        push(
          start,
          submitterId,
          AUDIT.created,
          () => ({
            versionNumber: 1,
            code: sub.code,
            title: spec.title,
            product: spec.product,
            channel: spec.channel,
            priority: expedited ? "expedited" : "standard",
          }),
          true,
        );
      } else {
        push(start, submitterId, AUDIT.resubmitted, () => ({ versionNumber: k + 1, previousVersion: k }), true);
        let r = 0;
        for (const [f, at] of resolvedIn.entries()) {
          if (at !== k) continue;
          r++;
          const t = push(
            start + r * SECOND,
            null,
            AUDIT.findingResolved,
            () => ({
              versionNumber: f.version.number,
              findingId: f.id,
              ruleCode: f.ruleCode,
              outcome: "resolved",
              resolvedInVersion: k + 1,
            }),
            true,
          );
          out.resolvedAt.set(f, t);
        }
      }
      const aAt = push(Math.max(start, last) + (20 + Math.floor(rng() * 60)) * SECOND, null, AUDIT.analysisCompleted, () => ({
        versionNumber: k + 1,
        findingCount: v.findings.filter((x) => x.source !== "reviewer").length,
        highSeverity: v.findings.filter((x) => x.source !== "reviewer" && x.severity === "high").length,
        analysisStatus: v.analysisStatus,
        riskLevel: v.riskLevel,
      }));
      out.analysisAt.push(aAt);

      // Review.
      const role = roles[k];
      out.claimAt.push(null);
      out.decisionAt.push(null);
      if (role === "open") continue;
      const reviewerId = reviewerOf(k)!;
      const isDecision = role !== "review";
      const resub = k > 0;
      // First reviews take ~1.5 days at the median with a long tail; re-reviews are quicker; clean work is faster
      // and bad-record partners slower.
      const median = resub ? 6 : 27;
      const mult = profile === "clean" ? 0.7 : profile === "bad" ? 1.5 : 1;
      const turn = Math.min(170, Math.max(1.5, median * mult * (expedited ? 0.5 : 1) * Math.exp(0.65 * gauss(rng)))) * scale;
      const nActs = acts[k].length;
      const claimOffset = turn * (0.08 + rng() * 0.37);
      const offsets: number[] = [claimOffset];
      for (let i = 1; i <= nActs; i++) offsets.push(claimOffset + (turn - claimOffset) * (i / (nActs + 1)) * (0.75 + 0.25 * rng()));
      if (isDecision) offsets.push(turn);
      const times = offsets.map((o) => adv(aAt.getTime(), o)).sort((x, y) => x - y);
      let prev = last;
      const fixed = times.map((t) => (prev = Math.max(t, prev + 20 * SECOND + Math.floor(rng() * 200) * SECOND)));

      const claim = push(fixed[0], reviewerId, AUDIT.claimed, () => ({ versionNumber: k + 1, assignee: reviewerName(k) }));
      out.claimAt[k] = claim;
      acts[k].forEach((a, i) => {
        const action = a.kind === "accepted" ? AUDIT.findingAccepted : a.kind === "dismissed" ? AUDIT.findingDismissed : AUDIT.findingAdded;
        const t = push(fixed[i + 1], reviewerId, action, () => ({
          versionNumber: k + 1,
          findingId: a.finding.id,
          ruleCode: a.finding.ruleCode,
          severity: a.finding.severity,
          outcome: a.kind === "added" ? "added" : a.kind,
          ...(a.reason ? { reason: a.reason } : {}),
        }));
        out.actTimes.set(a, t);
      });
      if (isDecision) {
        const outcome: Outcome = role === "approved" ? "approved" : role === "rejected" ? "rejected" : "changes_requested";
        const action = outcome === "approved" ? AUDIT.approved : outcome === "rejected" ? AUDIT.rejected : AUDIT.changesRequested;
        const t = push(fixed[fixed.length - 1], reviewerId, action, () => ({
          versionNumber: k + 1,
          outcome,
          decisionId: sub.decisions.find((d) => d.version === v)?.id ?? null,
          ...(vsK.note ? { note: trunc(vsK.note, 160) } : {}),
        }));
        out.decisionAt[k] = t;
      }
    }

    if (spec.final === "withdrawn") {
      out.withdrawnAt = push(adv(last, (6 + rng() * 40) * scale), submitterId, AUDIT.withdrawn, () => ({
        versionNumber: n,
        reason: spec.wdReason ?? "Withdrawn by submitter",
      }));
    }
    return last < now.getTime() - 60 * SECOND ? out : null;
  };

  let result: Attempt | null = null;
  for (const [scale, norm] of [[1, true], [0.7, true], [0.45, true], [0.3, true], [0.2, true], [0.12, true], [0.07, true], [0.05, false]] as const) {
    result = attempt(scale, norm);
    if (result) break;
  }
  if (!result) throw new Error(`${spec.key}: could not fit the timeline before now`);

  // 4. Apply.
  const lastIdx = n - 1;
  sub.submittedAt = result.S[0];
  sub.updatedAt = result.events[result.events.length - 1].at;
  const lrng = mulberry32(hashString(spec.key) ^ 0x1234567);
  const roll = lrng();
  const days = spec.launch ?? (expedited ? 1 + Math.floor(lrng() * 3) : 4 + Math.floor(lrng() * 12));
  if (spec.launch !== null && !(spec.launch === undefined && roll > 0.7)) {
    const t = new Date(result.S[0].getTime() + days * DAY);
    sub.launchDate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  }
  const lastV = sub.versions[lastIdx];
  sub.dueAt = computeDueAt(result.S[lastIdx], expedited ? "expedited" : "standard", n > 1);

  for (const [k, v] of sub.versions.entries()) {
    v.createdAt = result.S[k];
    for (const f of v.findings) f.createdAt = f.source === "reviewer" ? result.S[k] : result.analysisAt[k];
    const role = roles[k];
    for (const a of acts[k]) {
      const f = a.finding;
      const at = result.actTimes.get(a)!;
      f.actedBy = reviewerOf(k);
      f.actedAt = at;
      if (a.kind === "added") {
        f.status = "accepted";
        f.createdAt = at;
      } else {
        f.status = a.kind;
        f.dismissReason = a.reason ?? null;
      }
    }
    for (const f of v.findings) {
      const at = result.resolvedAt.get(f);
      if (at) {
        f.status = "resolved";
        f.actedBy = null;
        f.actedAt = at;
      }
    }
    if (role === "cr" || role === "approved" || role === "rejected") {
      const outcome: Outcome = role === "approved" ? "approved" : role === "rejected" ? "rejected" : "changes_requested";
      const accepted = v.findings.filter((f) => acts[k].some((a) => a.finding === f && (a.kind === "accepted" || a.kind === "added")));
      const vs = spec.v[k];
      const note = vs.note ?? (outcome === "approved" ? null : "See the flagged items below.");
      sub.decisions.push({
        sub,
        version: v,
        reviewerId: reviewerOf(k)!,
        outcome,
        note,
        feedbackDraft: buildFeedback(spec.by, reviewerName(k), spec.title, outcome, accepted),
        createdAt: result.decisionAt[k]!,
        id: 0,
      });
    }
  }

  // Dismissed findings are no longer a live risk, so a current score reflects what is still standing.
  const liveRisk = computeRisk(lastV.findings.filter((f) => f.status !== "dismissed"), ctxBase, rate);
  sub.riskScore = liveRisk.score;
  sub.riskLevel = liveRisk.level;

  const finalRole = roles[lastIdx];
  const lastReviewerId = reviewerOf(lastIdx);
  sub.assigneeId = finalRole === "open" ? null : lastReviewerId;
  const lastDecision = sub.decisions[sub.decisions.length - 1];
  sub.decidedAt = spec.final === "approved" || spec.final === "rejected" ? lastDecision.createdAt : null;

  sub.events = result.events.map((e, i) => ({ sub, actorId: e.actorId, action: e.action, details: e.details, createdAt: e.at, seq: i, id: 0 }));
  return sub;
}

export async function buildHistoryPlan(now: Date, ids: PeopleIds = defaultPeopleIds()): Promise<HistoryPlan> {
  // Pass 1: partner rejection rates come straight from the specs' final statuses.
  const totals = new Map<number, { total: number; rejected: number }>();
  for (const spec of SPECS) {
    const u = USERS.find((x) => x.name === spec.by);
    if (!u?.partnerName) continue;
    const pid = ids.partners[u.partnerName];
    const t = totals.get(pid) ?? { total: 0, rejected: 0 };
    t.total++;
    if (spec.final === "rejected") t.rejected++;
    totals.set(pid, t);
  }
  const rates = new Map([...totals].map(([pid, t]) => [pid, t.rejected / t.total]));

  // Pass 2: realize each submission (analysis, lifecycle, timeline).
  const env: Env = { now, ids, rates };
  const subs: SubM[] = [];
  for (const [i, spec] of SPECS.entries()) subs.push(await realize(spec, i, env));

  // Ids and codes follow submission time, like a real system.
  subs.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime() || a.index - b.index);
  subs.forEach((s, i) => {
    s.id = i + 1;
    s.code = `CP-${1001 + i}`;
  });
  const versions = subs.flatMap((s) => s.versions).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.sub.id - b.sub.id);
  versions.forEach((v, i) => (v.id = i + 1));
  const findings = subs
    .flatMap((s) => s.versions.flatMap((v) => v.findings))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.version.sub.id - b.version.sub.id || a.version.number - b.version.number || a.order - b.order);
  findings.forEach((f, i) => (f.id = i + 1));
  const decisions = subs.flatMap((s) => s.decisions).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.sub.id - b.sub.id);
  decisions.forEach((d, i) => (d.id = i + 1));
  const events = subs.flatMap((s) => s.events).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.sub.id - b.sub.id || a.seq - b.seq);
  events.forEach((e, i) => (e.id = i + 1));

  return {
    submissions: subs.map((s) => {
      const spec = s.spec;
      return {
        id: s.id,
        code: s.code,
        title: spec.title,
        product: spec.product,
        channel: spec.channel,
        states: spec.states ?? [],
        launchDate: s.launchDate,
        priority: spec.pri ? "expedited" : "standard",
        priorityReason: spec.pri ?? null,
        notes: spec.notes ?? null,
        status: spec.final,
        submitterId: s.submitterId,
        partnerId: s.partnerId,
        assigneeId: s.assigneeId,
        currentVersion: s.versions.length,
        riskScore: s.riskScore,
        riskLevel: s.riskLevel,
        submittedAt: s.submittedAt,
        dueAt: s.dueAt,
        decidedAt: s.decidedAt,
        updatedAt: s.updatedAt,
      } satisfies SubmissionRow;
    }),
    versions: versions.map((v) => {
      const spec = v.sub.spec;
      const partnerName = USERS.find((u) => u.name === spec.by)?.partnerName ?? null;
      return {
        id: v.id,
        submissionId: v.sub.id,
        number: v.number,
        content: v.content,
        sourceUrl: spec.channel === "affiliate_page" && partnerName ? `https://${PARTNER_DOMAIN[partnerName]}/${slug(spec.title)}` : null,
        assetUrl: null,
        contentHash: createHash("sha256").update(v.content).digest("hex"),
        analysisStatus: v.analysisStatus,
        analysisSummary: v.summary,
        model: v.analysisStatus === "complete" ? "claude-opus-5-5" : null,
        createdBy: v.sub.submitterId,
        createdAt: v.createdAt,
      } satisfies VersionRow;
    }),
    findings: findings.map(
      (f) =>
        ({
          id: f.id,
          versionId: f.version.id,
          source: f.source,
          ruleCode: f.ruleCode,
          severity: f.severity,
          quote: f.quote,
          startOffset: f.start,
          endOffset: f.end,
          issue: f.issue,
          suggestion: f.suggestion,
          confidence: f.confidence,
          status: f.status,
          dismissReason: f.dismissReason,
          actedBy: f.actedBy,
          actedAt: f.actedAt,
          createdAt: f.createdAt,
        }) satisfies FindingRow,
    ),
    decisions: decisions.map(
      (d) =>
        ({
          id: d.id,
          submissionId: d.sub.id,
          versionId: d.version.id,
          reviewerId: d.reviewerId,
          outcome: d.outcome,
          note: d.note,
          feedbackDraft: d.feedbackDraft,
          createdAt: d.createdAt,
        }) satisfies DecisionRow,
    ),
    auditEvents: events.map(
      (e) =>
        ({
          id: e.id,
          submissionId: e.sub.id,
          actorId: e.actorId,
          action: e.action,
          details: e.details(),
          createdAt: e.createdAt,
        }) satisfies AuditRow,
    ),
  };
}

// ------------------------------------------------------------------ database

const CHUNK = 60;
const chunks = <T,>(rows: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

/**
 * Replaces all review activity (audit_events, decisions, findings, versions, submissions) with the
 * seeded history. Users, partners, rules and product facts are never touched. Delete, insert and
 * sequence reset run in one batch, which neon-http executes as a single transaction.
 */
export async function resetDemoData(
  now: Date = new Date(),
): Promise<{ submissions: number; versions: number; findings: number; decisions: number; auditEvents: number }> {
  const { db, tables } = await import("../db");
  const { sql } = await import("drizzle-orm");

  const [userRows, partnerRows] = await Promise.all([
    db.select({ id: tables.users.id, email: tables.users.email }).from(tables.users),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners),
  ]);
  const ids: PeopleIds = {
    users: Object.fromEntries(userRows.map((u) => [u.email, u.id])),
    partners: Object.fromEntries(partnerRows.map((p) => [p.name, p.id])),
  };
  const missing = [...USERS.map((u) => u.email).filter((e) => !(e in ids.users)), ...PARTNERS.map((p) => p.name).filter((n) => !(n in ids.partners))];
  if (missing.length) throw new Error(`Run scripts/seed-people.ts first; missing: ${missing.join(", ")}`);

  const plan = await buildHistoryPlan(now, ids);

  const stmts = [
    db.delete(tables.auditEvents),
    db.delete(tables.decisions),
    db.delete(tables.findings),
    db.delete(tables.versions),
    db.delete(tables.submissions),
    ...chunks(plan.submissions).map((c) => db.insert(tables.submissions).values(c)),
    ...chunks(plan.versions).map((c) => db.insert(tables.versions).values(c)),
    ...chunks(plan.findings).map((c) => db.insert(tables.findings).values(c)),
    ...chunks(plan.decisions).map((c) => db.insert(tables.decisions).values(c)),
    ...chunks(plan.auditEvents).map((c) => db.insert(tables.auditEvents).values(c)),
    ...(["submissions", "versions", "findings", "decisions", "audit_events"] as const).map((t) =>
      db.execute(sql.raw(`select setval(pg_get_serial_sequence('${t}','id'), (select coalesce(max(id),1) from ${t}))`)),
    ),
  ];
  await db.batch(stmts as unknown as [(typeof stmts)[0], ...(typeof stmts)[0][]]);

  return {
    submissions: plan.submissions.length,
    versions: plan.versions.length,
    findings: plan.findings.length,
    decisions: plan.decisions.length,
    auditEvents: plan.auditEvents.length,
  };
}
