/**
 * Pure helpers for uploaded ad files: type sniffing, size rules, and how a file's transcription and
 * the typed copy are combined into the one text that rules, AI quotes and highlights refer to.
 * No database or Node-only imports: the browser uses these too.
 */

export const ASSET_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number];

/** Hard cap per file after browser processing. Vercel rejects request bodies above 4.5 MB. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Images above this are downscaled and re-encoded in the browser before upload. */
export const REENCODE_ABOVE_BYTES = 1.5 * 1024 * 1024;
/** Longest side after downscaling. */
export const MAX_IMAGE_SIDE = 2000;
/** The API rejects images larger than this on either side, so these are always downscaled. */
export const API_MAX_IMAGE_SIDE = 8000;
export const ACCEPT_ATTR = ASSET_MEDIA_TYPES.join(",");

/**
 * Sits between the file's transcription and the submitter's typed copy in a version's `content`.
 * Kept on its own lines so it can never merge into a quoted sentence.
 */
export const COPY_SEPARATOR = "\n\n---------- Accompanying copy (typed by the submitter) ----------\n\n";

/** Identifies the real file type from its first bytes. The declared MIME type is never trusted. */
export function sniffMediaType(bytes: Uint8Array): AssetMediaType | null {
  const at = (sig: number[], offset = 0) => bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (at([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

export const isPdf = (t: string) => t === "application/pdf";

/** Problem with a file's size, or null when it is acceptable. */
export function sizeProblem(bytes: number, mediaType?: string): string | null {
  if (bytes <= 0) return "The file is empty.";
  if (bytes > MAX_FILE_BYTES) {
    return mediaType && isPdf(mediaType)
      ? `This PDF is ${formatBytes(bytes)}. PDFs are not compressed here and the limit is ${formatBytes(MAX_FILE_BYTES)}; export a smaller PDF or a screenshot of the ad.`
      : `This file is ${formatBytes(bytes)} after compression; the limit is ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

/** True when the browser should downscale and re-encode an image before upload. */
export function needsReencode(bytes: number, width: number, height: number): boolean {
  return bytes > REENCODE_ABOVE_BYTES || Math.max(width, height) > API_MAX_IMAGE_SIDE;
}

/** Target size that keeps the aspect ratio with the long side at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** Strips any path, control characters and odd punctuation; keeps it short. */
export function safeFilename(name: string, mediaType: AssetMediaType): string {
  const base = [...(name.split(/[\\/]/).pop() ?? "").normalize("NFC")]
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f && !'"<>|*?:'.includes(c))
    .join("")
    .trim()
    .slice(0, 120);
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" }[mediaType];
  return base || `upload.${ext}`;
}

/**
 * The text a version is analysed as: the file's transcription, then (if any) the separator and the
 * typed copy. Text-only assets are just the typed text.
 */
export function buildCombinedContent(transcription: string | null, typed: string, hasFile: boolean): string {
  const t = typed.trim();
  if (!hasFile) return t;
  // A file that spells out the separator must not be able to shift where the typed copy appears to start.
  const x = (transcription ?? "").split(COPY_SEPARATOR).join("\n\n").trim();
  if (!t) return x;
  return `${x}${COPY_SEPARATOR}${t}`;
}

export interface ContentParts {
  /** Text read from the file, with its offset in the combined content (always 0). */
  transcription: { text: string; start: number } | null;
  /** The submitter's typed copy, with its offset in the combined content. */
  typed: { text: string; start: number } | null;
}

/** Inverse of buildCombinedContent for a version known to have a file. */
export function splitCombinedContent(content: string, hasFile: boolean): ContentParts {
  if (!hasFile) return { transcription: null, typed: content ? { text: content, start: 0 } : null };
  const i = content.indexOf(COPY_SEPARATOR);
  if (i === -1) return { transcription: { text: content, start: 0 }, typed: null };
  const start = i + COPY_SEPARATOR.length;
  return { transcription: { text: content.slice(0, i), start: 0 }, typed: { text: content.slice(start), start } };
}

/** Content-Disposition value that is safe for any filename. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * A finding's offsets relative to one part of the combined content, or null when the span does not
 * lie inside it. A span that runs across the separator is clipped to the part.
 */
export function spanInPart(
  span: { start: number | null; end: number | null },
  part: { text: string; start: number } | null,
): { start: number; end: number } | null {
  if (!part || span.start === null || span.end === null) return null;
  const s = Math.max(span.start - part.start, 0);
  const e = Math.min(span.end - part.start, part.text.length);
  return e > s ? { start: s, end: e } : null;
}

/** Whether an analysis result's content starts with a file transcription (pre-check results carry no asset info). */
export function resultHasFilePart(r: { extractedText: string | null; content: string }): boolean {
  return r.extractedText !== null || r.content.startsWith(COPY_SEPARATOR);
}
