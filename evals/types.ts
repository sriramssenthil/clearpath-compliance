import type { Channel, Product, RuleCode } from "@/lib/compliance/types";

export interface EvalCase {
  id: string;
  description: string;
  product: Product;
  channel: Channel;
  states: string[];
  isAffiliate: boolean;
  content: string;
  /** Only rule codes that genuinely apply per the catalog. Empty = a clean control. */
  expectedRuleCodes: RuleCode[];
  /** Codes that must NOT be flagged (false-positive traps). */
  mustNotFlag?: RuleCode[];
  /** Why the label is defensible, for tricky or ambiguous cases. */
  notes?: string;
}
