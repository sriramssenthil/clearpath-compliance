import { fitWithin, isPdf, MAX_FILE_BYTES, MAX_IMAGE_SIDE, needsReencode, sizeProblem, sniffMediaType, type AssetMediaType } from "@/lib/workflow/assets";

export interface PreparedFile {
  file: File;
  /** Object URL for the thumbnail; revoke when the file is removed. */
  previewUrl: string;
  mediaType: AssetMediaType;
  /** Size before browser processing, when it changed. */
  originalBytes?: number;
  /** Shown under the file name, e.g. "Resized from 4800 x 3200 to fit the upload limit". */
  note?: string;
}

export type PrepareResult = { ok: true; file: PreparedFile } | { ok: false; error: string };

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Validates a picked, dropped or pasted file and, for large images, downscales (long side at most
 * 2000 px) and re-encodes it as WebP (JPEG where WebP encoding is unavailable) so it fits the upload
 * limit. PDFs are never re-encoded. The server re-checks type (by magic bytes) and size regardless.
 */
export async function prepareFile(input: File): Promise<PrepareResult> {
  // Same rule as the server: the bytes decide the type, not the file name or the browser's guess.
  let declared: AssetMediaType | null = null;
  try {
    declared = sniffMediaType(new Uint8Array(await input.slice(0, 16).arrayBuffer()));
  } catch {
    /* unreadable: handled below */
  }
  if (!declared) return { ok: false, error: "That file type is not supported. Upload a PNG, JPEG, WebP or GIF image, or a PDF." };

  if (isPdf(declared)) {
    const problem = sizeProblem(input.size, declared);
    return problem ? { ok: false, error: problem } : { ok: true, file: { file: input, previewUrl: URL.createObjectURL(input), mediaType: declared } };
  }

  let img;
  try {
    img = await decode(input);
  } catch {
    return { ok: false, error: "This image could not be opened. It may be damaged; try exporting it again." };
  }
  try {
    if (!needsReencode(input.size, img.width, img.height)) {
      const problem = sizeProblem(input.size, declared);
      return problem ? { ok: false, error: problem } : { ok: true, file: { file: input, previewUrl: URL.createObjectURL(input), mediaType: declared } };
    }
    const size = fitWithin(img.width, img.height, MAX_IMAGE_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const g = canvas.getContext("2d");
    if (!g) return { ok: false, error: "Your browser could not resize this image. Upload a smaller file (under 4 MB)." };
    g.imageSmoothingQuality = "high";
    g.drawImage(img.source, 0, 0, size.width, size.height);

    let blob = await encode(canvas, "image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") {
      // JPEG has no transparency: paint a white background under the image first.
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, size.width, size.height);
      blob = await encode(canvas, "image/jpeg", 0.85);
    }
    if (blob && blob.size > MAX_FILE_BYTES) blob = await encode(canvas, blob.type, 0.7);
    if (!blob) return { ok: false, error: "Your browser could not compress this image. Upload a smaller file (under 4 MB)." };
    const problem = sizeProblem(blob.size, blob.type);
    if (problem) return { ok: false, error: problem };

    const type = blob.type as AssetMediaType;
    const ext = type === "image/webp" ? "webp" : "jpg";
    const name = `${input.name.replace(/\.[a-z0-9]+$/i, "") || "image"}.${ext}`;
    const file = new File([blob], name, { type });
    const resized = size.width !== img.width || size.height !== img.height;
    return {
      ok: true,
      file: {
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: type,
        originalBytes: input.size,
        note: resized
          ? `Resized from ${img.width} x ${img.height} to ${size.width} x ${size.height} px and compressed to fit the upload limit.`
          : "Compressed to fit the upload limit.",
      },
    };
  } finally {
    img.close();
  }
}

/** The file wrapped for a server action (sent as binary, not base64). */
export function toFormData(f: PreparedFile | null): FormData | null {
  if (!f) return null;
  const fd = new FormData();
  fd.append("file", f.file, f.file.name);
  return fd;
}

/** Changes whenever a different file is attached; used to mark a pre-check result out of date. */
export const fileKey = (f: PreparedFile | null) => (f ? `${f.file.name}:${f.file.size}:${f.file.lastModified}` : "");
