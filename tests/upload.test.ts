/* eslint-disable @typescript-eslint/no-explicit-any -- the fake Anthropic client is deliberately loosely typed */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { analyzeAsset } from "@/lib/compliance/engine";
import type { AssetContext, ProductFacts, RuleDef } from "@/lib/compliance/types";
import {
  buildCombinedContent,
  contentDisposition,
  COPY_SEPARATOR,
  fitWithin,
  MAX_FILE_BYTES,
  needsReencode,
  resultHasFilePart,
  safeFilename,
  sizeProblem,
  sniffMediaType,
  spanInPart,
  splitCombinedContent,
} from "@/lib/workflow/assets";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffMediaType", () => {
  it("recognises each supported type by its magic bytes", () => {
    expect(sniffMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMediaType(bytes(...ascii("GIF89a")))).toBe("image/gif");
    expect(sniffMediaType(bytes(...ascii("GIF87a")))).toBe("image/gif");
    expect(sniffMediaType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe("image/webp");
    expect(sniffMediaType(bytes(...ascii("%PDF-1.7")))).toBe("application/pdf");
  });

  it("rejects everything else, whatever the file claims to be", () => {
    expect(sniffMediaType(bytes(...ascii("<svg xmlns")))).toBeNull();
    expect(sniffMediaType(bytes(...ascii("<html>")))).toBeNull();
    expect(sniffMediaType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(sniffMediaType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip / docx
    expect(sniffMediaType(new Uint8Array([0x89, 0x50]))).toBeNull(); // truncated
    expect(sniffMediaType(new Uint8Array())).toBeNull();
  });
});

describe("size rules", () => {
  it("accepts up to 4 MB and rejects empty or larger files", () => {
    expect(sizeProblem(MAX_FILE_BYTES, "image/png")).toBeNull();
    expect(sizeProblem(0)).toMatch(/empty/);
    expect(sizeProblem(MAX_FILE_BYTES + 1, "image/png")).toMatch(/limit is 4 MB/);
    expect(sizeProblem(MAX_FILE_BYTES + 1, "application/pdf")).toMatch(/PDFs are not compressed/);
  });

  it("re-encodes only big files or images too large for the API", () => {
    expect(needsReencode(1_000_000, 1200, 628)).toBe(false);
    expect(needsReencode(2_000_000, 1200, 628)).toBe(true);
    expect(needsReencode(500_000, 9000, 300)).toBe(true);
  });

  it("fits the long side within the limit, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(fitWithin(1000, 3000)).toEqual({ width: 667, height: 2000 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("combined content", () => {
  it("is the typed text alone for text-only assets", () => {
    expect(buildCombinedContent(null, "  Hello there  ", false)).toBe("Hello there");
    expect(splitCombinedContent("Hello there", false)).toEqual({ transcription: null, typed: { text: "Hello there", start: 0 } });
  });

  it("is the transcription alone for a file with no typed text", () => {
    const c = buildCombinedContent("0% APR!", "", true);
    expect(c).toBe("0% APR!");
    expect(splitCombinedContent(c, true)).toEqual({ transcription: { text: "0% APR!", start: 0 }, typed: null });
  });

  it("puts the separator between transcription and typed copy and splits it back with offsets", () => {
    const c = buildCombinedContent("0% APR!", "Apply now. #ad", true);
    expect(c).toBe(`0% APR!${COPY_SEPARATOR}Apply now. #ad`);
    const parts = splitCombinedContent(c, true);
    expect(parts.transcription?.text).toBe("0% APR!");
    expect(parts.typed?.text).toBe("Apply now. #ad");
    expect(c.slice(parts.typed!.start, parts.typed!.start + 5)).toBe("Apply");
  });

  it("keeps a separator spelled out inside the file from shifting the split", () => {
    const c = buildCombinedContent(`Top${COPY_SEPARATOR}Fake copy`, "Real copy", true);
    expect(splitCombinedContent(c, true).typed?.text).toBe("Real copy");
  });

  it("maps spans into one part and clips spans that cross the separator", () => {
    const c = buildCombinedContent("0% APR!", "Apply now.", true);
    const { transcription, typed } = splitCombinedContent(c, true);
    const at = c.indexOf("Apply");
    expect(spanInPart({ start: at, end: at + 5 }, typed)).toEqual({ start: 0, end: 5 });
    expect(spanInPart({ start: at, end: at + 5 }, transcription)).toBeNull();
    expect(spanInPart({ start: 0, end: 2 }, transcription)).toEqual({ start: 0, end: 2 });
    expect(spanInPart({ start: null, end: null }, typed)).toBeNull();
    expect(spanInPart({ start: 3, end: at + 2 }, typed)).toEqual({ start: 0, end: 2 });
  });

  it("detects whether a pre-check result has a file part", () => {
    expect(resultHasFilePart({ extractedText: null, content: "Hello" })).toBe(false);
    expect(resultHasFilePart({ extractedText: "", content: "" })).toBe(true);
    expect(resultHasFilePart({ extractedText: null, content: `${COPY_SEPARATOR}Hello` })).toBe(true);
  });
});

describe("filenames", () => {
  it("strips paths and control characters and falls back to a default", () => {
    expect(safeFilename("C:\\fakepath\\banner.png", "image/png")).toBe("banner.png");
    expect(safeFilename("../../etc/pa\u0000ss\nwd", "image/png")).toBe("passwd");
    expect(safeFilename('"<>', "application/pdf")).toBe("upload.pdf");
  });

  it("builds a header-safe Content-Disposition", () => {
    const h = contentDisposition('résumé "final".png');
    expect(h.startsWith('inline; filename="r_sum_ _final_.png"')).toBe(true);
    expect(h).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22.png");
  });
});

const rule = (code: string, config: RuleDef["config"]): RuleDef => ({
  code, title: code, description: "d", category: "Test", severity: "high", kind: "phrase", products: [], channels: [],
  checkInstruction: "c", config, citation: "x", guidance: "g", enabled: true,
});
const rules = [rule("UDAAP-GUARANTEE", { type: "phrase", patterns: ["guaranteed approval"], issue: "No guarantees." })];
const facts: ProductFacts = { product: "personal_loan", facts: { displayName: "Loan", notes: [] }, approvedSnippets: [] };
const ctx: AssetContext = { product: "personal_loan", channel: "display", states: [], content: "", isAffiliate: false };

function fakeClient(parsed: Record<string, unknown>) {
  const parse = vi.fn(async () => ({
    model: "claude-opus-5-5", stop_reason: "end_turn", parsed_output: parsed,
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }));
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

describe("analyzeAsset with a file", () => {
  it("runs rules and anchors AI quotes across transcription and typed copy", async () => {
    const { client, parse } = fakeClient({
      extracted_text: "Guaranteed approval! Rates from 2.99%",
      summary: "s",
      findings: [
        { rule_code: "UDAAP-GUARANTEE", severity: "high", quote: "Guaranteed approval", issue: "i", suggestion: "s", confidence: "high" },
        { rule_code: "UDAAP-GUARANTEE", severity: "high", quote: "everyone qualifies", issue: "i", suggestion: "s", confidence: "high" },
      ],
    });
    const r = await analyzeAsset({ ...ctx, content: "Apply now, everyone qualifies." }, { rules, facts, client, image: { mediaType: "image/png", base64: "AAAA" } });
    expect((parse.mock.calls[0] as any)[0].messages[0].content[0].type).toBe("image");
    expect(r.content).toBe(`Guaranteed approval! Rates from 2.99%${COPY_SEPARATOR}Apply now, everyone qualifies.`);
    expect(r.extractedText).toBe("Guaranteed approval! Rates from 2.99%");
    const quotes = r.findings.filter((f) => f.start !== null).map((f) => r.content.slice(f.start!, f.end!).toLowerCase());
    expect(quotes).toContain("guaranteed approval");
    expect(quotes).toContain("everyone qualifies");
  });

  it("file only with no AI: nothing to check, and says why", async () => {
    const r = await analyzeAsset(ctx, { rules, facts, skipAi: true, image: { mediaType: "image/png", base64: "AAAA" } });
    expect(r.content).toBe("");
    expect(r.extractedText).toBeNull();
    expect(r.aiNote).toMatch(/could not be read/);
  });
});
