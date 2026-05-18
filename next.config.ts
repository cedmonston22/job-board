import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 is built on pdfjs-dist, which dynamically loads a worker
  // file (`pdf.worker.mjs`) relative to its own location at runtime. Next.js's
  // bundler relocates the main `pdf.mjs` into `.next/dev/server/...` but
  // doesn't move the worker, so pdfjs-dist throws "Setting up fake worker
  // failed: Cannot find module .../pdf.worker.mjs".
  //
  // The fix is to mark pdf-parse (and its pdfjs-dist dep) as external — Next.js
  // then leaves them in `node_modules/` and `require()`s them at runtime, where
  // the file structure is intact and the worker can be found.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // Version-skew protection for server actions. Without this, when a user has
  // a stale tab open from an earlier deploy and submits a form, the action ID
  // in their HTML no longer matches anything the new build knows about → 404
  // on the action POST (the resume-upload bug from 2026-05-17). With this
  // set, Next.js compares the client's deployment ID against the server's;
  // on mismatch it forces a hard reload instead of silently 404'ing.
  // VERCEL_DEPLOYMENT_ID is auto-injected by Vercel per deploy; falls back to
  // undefined on localhost (single build, no skew possible).
  // Belt-and-suspenders with Vercel's project-level "Skew Protection"
  // toggle, which routes stale requests back to the originating deploy and
  // avoids the reload entirely.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
};

export default nextConfig;
