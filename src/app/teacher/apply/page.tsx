"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  Trash2,
  Upload,
  ImageIcon,
  Loader2,
  Award,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import api from "@/lib/api/client";
import { signOut } from "@/lib/api/auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAuth } from "@/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  TeacherApplicationCreateSchema,
  type TeacherApplicationCreateInput,
} from "@/shared/schemas/teacher-application.schema";
import type {
  CredentialImage,
  TeacherApplication,
} from "@/shared/types/domain";

export default function TeacherApplyPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const appQ = useQuery({
    queryKey: ["teacher", "application", "me"],
    queryFn: async () => {
      const res = (await api.get("/teacher/applications/me")) as unknown as {
        application: TeacherApplication | null;
      };
      return res.application;
    },
    enabled: !!user && user.role === "teacher",
    refetchInterval: 30_000,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TeacherApplicationCreateInput>({
    resolver: zodResolver(TeacherApplicationCreateSchema),
    defaultValues: {
      subject: "",
      yearsExperience: 0,
      highestDegree: "",
      bio: "",
      experiences: [],
      certifications: [],
      degrees: [],
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: TeacherApplicationCreateInput) =>
      api.post("/teacher/applications/me", data) as Promise<unknown>,
    onSuccess: () => {
      toast.success("Application submitted! An admin will review it shortly.");
      queryClient.invalidateQueries({ queryKey: ["teacher", "application", "me"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const liveStatus = appQ.data?.status ?? user?.applicationStatus;
  useEffect(() => {
    if (liveStatus === "approved") {
      refreshUser().then(() => router.replace("/teacher/dashboard"));
    }
  }, [liveStatus, router, refreshUser]);

  async function onLogout() {
    await signOut();
    router.push("/auth/login");
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-t3">Loading...</p>
      </div>
    );
  }

  const application = appQ.data;
  const status = application?.status ?? user.applicationStatus ?? "none";
  const showForm = status === "none" || status === "rejected";

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-t">Teacher Application</h1>
            <p className="mt-1 text-sm text-t3">
              Tell us about yourself so the admin can verify your profile.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg border border-bd bg-surf px-3 py-2 text-xs text-t2 hover:bg-panel"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        {status === "pending" && (
          <StatusBanner
            tone="amber"
            title="Application under review"
            description="An admin will review your details. You'll get access to the teacher portal as soon as you're approved."
          />
        )}
        {status === "rejected" && (
          <StatusBanner
            tone="red"
            title="Application rejected"
            description={
              application?.reviewNote
                ? `Note from admin: ${application.reviewNote}. You can edit and resubmit below.`
                : "You can edit and resubmit your application below."
            }
          />
        )}
        {status === "approved" && (
          <StatusBanner
            tone="green"
            title="You're approved"
            description="Redirecting you to the teacher portal…"
          />
        )}

        <div className="mt-6 rounded-2xl border border-bd bg-surf p-6 shadow-sm">
          {showForm ? (
            <form
              onSubmit={handleSubmit(
                (d) => submitMutation.mutate(d),
                () =>
                  toast.error(
                    "Please fill all required fields. Each credential row needs a title and organization.",
                  ),
              )}
              className="space-y-6"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Subject you want to teach
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, Physics, English Literature"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("subject")}
                />
                {errors.subject && (
                  <p className="mt-1 text-xs text-red">{errors.subject.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Years of experience
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="3"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("yearsExperience", { valueAsNumber: true })}
                />
                {errors.yearsExperience && (
                  <p className="mt-1 text-xs text-red">
                    {errors.yearsExperience.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Highest degree
                </label>
                <input
                  type="text"
                  placeholder="e.g. M.Sc. in Applied Mathematics"
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("highestDegree")}
                />
                {errors.highestDegree && (
                  <p className="mt-1 text-xs text-red">
                    {errors.highestDegree.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-t2">
                  Short bio (optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Briefly describe your teaching style, achievements, or anything else you'd like the admin to know."
                  className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
                  {...register("bio")}
                />
                {errors.bio && (
                  <p className="mt-1 text-xs text-red">{errors.bio.message}</p>
                )}
              </div>

              <ExperiencesSection
                control={control}
                register={register}
                setValue={setValue}
              />
              <CertificationsSection
                control={control}
                register={register}
                setValue={setValue}
              />
              <DegreesSection
                control={control}
                register={register}
                setValue={setValue}
              />

              <button
                type="submit"
                disabled={isSubmitting || submitMutation.isPending}
                className="w-full rounded-lg bg-acc py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitMutation.isPending
                  ? "Submitting..."
                  : status === "rejected"
                    ? "Resubmit application"
                    : "Submit application"}
              </button>
            </form>
          ) : application ? (
            <ApplicationSummary application={application} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Sections ─────────────────────────────────────────────── */

type Reg = ReturnType<typeof useForm<TeacherApplicationCreateInput>>["register"];

function ExperiencesSection({
  control,
  register,
  setValue,
}: {
  control: Control<TeacherApplicationCreateInput>;
  register: Reg;
  setValue: UseFormSetValue<TeacherApplicationCreateInput>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "experiences",
  });
  return (
    <SectionCard
      icon={<Briefcase className="h-3.5 w-3.5" />}
      title="Experience"
      hint="Past teaching, tutoring, or related roles. Add a photo if you have a verifying document."
      onAdd={() =>
        append({ title: "", organization: "", years: "", description: "" })
      }
    >
      {fields.map((f, i) => (
        <CredRow key={f.id} index={i} onRemove={() => remove(i)}>
          <Input
            placeholder="Role / title"
            {...register(`experiences.${i}.title` as const)}
          />
          <Input
            placeholder="Organization"
            {...register(`experiences.${i}.organization` as const)}
          />
          <Input
            placeholder="Years (e.g. 2020–2023)"
            {...register(`experiences.${i}.years` as const)}
          />
          <Input
            placeholder="One-line description (optional)"
            {...register(`experiences.${i}.description` as const)}
          />
          <ImagePicker
            control={control}
            name={`experiences.${i}.image`}
            onChange={(image) =>
              setValue(`experiences.${i}.image`, image, { shouldDirty: true })
            }
          />
        </CredRow>
      ))}
    </SectionCard>
  );
}

function CertificationsSection({
  control,
  register,
  setValue,
}: {
  control: Control<TeacherApplicationCreateInput>;
  register: Reg;
  setValue: UseFormSetValue<TeacherApplicationCreateInput>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "certifications",
  });
  return (
    <SectionCard
      icon={<Award className="h-3.5 w-3.5" />}
      title="Certifications"
      hint="Professional certificates, credentials, or training completions."
      onAdd={() => append({ title: "", issuer: "", year: "" })}
    >
      {fields.map((f, i) => (
        <CredRow key={f.id} index={i} onRemove={() => remove(i)}>
          <Input
            placeholder="Certificate name"
            {...register(`certifications.${i}.title` as const)}
          />
          <Input
            placeholder="Issuer"
            {...register(`certifications.${i}.issuer` as const)}
          />
          <Input
            placeholder="Year"
            {...register(`certifications.${i}.year` as const)}
          />
          <ImagePicker
            control={control}
            name={`certifications.${i}.image`}
            onChange={(image) =>
              setValue(`certifications.${i}.image`, image, { shouldDirty: true })
            }
          />
        </CredRow>
      ))}
    </SectionCard>
  );
}

function DegreesSection({
  control,
  register,
  setValue,
}: {
  control: Control<TeacherApplicationCreateInput>;
  register: Reg;
  setValue: UseFormSetValue<TeacherApplicationCreateInput>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "degrees",
  });
  return (
    <SectionCard
      icon={<GraduationCap className="h-3.5 w-3.5" />}
      title="Degrees"
      hint="Academic qualifications. Upload a scan of the diploma when possible."
      onAdd={() => append({ title: "", institution: "", year: "" })}
    >
      {fields.map((f, i) => (
        <CredRow key={f.id} index={i} onRemove={() => remove(i)}>
          <Input
            placeholder="Degree (e.g. B.Sc. Mathematics)"
            {...register(`degrees.${i}.title` as const)}
          />
          <Input
            placeholder="Institution"
            {...register(`degrees.${i}.institution` as const)}
          />
          <Input
            placeholder="Year"
            {...register(`degrees.${i}.year` as const)}
          />
          <ImagePicker
            control={control}
            name={`degrees.${i}.image`}
            onChange={(image) =>
              setValue(`degrees.${i}.image`, image, { shouldDirty: true })
            }
          />
        </CredRow>
      ))}
    </SectionCard>
  );
}

/* ── Building blocks ──────────────────────────────────────── */

function SectionCard({
  icon,
  title,
  hint,
  onAdd,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-bd bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-bd bg-surf text-t2">
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-t">{title}</p>
            <p className="mt-0.5 text-[11px] text-t3">{hint}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-lg border border-bd bg-surf px-2.5 py-1.5 text-[11px] font-semibold text-t2 hover:bg-panel2"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function CredRow({
  index,
  onRemove,
  children,
}: {
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-bd bg-surf p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-t3">
          Entry {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-md border border-rbd bg-rbg px-2 py-0.5 text-[10px] font-semibold text-rt hover:opacity-90"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

const Input = function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-bd bg-surf px-2.5 py-1.5 text-sm text-t outline-none focus:border-acc"
    />
  );
};

type ImageFieldName =
  | `experiences.${number}.image`
  | `certifications.${number}.image`
  | `degrees.${number}.image`;

function ImagePicker({
  control,
  name,
  onChange,
}: {
  control: Control<TeacherApplicationCreateInput>;
  name: ImageFieldName;
  onChange: (img: CredentialImage | undefined) => void;
}) {
  const value = useWatch({ control, name }) as CredentialImage | undefined;
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const auth = getFirebaseAuth().currentUser;
      const token = auth ? await auth.getIdToken() : null;
      const res = await fetch("/api/uploads/teacher-credentials", {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Upload failed");
      }
      onChange({ url: json.data.url, publicId: json.data.publicId });
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-md border border-bd bg-panel2 p-2">
          <div className="relative h-16 w-16 overflow-hidden rounded-md border border-bd bg-surf">
            <Image
              src={value.url}
              alt="Preview"
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-t2">Uploaded</p>
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[10px] text-acc underline"
            >
              View full image
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-bd bg-surf px-2 py-0.5 text-[10px] text-t2 hover:bg-panel"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="rounded-md border border-rbd bg-rbg px-2 py-0.5 text-[10px] text-rt hover:opacity-90"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-bd bg-panel2 py-3 text-xs text-t2 hover:bg-panel disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Upload image (PNG, JPG, WebP — max 8MB)
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Banners + summary ────────────────────────────────────── */

function StatusBanner({
  tone,
  title,
  description,
}: {
  tone: "amber" | "red" | "green";
  title: string;
  description: string;
}) {
  const palette =
    tone === "amber"
      ? "border-abd bg-abg text-at"
      : tone === "red"
        ? "border-rbd bg-rbg text-rt"
        : "border-gbd bg-gbg text-gt";
  return (
    <div className={`rounded-xl border px-4 py-3 ${palette}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs opacity-90">{description}</p>
    </div>
  );
}

function ApplicationSummary({
  application,
}: {
  application: TeacherApplication;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-3">
        <Row label="Subject" value={application.subject} />
        <Row
          label="Years of experience"
          value={`${application.yearsExperience} years`}
        />
        <Row label="Highest degree" value={application.highestDegree} />
        {application.bio && (
          <Row label="Bio" value={application.bio} multiline />
        )}
        <Row
          label="Submitted"
          value={new Date(application.submittedAt).toLocaleString()}
        />
      </div>

      <SummaryGroup
        title="Experience"
        items={(application.experiences ?? []).map((e) => ({
          line1: e.title,
          line2: [e.organization, e.years].filter(Boolean).join(" · "),
          line3: e.description,
          image: e.image,
        }))}
      />
      <SummaryGroup
        title="Certifications"
        items={(application.certifications ?? []).map((c) => ({
          line1: c.title,
          line2: [c.issuer, c.year].filter(Boolean).join(" · "),
          image: c.image,
        }))}
      />
      <SummaryGroup
        title="Degrees"
        items={(application.degrees ?? []).map((d) => ({
          line1: d.title,
          line2: [d.institution, d.year].filter(Boolean).join(" · "),
          image: d.image,
        }))}
      />
    </div>
  );
}

function SummaryGroup({
  title,
  items,
}: {
  title: string;
  items: {
    line1: string;
    line2?: string;
    line3?: string;
    image?: CredentialImage;
  }[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-bd bg-panel p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-t3">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-md border border-bd bg-surf p-2"
          >
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-bd bg-panel2">
              {it.image ? (
                <Image
                  src={it.image.url}
                  alt={it.line1}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-t3">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
            </div>
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

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-t3">{label}</span>
      <span
        className={`text-right text-t ${multiline ? "max-w-md whitespace-pre-wrap" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
