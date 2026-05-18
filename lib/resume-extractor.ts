// Pure text-extraction utility. Given a file's bytes + MIME type, returns
// plain text. Used by `uploadResume` to populate `Resume.extractedText`,
// which Phase 4/5 AI features read directly.
//
// Three formats supported:
//   - PDF  → unpdf (serverless-friendly pdfjs build, no native deps)
//   - DOCX → mammoth   (Office Open XML → text)
//   - TXT  → utf-8 decode (no library needed)
//
// We switched from pdf-parse → unpdf on 2026-05-18 because pdf-parse pulls
// in pdfjs-dist, which needs the native @napi-rs/canvas package as a
// polyfill for DOMMatrix/ImageData/Path2D. That native binary kept failing
// to ship into Vercel's lambda (node-file-trace can't see dynamic requires
// + npm's optional-deps bug with cross-platform lockfiles), crashing every
// server action with "DOMMatrix is not defined" on prod. unpdf bundles a
// serverless-stripped pdfjs build with no canvas dependency at all.
//
import mammoth from "mammoth";
import { extractText } from "unpdf";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";

export type ExtractionResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  try {
    let text: string;

    if (mimeType === PDF_MIME) {
      // unpdf takes a Uint8Array; Buffer extends Uint8Array so the cast is
      // free. `mergePages: true` returns a single concatenated string
      // instead of an array of per-page strings — what we want for a resume
      // (no need to preserve page boundaries for downstream LLM use).
      const result = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });
      text = result.text;
    } else if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimeType === TXT_MIME) {
      text = buffer.toString("utf-8");
    } else {
      return { ok: false, error: `Unsupported file type: ${mimeType}` };
    }

    // Normalize whitespace. PDFs in particular love to insert random line
    // breaks mid-word; collapsing runs of whitespace gives the LLM cleaner text.
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    if (text.length === 0) {
      return {
        ok: false,
        error:
          "No text could be extracted. The file may be a scanned image (no text layer) or empty.",
      };
    }

    return { ok: true, text };
  } catch (err) {
    console.error("Resume extraction failed:", err);
    return {
      ok: false,
      error:
        "Couldn't read this file — it may be corrupted or password-protected.",
    };
  }
}
