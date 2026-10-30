import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Every page behind the app shell depends on the signed-in demo user (a cookie), so none of it can
  // be prerendered. Without this, dev mode warns about "instant navigation" on every route.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
    // Uploaded ad files travel through server actions: 4 MB per file (enforced in lib/workflow/assets.ts)
    // plus multipart overhead and the form fields. Stays under Vercel's 4.5 MB request body limit.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
