// src/app/api/job-groups/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

const include = {
  customer: { select: { id: true, name: true } },
  templateItems: {
    include: { jobType: { select: { id: true, name: true, billingUnit: true, defaultRate: true } } },
    orderBy: { sequence: "asc" as const },
  },
  jobs: {
    include: {
      jobType: { select: { id: true, name: true } },
      field: { select: { id: true, fieldName: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  },
  _count: { select: { jobs: true } },
};

// GET /api/job-groups
export async function GET() {
  try {
    const groups = await prisma.jobGroup.findMany({
      include,
      orderBy: { createdAt: "desc" },
    });
    return success(groups);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/job-groups — create a template or a work order
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      organisationId: number;
      name: string;
      description?: string;
      isTemplate: boolean;
      // For work orders only
      customerId?: number;
      // Template items (for templates)
      templateItems?: Array<{ jobTypeId: number; sequence: number; notes?: string }>;
    }>(request);

    if (!body.name || !body.organisationId) {
      return error("name and organisationId are required");
    }

    const group = await prisma.jobGroup.create({
      data: {
        organisationId: body.organisationId,
        name: body.name,
        description: body.description,
        isTemplate: body.isTemplate,
        customerId: body.customerId ?? null,
        templateItems: body.templateItems?.length
          ? { create: body.templateItems }
          : undefined,
      },
      include,
    });

    return success(group, 201);
  } catch (err) {
    return serverError(err);
  }
}
