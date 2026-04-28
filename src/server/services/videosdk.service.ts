import "server-only";
import { mintVideosdkToken } from "@/lib/videosdk/token";

const API_ENDPOINT =
  process.env.VIDEOSDK_API_ENDPOINT ?? "https://api.videosdk.live";

export const videosdkService = {
  /** Create a room on videosdk.live. Returns the generated roomId. */
  async createRoom(): Promise<string> {
    const token = mintVideosdkToken({ permissions: ["allow_join", "allow_mod"] });
    const res = await fetch(`${API_ENDPOINT}/v2/rooms`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`videosdk createRoom failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { roomId?: string };
    if (!data.roomId) throw new Error("videosdk createRoom: missing roomId");
    return data.roomId;
  },

  /** Mint a client token scoped to a specific room + participant. */
  participantToken(
    roomId: string,
    participantId: string,
    isMod = false,
  ): string {
    return mintVideosdkToken({
      roomId,
      participantId,
      permissions: isMod ? ["allow_join", "allow_mod"] : ["allow_join"],
    });
  },
};
