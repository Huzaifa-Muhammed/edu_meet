"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Classes was folded into the AI-driven Schedule page. Redirect for any
 *  old links/bookmarks. */
export default function TeacherClassesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/teacher/schedule");
  }, [router]);
  return (
    <div className="flex min-h-full items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-bd border-t-acc" />
    </div>
  );
}
