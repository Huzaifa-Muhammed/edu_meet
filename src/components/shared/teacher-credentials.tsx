"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Award, Briefcase, GraduationCap, ImageIcon, X } from "lucide-react";
import type {
  CredentialImage,
  TeacherCertificationEntry,
  TeacherDegreeEntry,
  TeacherExperienceEntry,
} from "@/shared/types/domain";

export type TeacherCredentialsProps = {
  experiences?: TeacherExperienceEntry[];
  certifications?: TeacherCertificationEntry[];
  degrees?: TeacherDegreeEntry[];
  /** Compact = smaller thumbs, used inside admin application cards. */
  compact?: boolean;
};

export function TeacherCredentials({
  experiences,
  certifications,
  degrees,
  compact,
}: TeacherCredentialsProps) {
  const [lightbox, setLightbox] = useState<{
    src: string;
    label: string;
  } | null>(null);

  const hasAny =
    !!(experiences?.length || certifications?.length || degrees?.length);

  if (!hasAny) return null;

  const open = (img: CredentialImage | undefined, label: string) => {
    if (!img) return;
    setLightbox({ src: img.url, label });
  };

  return (
    <div className="space-y-3">
      <CredGroup
        title="Experience"
        icon={<Briefcase className="h-3.5 w-3.5" />}
        items={(experiences ?? []).map((e) => ({
          line1: e.title,
          line2: [e.organization, e.years].filter(Boolean).join(" · "),
          line3: e.description,
          image: e.image,
        }))}
        onOpen={open}
        compact={compact}
      />
      <CredGroup
        title="Certifications"
        icon={<Award className="h-3.5 w-3.5" />}
        items={(certifications ?? []).map((c) => ({
          line1: c.title,
          line2: [c.issuer, c.year].filter(Boolean).join(" · "),
          image: c.image,
        }))}
        onOpen={open}
        compact={compact}
      />
      <CredGroup
        title="Degrees"
        icon={<GraduationCap className="h-3.5 w-3.5" />}
        items={(degrees ?? []).map((d) => ({
          line1: d.title,
          line2: [d.institution, d.year].filter(Boolean).join(" · "),
          image: d.image,
        }))}
        onOpen={open}
        compact={compact}
      />
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

type Item = {
  line1: string;
  line2?: string;
  line3?: string;
  image?: CredentialImage;
};

function CredGroup({
  title,
  icon,
  items,
  onOpen,
  compact,
}: {
  title: string;
  icon: React.ReactNode;
  items: Item[];
  onOpen: (img: CredentialImage | undefined, label: string) => void;
  compact?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-bd bg-panel p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-t3">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-md border border-bd bg-surf p-2"
          >
            <button
              type="button"
              onClick={() => onOpen(it.image, it.line1)}
              disabled={!it.image}
              className={`relative ${
                compact ? "h-12 w-12" : "h-14 w-14"
              } flex-shrink-0 overflow-hidden rounded-md border border-bd bg-panel2 ${
                it.image ? "cursor-zoom-in hover:opacity-90" : "cursor-default"
              }`}
            >
              {it.image ? (
                <Image
                  src={it.image.url}
                  alt={it.line1}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-t3">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-t">{it.line1}</p>
              {it.line2 && (
                <p className="truncate text-[11px] text-t3">{it.line2}</p>
              )}
              {it.line3 && (
                <p className="mt-0.5 text-[11px] text-t2">{it.line3}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Lightbox({
  src,
  label,
  onClose,
}: {
  src: string;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={label}
          width={1600}
          height={1200}
          className="max-h-[88vh] w-auto rounded-lg object-contain"
          unoptimized
        />
        <p className="mt-2 text-center text-xs text-white/80">{label}</p>
      </div>
    </div>
  );
}
