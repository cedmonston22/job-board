import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
