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
    <div className="rounded-2xl border border-bd bg-surf p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-t">Reset your password</h1>
        <p className="mt-1 text-sm text-t3">
          We&apos;ll email you a secure link to set a new password.
        </p>
      </div>

      {adminBlocked && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-abd bg-abg p-4 text-at">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Admin account</p>
            <p className="mt-1 text-xs opacity-90">
              For security, the admin password can&apos;t be reset by email.
              Please contact website support to receive a new password.
            </p>
          </div>
        </div>
      )}

      {sent && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-gbd bg-gbg p-4 text-gt">
          <MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Check your email</p>
            <p className="mt-1 text-xs opacity-90">
              If an account exists for <strong>{sent}</strong>, a password reset
              link is on its way. Check your spam folder if you don&apos;t see
              it within a few minutes.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-t2">
            Account email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            {...register("email")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-acc py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <Link
        href="/auth/login"
        className="mt-4 flex items-center justify-center gap-1.5 text-xs text-t3 hover:text-t"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to sign in
      </Link>
    </div>
  );
}
