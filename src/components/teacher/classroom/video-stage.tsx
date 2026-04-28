"use client";

import { useMemo, useEffect, useRef } from "react";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";

/** Plays the participant's mic on a separate <audio> element. The video
 *  tile is always video-muted so we don't double-play through the video
 *  element. Self-tile is skipped to avoid echo. */
function ParticipantAudio({ participantId }: { participantId: string }) {
  const { micStream, micOn, isLocal } = useParticipant(participantId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (micOn && micStream && !isLocal) {
      const ms = new MediaStream();
      ms.addTrack(micStream.track);
      audioRef.current.srcObject = ms;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.srcObject = null;
    }
  }, [micOn, micStream, isLocal]);

  if (isLocal) return null;
  return <audio ref={audioRef} autoPlay playsInline />;
}

function ParticipantTile({ participantId, isPresenter }: { participantId: string; isPresenter?: boolean }) {
  const { webcamStream, webcamOn, displayName, isLocal } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (webcamOn && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.srcObject = null;
    }
  }, [webcamOn, webcamStream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={isLocal ? { transform: "scaleX(-1)" } : undefined}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-xs font-semibold text-white/60">
            {(displayName ?? "?").slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}
      <ParticipantAudio participantId={participantId} />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
        {displayName ?? "Participant"}
        {isLocal ? " (you)" : ""}
        {isPresenter ? " · presenting" : ""}
      </span>
    </div>
  );
}

function ScreenShareTile({ participantId }: { participantId: string }) {
  const {
    screenShareStream,
    screenShareAudioStream,
    screenShareOn,
    displayName,
    isLocal,
  } = useParticipant(participantId) as unknown as {
    screenShareStream?: { track: MediaStreamTrack };
    screenShareAudioStream?: { track: MediaStreamTrack };
    screenShareOn: boolean;
    displayName?: string;
    isLocal: boolean;
  };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (screenShareOn && screenShareStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(screenShareStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [screenShareOn, screenShareStream]);

  // Some browsers/teachers also share system audio with the screen — pipe
  // it through a dedicated <audio> element so non-presenters hear it.
  useEffect(() => {
    if (!audioRef.current) return;
    if (screenShareOn && screenShareAudioStream && !isLocal) {
      const ms = new MediaStream();
      ms.addTrack(screenShareAudioStream.track);
      audioRef.current.srcObject = ms;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.srcObject = null;
    }
  }, [screenShareOn, screenShareAudioStream, isLocal]);

  if (!screenShareOn) return null;

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-white/15 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
        🖥 {displayName ?? "Someone"} is sharing
      </span>
    </div>
  );
}

export function VideoStage() {
  const { participants } = useMeeting();

  const { tiles, presenterId } = useMemo(() => {
    const ids = [...participants.keys()];
    const presenter = [...participants.values()].find(
      (p) => (p as unknown as { screenShareOn: boolean }).screenShareOn,
    )?.id;
    return { tiles: ids, presenterId: presenter };
  }, [participants]);

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[linear-gradient(135deg,#1E1B4B,#1E293B)] p-3">
      {presenterId && <ScreenShareTile participantId={presenterId} />}
      <div
        className={`grid gap-2 ${presenterId ? "grid-flow-col auto-cols-[180px] overflow-x-auto" : tiles.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}
        style={presenterId ? { maxHeight: "140px" } : undefined}
      >
        {tiles.map((pid) => (
          <ParticipantTile key={pid} participantId={pid} isPresenter={pid === presenterId} />
        ))}
      </div>
    </div>
  );
}
