export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { meetingsService } from "@/server/services/meetings.service";
import { videosdkService } from "@/server/services/videosdk.service";
import { ok, fail } from "@/server/utils/response";
import { badRequest } from "@/server/utils/errors";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyToken(req);
    const { id } = await ctx.params;

    const meeting = (await meetingsService.getById(id)) as unknown as {
      id: string;
      teacherId: string;
      videosdkRoomId?: string | null;
    };

    // Lazy-allocate the videosdk room if the meeting doesn't have one yet
    // (e.g. created before the VIDEOSDK_* env vars were set).
    let roomId = meeting.videosdkRoomId ?? null;
    if (!roomId) {
      try {
        roomId = await meetingsService.ensureVideosdkRoom(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw badRequest(
          `Cannot allocate video room. Check that VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY are set and valid, then restart the dev server. Original error: ${msg}`,
        );
      }
    }

    const isMod = user.uid === meeting.teacherId;
    const token = videosdkService.participantToken(roomId, user.uid, isMod);

    if (!isMod) {
      await meetingsService.addParticipant(id, user.uid);
    }

    return ok({
      token,
      roomId,
      isMod,
      participantId: user.uid,
      displayName: user.displayName,
    });
  } catch (e) {
    return fail(e);
  }
}
