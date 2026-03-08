// src/app/api/job-types/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

export async function GET() {
  try {
    const jobTypes = await prisma.jobType.findMany({
      include: { _count: { select: { jobs: true } } },
      orderBy: { name: "asc" },
    });
    return success(jobTypes);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      organisationId: number;
      name: string;
      billingUnit: string;
      defaultRate: number;
      description?: string;
    }>(request);

    if (!body.name || !body.billingUnit || !body.defaultRate || !body.organisationId) {
      return error("name, billingUnit, defaultRate, and organisationId are required");
    }

    const jobType = await prisma.jobType.create({ data: body });
    return success(jobType, 201);
  } catch (err) {
    return serverError(err);
  }
}
