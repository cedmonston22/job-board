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
  // @napi-rs/canvas added 2026-05-17 — pdfjs-dist needs it as a polyfill for
  // DOMMatrix/ImageData/Path2D in Node.js. Without it, server actions on
  // Vercel crash with "ReferenceError: DOMMatrix is not defined" the moment
  // any module transitively imports pdf-parse. Native module (.node binary),
  // so it must be external — Turbopack can't bundle native binaries.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],

  // Force @napi-rs/canvas into the Vercel lambda's traced file set.
  // serverExternalPackages above only tells Next "don't bundle this" — it
  // does NOT guarantee the package files are copied into the deployed
  // function. Vercel uses node-file-trace (nft) to decide what node_modules
  // make it into /var/task/, and nft can't see dynamic `try { require(...) }`
  // calls. pdfjs-dist loads @napi-rs/canvas exactly this way, so without an
  // explicit hint canvas gets silently stripped from the lambda — every
  // server action then crashes with "DOMMatrix is not defined" the moment a
  // bundle transitively imports pdf-parse. This config copies the canvas
  // package files into every server route's trace. The '/*' key matches all
  // routes (per Next 16 docs: outputFileTracingIncludes uses picomatch globs
  // against the route path).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@napi-rs/canvas/**/*"],
  },

  // Version-skew protection for server actions. Without this, when a user has
  // a stale tab open from an earlier deploy and submits a form, the action ID
  // in their HTML no longer matches anything the new build knows about → 404
  // on the action POST. With this set, Next.js compares the client's
  // deployment ID against the server's and forces a hard reload on mismatch
  // instead of silently 404'ing.
  //
  // Set conditionally so localhost prod builds (`npm run build && npm start`)
  // don't get `deploymentId: undefined`, which Next.js handles oddly —
  // injecting `?dpl=undefined` into asset URLs and breaking OAuth callback
  // matching among other things.
  ...(process.env.VERCEL_DEPLOYMENT_ID
    ? { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
    : {}),
};

export default nextConfig;
