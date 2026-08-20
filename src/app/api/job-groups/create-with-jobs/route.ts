// src/app/api/job-groups/create-with-jobs/route.ts
//
// Quick-create path for the "Work Package" mode in the Jobs page's Create
// Job modal — takes an on-the-spot list of job types (optionally seeded
// client-side from a saved template) and immediately creates real Jobs,
// wrapped in a non-template JobGroup so they also show up under Work
// Orders. Unlike /job-groups/[id]/apply, this doesn't require an existing
// template row — the item list comes straight from the request body.

import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireManager } from "@/lib/auth-guards";

export async function POST(request: Request) {
  try {
    const { session, response } = await requireManager();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const body = await parseBody<{
      name?: string;
      customerId: number;
      fieldIds?: number[];
      assignedToUserId?: number;
      plannedDate?: string;
      items: Array<{ jobTypeId: number; notes?: string }>;
    }>(request);

    if (!body.customerId || !body.items?.length) {
      return error("customerId and at least one job item are required");
    }

    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) return error("Customer not found", 404);

    const jobTypeIds = [...new Set(body.items.map((i) => i.jobTypeId))];
    const jobTypes = await prisma.jobType.findMany({ where: { id: { in: jobTypeIds } } });
    const jobTypeMap = new Map(jobTypes.map((jt) => [jt.id, jt]));

    for (const item of body.items) {
      if (!jobTypeMap.has(item.jobTypeId)) {
        return error(`Job type id ${item.jobTypeId} not found`);
      }
    }

    const plannedDate = body.plannedDate ? new Date(body.plannedDate) : null;
    const name = body.name?.trim() || `${customer.name} - ${body.items.length} job${body.items.length === 1 ? "" : "s"}`;

    const workPackage = await prisma.jobGroup.create({
      data: {
        organisationId,
        name,
        isTemplate: false,
        customerId: body.customerId,
        status: "active",
        jobs: {
          create: body.items.map((item) => {
            const jt = jobTypeMap.get(item.jobTypeId)!;
            return {
              customerId: body.customerId,
              jobTypeId: item.jobTypeId,
              assignedToUserId: body.assignedToUserId ?? null,
              plannedDate,
              title: jt.name,
              description: item.notes || null,
              unitType: jt.billingUnit,
              status: "scheduled" as const,
              jobFields: body.fieldIds?.length
                ? { create: body.fieldIds.map((fieldId) => ({ fieldId })) }
                : undefined,
            };
          }),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        jobs: {
          include: {
            jobType: { select: { id: true, name: true } },
            jobFields: { include: { field: { select: { id: true, fieldName: true } } } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });

    return success(workPackage, 201);
  } catch (err) {
    return serverError(err);
  }
}
