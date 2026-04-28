"use client";

import { MeetingProvider } from "@videosdk.live/react-sdk";
import type { ReactNode } from "react";

export function EdumeetMeetingProvider({
  token,
  roomId,
  displayName,
  participantId,
  isMod,
  children,
}: {
  token: string;
  roomId: string;
  displayName: string;
  participantId: string;
  isMod: boolean;
  children: ReactNode;
}) {
  return (
    <MeetingProvider
      config={{
        meetingId: roomId,
        micEnabled: isMod,
        webcamEnabled: isMod,
        name: displayName || "Participant",
        participantId,
        mode: "SEND_AND_RECV",
        debugMode: false,
      }}
      token={token}
      joinWithoutUserInteraction
    >
      {children}
    </MeetingProvider>
  );
}
