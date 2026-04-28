import "server-only";
import type { AuthUser } from "@/shared/types/api";
import { forbidden } from "@/server/utils/errors";

/**
 * Throws 403 if the user's role is not in the allowed list.
 */
export function requireRole(user: AuthUser, allowed: string[]): void {
  if (!allowed.includes(user.role)) {
    throw forbidden(
      `Role '${user.role}' is not allowed. Required: ${allowed.join(", ")}`,
    );
  }
}
