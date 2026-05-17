// Pure text-extraction utility. Given a file's bytes + MIME type, returns
// plain text. Used by `uploadResume` to populate `Resume.extractedText`,
// which Phase 4/5 AI features read directly.
//
// Three formats supported:
//   - PDF  → pdf-parse (extracts the text layer if present)
//   - DOCX → mammoth   (Office Open XML → text)
//   - TXT  → utf-8 decode (no library needed)
//
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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
      // pdf-parse v2 wants a Uint8Array. Buffer extends Uint8Array so the
      // copy is cheap, but explicit conversion keeps the types clean.
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        // Frees pdfjs-dist internal resources (workers, etc.).
        await parser.destroy();
      }
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
