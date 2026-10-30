/** Pure helpers for the version diff. The `diff` package supplies the parts; counting and wording live here. */

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function diffStats(parts: DiffPart[]): DiffStats {
  const s: DiffStats = { added: 0, removed: 0, unchanged: 0 };
  for (const p of parts) {
    const n = countWords(p.value);
    if (p.added) s.added += n;
    else if (p.removed) s.removed += n;
    else s.unchanged += n;
  }
  return s;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "23 words added, 41 removed; 3 earlier findings resolved" */
export function diffSummary(stats: DiffStats, resolvedFindings: number): string {
  if (stats.added === 0 && stats.removed === 0) return "No text changes between these versions.";
  const base = `${plural(stats.added, "word", "words")} added, ${stats.removed} removed`;
  return `${base}; ${plural(resolvedFindings, "earlier finding", "earlier findings")} resolved`;
}
