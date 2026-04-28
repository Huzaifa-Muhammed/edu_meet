import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ToastProvider } from "@/providers/toast-provider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "EduMeet",
  description: "Virtual classroom platform for teachers and students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="h-full antialiased" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
