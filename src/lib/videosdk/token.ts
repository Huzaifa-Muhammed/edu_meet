import "server-only";
import jwt from "jsonwebtoken";

type Perm = "allow_join" | "allow_mod" | "ask_join";

export function mintVideosdkToken(opts: {
  permissions?: Perm[];
  roomId?: string;
  participantId?: string;
  ttlSeconds?: number;
}) {
  const API_KEY = process.env.VIDEOSDK_API_KEY ?? "";
  const SECRET = process.env.VIDEOSDK_SECRET_KEY ?? "";

  if (!API_KEY || !SECRET) {
    throw new Error(
      "VIDEOSDK_API_KEY / VIDEOSDK_SECRET_KEY are not set — add them to .env.local and restart the dev server",
    );
  }

  const payload: Record<string, unknown> = {
    apikey: API_KEY,
    permissions: opts.permissions ?? ["allow_join"],
    version: 2,
  };
  if (opts.roomId) payload.roomId = opts.roomId;
  if (opts.participantId) payload.participantId = opts.participantId;

  const expiresIn = opts.ttlSeconds ?? 60 * 60 * 6;
  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    expiresIn,
  });
}
