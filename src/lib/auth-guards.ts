// src/lib/auth-guards.ts
// Server-side session/role guards for API routes. Every route is
// independently responsible for its own check (no middleware.ts) — these
// helpers keep that check to one line and consistent across all of them.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { error } from "@/lib/api-helpers";

export type Role = "admin" | "job_admin" | "contractor";

type GuardResult = { session: any; response: null } | { session: null; response: Response };

export async function requireAuth(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { session: null, response: error("Not authenticated", 401) };
  return { session, response: null };
}

export async function requireRole(roles: Role[]): Promise<GuardResult> {
  const result = await requireAuth();
  if (result.response) return result;
  if (!roles.includes((result.session.user as any).role)) {
    return { session: null, response: error("Insufficient permissions", 403) };
  }
  return result;
}

export const requireAdmin = () => requireRole(["admin"]);
export const requireManager = () => requireRole(["admin", "job_admin"]);
