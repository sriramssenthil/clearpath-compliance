import { connection } from "next/server";
import { ASSET_MEDIA_TYPES, contentDisposition, type AssetMediaType } from "@/lib/workflow/assets";
import type { Actor } from "@/lib/workflow/types";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/**
 * Serves an uploaded ad file to someone allowed to see a submission that uses it. Everything else,
 * including signed-out requests and assets not linked to any version, gets the same 404.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id: raw } = await ctx.params;
  if (!/^\d{1,9}$/.test(raw)) return notFound();

  // Imported lazily so a missing DATABASE_URL cannot break the build.
  const [{ currentActor }, { getViewableAsset }] = await Promise.all([import("@/lib/workflow/action-helpers"), import("@/lib/workflow/queries")]);
  let actor: Actor;
  try {
    actor = await currentActor();
  } catch {
    // Signed out: currentActor() redirects to the landing page; an API route answers 404 instead.
    return notFound();
  }

  const asset = await getViewableAsset(actor, Number(raw));
  if (!asset || !(ASSET_MEDIA_TYPES as readonly string[]).includes(asset.mediaType)) return notFound();

  const body = Buffer.from(asset.dataBase64, "base64");
  return new Response(body, {
    headers: {
      "Content-Type": asset.mediaType as AssetMediaType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": contentDisposition(asset.filename),
      "Cache-Control": "private, max-age=3600",
      // Switching account in the same browser must not reuse another user's cached copy.
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      // Images opened directly can never run script. Not applied to PDFs: browsers refuse to render a sandboxed PDF.
      ...(asset.mediaType === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
