export const dynamic = "force-dynamic";

import { AuthHero } from "@/components/auth/auth-hero";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-ui flex min-h-screen bg-bg text-t">
      {/* Hero panel — desktop only */}
      <aside className="relative hidden flex-1 overflow-hidden lg:block">
        <AuthHero />
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-shrink-0 items-center justify-center px-6 py-10 lg:w-[480px] xl:w-[520px]">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
