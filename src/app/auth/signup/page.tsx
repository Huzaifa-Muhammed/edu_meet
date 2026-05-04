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
    <div className="rounded-2xl border border-bd bg-surf p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-t">Create an account</h1>
        <p className="mt-1 text-sm text-t3">Join EduMeet as a teacher or student</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-t2">
            Full Name
          </label>
          <input
            type="text"
            {...register("displayName")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            placeholder="John Doe"
          />
          {errors.displayName && (
            <p className="mt-1 text-xs text-red">
              {errors.displayName.message}
            </p>
          )}
        </div>

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
            I am a
          </label>
          <select
            {...register("role")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
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

        <div>
          <label className="mb-1 block text-xs font-medium text-t2">
            Confirm Password
          </label>
          <input
            type="password"
            {...register("confirmPassword")}
            className="w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-acc py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-t3">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-acc hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
