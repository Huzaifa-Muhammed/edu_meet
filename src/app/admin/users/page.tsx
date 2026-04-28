"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-bg p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-lg font-semibold text-t">User Management</h1>
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="User management"
          description="Admin user table will be implemented here"
        />
      </div>
    </div>
  );
}
