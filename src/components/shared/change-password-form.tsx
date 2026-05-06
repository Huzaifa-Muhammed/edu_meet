"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";

const Schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "New password must be different from current",
  });

type FormValues = z.infer<typeof Schema>;

const FRIENDLY: Record<string, string> = {
  "auth/wrong-password": "Current password is incorrect.",
  "auth/invalid-credential": "Current password is incorrect.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a moment and try again.",
  "auth/weak-password": "New password is too weak.",
  "auth/requires-recent-login":
    "For security, please sign out and sign back in, then try again.",
};

export function ChangePasswordForm() {
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  async function onSubmit(values: FormValues) {
    const auth = getFirebaseAuth();
    const fbUser = auth.currentUser;
    if (!fbUser?.email) {
      toast.error("You're not signed in.");
      return;
    }
    setSubmitting(true);
    try {
      const cred = EmailAuthProvider.credential(
        fbUser.email,
        values.currentPassword,
      );
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, values.newPassword);
      toast.success("Password updated");
      reset({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      toast.error(
        FRIENDLY[code] ??
          (err instanceof Error ? err.message : "Could not update password"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputType = show ? "text" : "password";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field
        label="Current password"
        type={inputType}
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <Field
        label="New password"
        type={inputType}
        autoComplete="new-password"
        error={errors.newPassword?.message}
        hint="At least 8 characters."
        {...register("newPassword")}
      />
      <Field
        label="Confirm new password"
        type={inputType}
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register("confirm")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-t3 hover:text-t"
        >
          {show ? (
            <>
              <EyeOff className="h-3 w-3" />
              Hide passwords
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Show passwords
            </>
          )}
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              Update password
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-t2">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
      />
      {hint && !error && <p className="mt-1 text-[11px] text-t3">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}
