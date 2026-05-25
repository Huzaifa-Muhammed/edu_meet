"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/api/auth";
import api from "@/lib/api/client";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin@spark.com";
const ADMIN_PASSWORD = "123456";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      // Hidden admin login — typing the magic creds opens the admin panel.
      // We bootstrap the admin user in Firebase Auth + Firestore on first use,
      // then fall through to the normal sign-in flow.
      if (
        data.email.toLowerCase() === ADMIN_EMAIL &&
        data.password === ADMIN_PASSWORD
      ) {
        await api.post("/auth/admin-bootstrap", {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });
      }

      const user = (await signIn(data.email, data.password)) as unknown as {
        role: string;
        applicationStatus?: string;
        blocked?: boolean;
      };

      if (user.blocked) {
        toast.error("Your account has been blocked. Contact support.");
        return;
      }

      toast.success("Welcome back!");
      if (user.role === "admin") {
        router.push("/admin/dashboard");
      } else if (user.role === "teacher" && user.applicationStatus !== "approved") {
        router.push("/teacher/apply");
      } else {
        router.push(`/${user.role}/dashboard`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Mobile-only brand mark (hero panel is hidden < lg) */}
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
          Welcome back
        </h1>
        <p className="mt-1.5 text-[13px] text-white/55">
          Sign in to your EduMeet account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-white/55">
              Password
            </label>
            <Link
              href="/auth/forgot"
              className="text-[11px] font-semibold text-[#A5B4FC] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            boxShadow: "0 8px 24px -8px rgba(99,102,241,.6)",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-[12px] text-white/45">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="font-semibold text-[#A5B4FC] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
