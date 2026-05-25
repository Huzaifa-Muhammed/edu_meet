"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, MailCheck } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";

const ADMIN_EMAIL = "admin@spark.com";

const ForgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
type ForgotForm = z.infer<typeof ForgotSchema>;

export default function ForgotPasswordPage() {
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotForm>({
    resolver: zodResolver(ForgotSchema),
  });

  async function onSubmit(data: ForgotForm) {
    const email = data.email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) {
      setAdminBlocked(true);
      setSent(null);
      return;
    }

    setAdminBlocked(false);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      setSent(email);
      reset({ email: "" });
      toast.success("Reset link sent — check your inbox");
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      // Firebase intentionally doesn't reveal whether an account exists.
      // Treat "user-not-found" as a soft success to match that convention.
      if (code === "auth/user-not-found") {
        setSent(email);
        toast.success(
          "If an account exists for that email, a reset link is on its way.",
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : "Could not send reset email",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 lg:hidden">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>
        <span
          className="text-[14px] font-extrabold text-white"
          style={{ letterSpacing: "-0.3px" }}
        >
          EduMeet
        </span>
      </div>

      <div>
        <h1
          className="text-[28px] font-extrabold text-white"
          style={{ letterSpacing: "-0.6px" }}
        >
          Reset your password
        </h1>
        <p className="mt-1.5 text-[13px] text-white/55">
          We&apos;ll email you a secure link to set a new password.
        </p>
      </div>

      {adminBlocked && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            background: "rgba(245,158,11,.12)",
            border: "1px solid rgba(245,158,11,.3)",
            color: "#FCD34D",
          }}
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">Admin account</p>
            <p className="mt-1 text-[11.5px] opacity-90">
              For security, the admin password can&apos;t be reset by email.
              Please contact website support to receive a new password.
            </p>
          </div>
        </div>
      )}

      {sent && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            background: "rgba(74,222,128,.12)",
            border: "1px solid rgba(74,222,128,.3)",
            color: "#4ADE80",
          }}
        >
          <MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">Check your email</p>
            <p className="mt-1 text-[11.5px] opacity-90">
              If an account exists for <strong>{sent}</strong>, a password reset
              link is on its way. Check your spam folder if you don&apos;t see
              it within a few minutes.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
            Account email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            {...register("email")}
            className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-acc focus:bg-white/[.07]"
          />
          {errors.email && (
            <p className="mt-1.5 text-[11px] text-[#F87171]">
              {errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            boxShadow: "0 8px 24px -8px rgba(99,102,241,.6)",
          }}
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <Link
        href="/auth/login"
        className="flex items-center justify-center gap-1.5 text-[12px] text-white/45 hover:text-white/80"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to sign in
      </Link>
    </div>
  );
}
