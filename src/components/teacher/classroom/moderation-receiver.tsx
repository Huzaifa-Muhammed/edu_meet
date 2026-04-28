"use client";

import { useEffect } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";

/** Receives moderation broadcasts (mute-all, cam-off, lower-hands) and applies
 *  them locally. Rendered once per participant inside the meeting provider.
 *  Teacher ignores their own mute/cam broadcasts (they initiate, don't comply). */
export function ModerationReceiver({ isMod }: { isMod: boolean }) {
  const { toggleMic, toggleWebcam, localMicOn, localWebcamOn } = useMeeting();

  const { messages: muteMsgs } = usePubSub("MOD_MUTE_ALL");
  const { messages: camMsgs } = usePubSub("MOD_CAM_OFF");

  useEffect(() => {
    const last = muteMsgs[muteMsgs.length - 1];
    if (!last || isMod) return;
    if (localMicOn) toggleMic?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muteMsgs.length, isMod]);

  useEffect(() => {
    const last = camMsgs[camMsgs.length - 1];
    if (!last || isMod) return;
    if (localWebcamOn) toggleWebcam?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camMsgs.length, isMod]);

  return null;
}

/** Hook for the teacher side — returns functions that publish moderation
 *  broadcasts to everyone. */
export function useModerationBroadcast() {
  const { publish: publishMute } = usePubSub("MOD_MUTE_ALL");
  const { publish: publishCam } = usePubSub("MOD_CAM_OFF");

  return {
    muteAll: () => publishMute(String(Date.now()), { persist: false }),
    camOffAll: () => publishCam(String(Date.now()), { persist: false }),
  };
}
