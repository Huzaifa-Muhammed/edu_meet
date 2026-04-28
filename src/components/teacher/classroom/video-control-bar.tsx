"use client";

import { useMeeting } from "@videosdk.live/react-sdk";
import {
  MicOff,
  VideoOff,
  PenTool,
  Projector,
  Hand,
  PhoneOff,
  MonitorUp,
  MonitorX,
} from "lucide-react";

export function VideoControlBar({
  onMuteAll,
  onCamOff,
  onBoard,
  onSlides,
  onLowerHands,
  onEnd,
  boardOn,
  slidesOn,
  handsCount = 0,
}: {
  onMuteAll?: () => void;
  onCamOff?: () => void;
  onBoard?: () => void;
  onSlides?: () => void;
  onLowerHands?: () => void;
  onEnd?: () => void;
  boardOn?: boolean;
  slidesOn?: boolean;
  handsCount?: number;
}) {
  const { toggleScreenShare, localScreenShareOn } = useMeeting();

  return (
    <div className="flex flex-shrink-0 items-center justify-center gap-1.5 border-y border-bd bg-surf px-2 py-1.5">
      <Btn label="Mute all" title="Mute all students" onClick={onMuteAll}>
        <MicOff className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Cam off" title="Turn off all cameras" onClick={onCamOff}>
        <VideoOff className="h-3.5 w-3.5" />
      </Btn>
      <Sep />
      <Btn label="Board" title="Whiteboard" onClick={onBoard} active={boardOn}>
        <PenTool className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Slides" title="Present slides" onClick={onSlides} active={slidesOn}>
        <Projector className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label={localScreenShareOn ? "Stop" : "Share"}
        title={localScreenShareOn ? "Stop screen share" : "Share your screen"}
        onClick={() => toggleScreenShare?.()}
        active={localScreenShareOn}
      >
        {localScreenShareOn ? (
          <MonitorX className="h-3.5 w-3.5" />
        ) : (
          <MonitorUp className="h-3.5 w-3.5" />
        )}
      </Btn>
      <Btn
        label="Hands"
        title={handsCount > 0 ? `${handsCount} hand${handsCount === 1 ? "" : "s"} raised — click to lower all` : "No hands raised"}
        onClick={onLowerHands}
        active={handsCount > 0}
        badge={handsCount > 0 ? handsCount : undefined}
      >
        <Hand className="h-3.5 w-3.5" />
      </Btn>
      <Sep />
      <Btn label="End" title="End session" danger onClick={onEnd}>
        <PhoneOff className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}

function Sep() {
  return <div className="mx-1 h-4 w-px bg-bd" />;
}

function Btn({
  children,
  label,
  title,
  onClick,
  active,
  danger,
  badge,
}: {
  children: React.ReactNode;
  label: string;
  title: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        danger
          ? "border-rbd bg-rbg text-rt hover:bg-red-100"
          : active
            ? "border-acc bg-accbg text-acc"
            : "border-bd bg-surf text-t2 hover:bg-panel"
      }`}
    >
      {children}
      <span className="whitespace-nowrap">{label}</span>
      {badge != null && (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
