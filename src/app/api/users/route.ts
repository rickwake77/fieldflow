// src/app/api/users/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";

// Every user in the org is fetched by every logged-in role (Dashboard's Team
// card, job assignment dropdowns) — so this stays broadly readable, but
// passwordHash/magicToken/magicTokenExp must never be sent to the client
// under any circumstances, regardless of caller.
export async function GET() {
  try {
    const { response } = await requireAuth();
    if (response) return response;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        organisationId: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        _count: { select: { assignedJobs: true, jobLogs: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(users);
  } catch (err) {
    return serverError(err);
  }
}

// Note: user creation should go through /api/auth/create-user, which does
// this correctly. This route is kept admin-gated as defense-in-depth rather
// than removed, in case anything still depends on it.
export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const body = await parseBody<{
      name: string;
      email: string;
      phone?: string;
      role?: "admin" | "job_admin" | "contractor";
    }>(request);

    if (!body.name || !body.email) {
      return error("name and email are required");
    }

    const user = await prisma.user.create({ data: { ...body, organisationId } });
    return success(user, 201);
  } catch (err) {
    return serverError(err);
  }
}
