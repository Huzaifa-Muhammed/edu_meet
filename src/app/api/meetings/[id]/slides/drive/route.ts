export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { meetingsService } from "@/server/services/meetings.service";
import { fail } from "@/server/utils/response";
import { forbidden, badRequest } from "@/server/utils/errors";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

/** Pull a Google Drive file id out of the various share-link shapes. */
function driveFileId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const byParam = u.searchParams.get("id");
    if (byParam) return byParam;
    const m = u.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
  } catch {
    // not a URL
  }
  return null;
}

/** Sniff a content type from the file's leading magic bytes. Drive frequently
 *  serves uploaded files as application/octet-stream, so we can't trust the
 *  header — the bytes are authoritative. Returns null if unrecognised. */
function sniffContentType(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 16));
  // %PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return "application/pdf";
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  // RIFF....WEBP
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

/** Fetch a public Drive file's bytes server-side (no CORS), handling Google's
 *  large-file "confirm" interstitial. Returns null if it can't get binary. */
async function fetchDriveBytes(
  fileId: string,
): Promise<{ buf: ArrayBuffer; contentType: string } | null> {
  const base = "https://drive.usercontent.google.com/download";
  let url = `${base}?id=${fileId}&export=download&confirm=t`;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, { redirect: "follow" });
      const ct = res.headers.get("content-type") ?? "";

      if (!ct.includes("text/html")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) return null;
        return { buf, contentType: ct || "application/octet-stream" };
      }

      // Interstitial HTML — dig out the confirm token and retry once.
      const html = await res.text();
      const token =
        html.match(/confirm=([0-9A-Za-z_-]+)/)?.[1] ??
        html.match(/name="confirm"\s+value="([^"]+)"/)?.[1];
      const uuid = html.match(/name="uuid"\s+value="([^"]+)"/)?.[1];
      if (!token) return null;
      url = `${base}?id=${fileId}&export=download&confirm=${token}${
        uuid ? `&uuid=${uuid}` : ""
      }`;
    }
  } catch {
    // Network failure / Drive unreachable — surface as a clean "couldn't
    // download" rather than a 500.
    return null;
  }
  return null;
}

/** GET — host-only proxy that returns a Drive course-content PDF as bytes so
 *  the teacher's browser can split it into slides (Drive blocks direct
 *  cross-origin fetches; the existing slide pipeline takes it from here). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["teacher"]);
    const { id } = await ctx.params;

    const meeting = (await meetingsService.getById(id)) as unknown as {
      teacherId: string;
    } | null;
    if (!meeting || meeting.teacherId !== user.uid)
      throw forbidden("Not your meeting");

    const src = req.nextUrl.searchParams.get("src");
    if (!src) throw badRequest("Missing src");
    const fileId = driveFileId(src);
    if (!fileId) throw badRequest("Unrecognised Google Drive link");

    const out = await fetchDriveBytes(fileId);
    if (!out) {
      throw badRequest(
        "Couldn't download this file from Drive. Make sure it's shared with 'Anyone with the link'.",
      );
    }

    // Trust the bytes over Drive's header (it often sends octet-stream). Fall
    // back to the header only if magic-byte sniffing comes up empty.
    const sniffed = sniffContentType(out.buf);
    const headerType = out.contentType.includes("pdf")
      ? "application/pdf"
      : out.contentType;
    const contentType = sniffed ?? headerType;

    if (!contentType.includes("pdf") && !contentType.includes("image")) {
      throw badRequest(
        "That Drive file isn't a PDF or image, so it can't be presented as slides. Export it to PDF in Drive, then re-share the link.",
      );
    }

    return new NextResponse(out.buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
