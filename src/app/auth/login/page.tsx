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
    <div className="rounded-2xl border border-bd bg-surf p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-t">Welcome back</h1>
        <p className="mt-1 text-sm text-t3">Sign in to your EduMeet account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-t2">
            Email
          </label>
          <input
            type="email"
            {...register("email")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-t2">
            Password
          </label>
          <input
            type="password"
            {...register("password")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-acc py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-t3">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-medium text-acc hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
