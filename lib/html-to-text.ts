// Quick-and-dirty HTML stripper. Used by every scraper adapter that returns
// HTML descriptions (Greenhouse, Ashby, RemoteOK, Simplify, vansh) and the
// URL-autofill pipeline in app/actions/jobs.ts.
//
// NOT a real HTML parser — it's a regex chain that handles the 95% case:
// strip script/style/comments, drop all tags, decode a handful of common
// entities, collapse whitespace. For job-posting descriptions this is fine;
// for arbitrary user-submitted HTML it'd be unsafe.

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
