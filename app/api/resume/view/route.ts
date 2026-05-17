// Streams the current user's resume blob from Vercel Blob through our server.
//
// Why a route handler instead of a direct blob URL?
//   - We store resumes with `access: "private"`, so the blob URL isn't directly
//     fetchable by the browser. Only requests made via the @vercel/blob SDK
//     (which carries the BLOB_READ_WRITE_TOKEN) can read it.
//   - Funnelling through here lets us re-check auth on every access. A leaked
//     blob URL still isn't usable; only a signed-in session can fetch the file.
//
// The handler is a small adapter: auth → look up the row → ask the SDK for a
// stream → pipe it back to the browser with the correct Content-Type.

import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resume = await prisma.resume.findUnique({
    where: { userId: session.user.id },
    select: { fileUrl: true, fileName: true, fileMimeType: true },
  });
  if (!resume) {
    return new NextResponse("No resume found", { status: 404 });
  }

  try {
    const result = await get(resume.fileUrl, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Strip non-ASCII bytes from the filename for the Content-Disposition
    // header — older browsers / proxies choke on extended characters. The
    // file's actual name in our DB is preserved for display.
    const safeName = resume.fileName.replace(/[^\x20-\x7e]/g, "_");

    return new Response(result.stream, {
      headers: {
        "Content-Type": resume.fileMimeType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        // No caching — the URL is always "/api/resume/view" but the bytes
        // behind it change on re-upload. Letting browsers cache would serve
        // stale files after a replace.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Resume fetch failed:", err);
    return new NextResponse("Failed to load resume", { status: 500 });
  }
}
