import { describe, expect, it } from "vitest";
import { appendText, buildSegments, replaceQuote, sortByPosition, validSpan, wordCount, type Locatable } from "@/components/submit/segments";

const f = (start: number | null, end: number | null, severity: Locatable["severity"] = "medium"): Locatable => ({ start, end, severity });

describe("buildSegments", () => {
  it("returns one plain segment when there are no findings", () => {
    expect(buildSegments("hello world", [])).toEqual([{ text: "hello world", start: 0, end: 11, ids: [], severity: null }]);
  });

  it("returns nothing for empty content", () => {
    expect(buildSegments("", [f(0, 3)])).toEqual([]);
  });

  it("splits around a single finding and reassembles to the original text", () => {
    const content = "Get guaranteed approval today";
    const segs = buildSegments(content, [f(4, 23, "high")]);
    expect(segs.map((s) => s.text)).toEqual(["Get ", "guaranteed approval", " today"]);
    expect(segs[1]).toMatchObject({ ids: [0], severity: "high" });
    expect(segs.map((s) => s.text).join("")).toBe(content);
  });

  it("handles adjacent findings without a gap", () => {
    const segs = buildSegments("aabb", [f(0, 2, "low"), f(2, 4, "high")]);
    expect(segs.map((s) => [s.text, s.ids, s.severity])).toEqual([
      ["aa", [0], "low"],
      ["bb", [1], "high"],
    ]);
  });

  it("shares overlapping stretches and uses the highest severity there", () => {
    const content = "0123456789";
    const segs = buildSegments(content, [f(1, 6, "low"), f(4, 9, "high")]);
    expect(segs.map((s) => [s.text, s.ids, s.severity])).toEqual([
      ["0", [], null],
      ["123", [0], "low"],
      ["45", [0, 1], "high"],
      ["678", [1], "high"],
      ["9", [], null],
    ]);
    expect(segs.map((s) => s.text).join("")).toBe(content);
  });

  it("handles a finding fully nested inside another", () => {
    const segs = buildSegments("abcdefgh", [f(0, 8, "low"), f(2, 4, "medium")]);
    expect(segs.map((s) => [s.text, s.ids])).toEqual([
      ["ab", [0]],
      ["cd", [0, 1]],
      ["efgh", [0]],
    ]);
  });

  it("merges identical duplicates into one segment listing both ids", () => {
    const segs = buildSegments("abcd", [f(1, 3, "low"), f(1, 3, "high")]);
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ text: "bc", ids: [0, 1], severity: "high" });
  });

  it("ignores null offsets, empty spans and spans past the end", () => {
    const segs = buildSegments("abcdef", [f(null, null), f(2, 2), f(4, null), f(5, 99, "high")]);
    expect(segs.map((s) => [s.text, s.ids])).toEqual([
      ["abcde", []],
      ["f", [3]],
    ]);
  });

  it("clamps negative and reversed offsets", () => {
    expect(validSpan("abc", f(-5, 2))).toEqual({ start: 0, end: 2 });
    expect(validSpan("abc", f(3, 1))).toBeNull();
  });

  it("uses UTF-16 offsets and never splits a surrogate pair", () => {
    const content = "Save 💰 now: guaranteed 🎉 approval";
    const start = content.indexOf("guaranteed");
    const end = start + "guaranteed 🎉".length;
    const segs = buildSegments(content, [f(start, end, "high")]);
    expect(segs[1].text).toBe("guaranteed 🎉");
    // An offset pointing at the low surrogate of the first emoji is moved off the pair.
    const mid = content.indexOf("💰") + 1;
    const snapped = buildSegments(content, [f(mid, mid + 2, "low")]);
    expect(snapped.map((s) => s.text).join("")).toBe(content);
    expect(snapped.every((s) => !/^[\udc00-\udfff]/.test(s.text) && !/[\ud800-\udbff]$/.test(s.text))).toBe(true);
  });

  it("handles combining characters and CJK text by index", () => {
    const content = "café 低金利 ローン";
    const start = content.indexOf("低金利");
    const segs = buildSegments(content, [f(start, start + 3)]);
    expect(segs[1].text).toBe("低金利");
  });
});

describe("sortByPosition", () => {
  it("orders by start then severity and puts unlocated findings last", () => {
    const items = [
      { ...f(null, null, "high"), n: "unlocated" },
      { ...f(10, 12, "low"), n: "late" },
      { ...f(2, 5, "low"), n: "early-low" },
      { ...f(2, 6, "high"), n: "early-high" },
    ];
    expect(sortByPosition(items).map((i) => i.n)).toEqual(["early-high", "early-low", "late", "unlocated"]);
  });

  it("does not mutate its input", () => {
    const items = [f(5, 6), f(1, 2)];
    sortByPosition(items);
    expect(items[0].start).toBe(5);
  });
});

describe("replaceQuote", () => {
  it("replaces only the first occurrence and reports the inserted range", () => {
    const r = replaceQuote("no fees. no fees!", "no fees", "no annual fee");
    expect(r).toEqual({ text: "no annual fee. no fees!", start: 0, end: 13 });
  });

  it("falls back to a case-insensitive match", () => {
    expect(replaceQuote("Guaranteed Approval!", "guaranteed approval", "Apply today")?.text).toBe("Apply today!");
  });

  it("returns null when the quote is gone or empty", () => {
    expect(replaceQuote("abc", "xyz", "q")).toBeNull();
    expect(replaceQuote("abc", "", "q")).toBeNull();
  });

  it("is not tripped by replacement text containing $ patterns", () => {
    expect(replaceQuote("pay $199", "$199", "$1 and $& more")?.text).toBe("pay $1 and $& more");
  });

  it("works with unicode on both sides", () => {
    const r = replaceQuote("Ahorra 💰 hoy", "💰", "dinero");
    expect(r?.text).toBe("Ahorra dinero hoy");
    expect(r?.start).toBe(7);
  });
});

describe("appendText", () => {
  it("adds a new paragraph after trimming trailing whitespace", () => {
    const r = appendText("Body copy.  \n\n", "Equal Housing Lender.");
    expect(r.text).toBe("Body copy.\n\nEqual Housing Lender.");
    expect(r.text.slice(r.start, r.end)).toBe("Equal Housing Lender.");
  });

  it("does not add leading blank lines to empty text", () => {
    expect(appendText("  ", "Hello").text).toBe("Hello");
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated words", () => {
    expect(wordCount("  one two\nthree  ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
