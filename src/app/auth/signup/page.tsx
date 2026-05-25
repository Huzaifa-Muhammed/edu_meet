"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUp } from "@/lib/api/auth";
import { toast } from "sonner";

const SignupSchema = z
  .object({
    displayName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    role: z.enum(["teacher", "student"]),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof SignupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { role: "student" },
  });

  async function onSubmit(data: SignupForm) {
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.displayName, data.role);
      toast.success("Account created!");
      if (data.role === "teacher") {
        router.push("/teacher/apply");
      } else {
        router.push(`/${data.role}/dashboard`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
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
          Create an account
        </h1>
        <p className="mt-1.5 text-[13px] text-white/55">
          Join EduMeet as a teacher or student
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
            Full name
          </label>
          <input
            type="text"
            {...register("displayName")}
            className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-acc focus:bg-white/[.07]"
            placeholder="John Doe"
          />
          {errors.displayName && (
            <p className="mt-1.5 text-[11px] text-[#F87171]">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
            Email
          </label>
          <input
            type="email"
            {...register("email")}
            className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-acc focus:bg-white/[.07]"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1.5 text-[11px] text-[#F87171]">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
            I am a
          </label>
          <select
            {...register("role")}
            className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors focus:border-acc focus:bg-white/[.07]"
          >
            <option value="student" className="bg-[#0E0B1E]">
              Student
            </option>
            <option value="teacher" className="bg-[#0E0B1E]">
              Teacher
            </option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
              Password
            </label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-acc focus:bg-white/[.07]"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1.5 text-[11px] text-[#F87171]">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
              Confirm
            </label>
            <input
              type="password"
              {...register("confirmPassword")}
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-acc focus:bg-white/[.07]"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-[11px] text-[#F87171]">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            boxShadow: "0 8px 24px -8px rgba(99,102,241,.6)",
          }}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-center text-[12px] text-white/45">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-[#A5B4FC] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
