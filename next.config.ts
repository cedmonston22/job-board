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
};

export default nextConfig;
