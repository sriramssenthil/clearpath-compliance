import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CHANNELS, PRODUCTS, RULE_CODES } from "@/lib/compliance/types";
import { EXAMPLE_ASSETS } from "@/lib/seed/examples";
import type { EvalCase } from "@/evals/types";

const codeEnum = z.enum(RULE_CODES);
const caseSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    product: z.enum(PRODUCTS),
    channel: z.enum(CHANNELS),
    states: z.array(z.string().length(2)),
    isAffiliate: z.boolean(),
    content: z.string().min(1),
    expectedRuleCodes: z.array(codeEnum),
    mustNotFlag: z.array(codeEnum).optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

const casesDir = path.join(__dirname, "..", "evals", "cases");
const files = fs.readdirSync(casesDir).filter((f) => f.endsWith(".json")).sort();
const cases: { file: string; data: EvalCase }[] = files.map((file) => ({
  file,
  data: caseSchema.parse(JSON.parse(fs.readFileSync(path.join(casesDir, file), "utf8"))) as EvalCase,
}));

describe("example assets", () => {
  it("has the eight expected examples (two of them images) with unique ids", () => {
    expect(EXAMPLE_ASSETS).toHaveLength(8);
    expect(EXAMPLE_ASSETS.filter((e) => e.image)).toHaveLength(2);
    const ids = EXAMPLE_ASSETS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses valid codes, products, channels and non-empty content", () => {
    for (const e of EXAMPLE_ASSETS) {
      if (e.image) expect(fs.existsSync(path.join(__dirname, "..", "public", e.image.src)), e.id).toBe(true);
      else expect(e.content.trim().length, e.id).toBeGreaterThan(0);
      expect(e.title.trim().length, e.id).toBeGreaterThan(0);
      expect(PRODUCTS).toContain(e.product);
      expect(CHANNELS).toContain(e.channel);
      for (const code of e.expectedRuleCodes) expect(RULE_CODES, e.id).toContain(code);
    }
  });

  it("keeps the clean example free of expected findings", () => {
    expect(EXAMPLE_ASSETS.find((e) => e.id === "clean-loan-display")?.expectedRuleCodes).toEqual([]);
  });
});

describe("eval cases", () => {
  it("has 24 cases that parse into the EvalCase shape", () => {
    expect(cases).toHaveLength(24);
  });

  it("has unique ids that match filenames", () => {
    const ids = cases.map((c) => c.data.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of cases) expect(`${c.data.id}.json`).toBe(c.file);
  });

  it("covers every rule code at least once", () => {
    const covered = new Set(cases.flatMap((c) => c.data.expectedRuleCodes));
    const missing = RULE_CODES.filter((code) => !covered.has(code));
    expect(missing).toEqual([]);
  });

  it("covers the critical codes at least twice", () => {
    for (const code of ["UDAAP-GUARANTEE", "REGZ-24-APR", "REGZ-16-TRIGGER", "FCRA-PREQUAL", "FTC-AFFILIATE", "SEC-INJECTION"] as const) {
      const n = cases.filter((c) => c.data.expectedRuleCodes.includes(code)).length;
      expect(n, code).toBeGreaterThanOrEqual(2);
    }
  });

  it("has clean controls with no expected codes and no overlap with mustNotFlag", () => {
    const clean = cases.filter((c) => c.data.id.split("-")[1] === "clean");
    expect(clean.length).toBe(6);
    for (const c of clean) expect(c.data.expectedRuleCodes, c.file).toEqual([]);
    for (const c of cases) {
      for (const code of c.data.mustNotFlag ?? []) expect(c.data.expectedRuleCodes, c.file).not.toContain(code);
    }
  });

  it("explains every hard case", () => {
    for (const c of cases.filter((x) => x.data.id.split("-")[1] === "hard")) {
      expect(c.data.notes, c.file).toBeTruthy();
    }
  });
});
