// src/app/api/job-types/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";

export async function GET() {
  try {
    const { response } = await requireAuth();
    if (response) return response;

    const jobTypes = await prisma.jobType.findMany({
      include: { _count: { select: { jobs: true } } },
      orderBy: { name: "asc" },
    });
    return success(jobTypes);
  } catch (err) {
    return serverError(err);
  }
}

// Job type creation touches billing rates, so this is admin-only — same rule
// already enforced client-side in JobTypesView (job_admin can view, not edit)
export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const body = await parseBody<{
      name: string;
      billingUnit: string;
      defaultRate: number;
      vatApplicable?: boolean;
      description?: string;
    }>(request);

    if (!body.name || !body.billingUnit || !body.defaultRate) {
      return error("name, billingUnit, and defaultRate are required");
    }

    const jobType = await prisma.jobType.create({ data: { ...body, organisationId } });
    return success(jobType, 201);
  } catch (err) {
    return serverError(err);
  }
}
