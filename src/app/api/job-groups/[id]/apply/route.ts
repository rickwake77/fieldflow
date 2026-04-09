// src/app/api/job-groups/[id]/apply/route.ts
// Applies a package template to a customer, creating a work order with individual jobs.
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<{
      customerId: number;
      organisationId: number;
      assignedToUserId?: number;
      fieldId?: number;
      plannedDate?: string;
      // Optional per-item overrides: keyed by jobTypeId
      overrides?: Record<string, { fieldId?: number; plannedDate?: string; assignedToUserId?: number }>;
    }>(request);

    if (!body.customerId || !body.organisationId) {
      return error("customerId and organisationId are required");
    }

    // Load the template
    const template = await prisma.jobGroup.findUnique({
      where: { id: Number(id) },
      include: {
        templateItems: {
          include: { jobType: true },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!template) return error("Template not found", 404);
    if (!template.isTemplate) return error("This group is not a template");
    if (template.templateItems.length === 0) return error("Template has no items");

    // Create a new work order (non-template group) for this customer
    const workOrder = await prisma.jobGroup.create({
      data: {
        organisationId: body.organisationId,
        name: template.name,
        description: template.description,
        isTemplate: false,
        customerId: body.customerId,
        status: "active",
        jobs: {
          create: template.templateItems.map((item) => {
            const override = body.overrides?.[String(item.jobTypeId)] ?? {};
            return {
              customerId: body.customerId,
              jobTypeId: item.jobTypeId,
              fieldId: override.fieldId ?? body.fieldId ?? null,
              assignedToUserId: override.assignedToUserId ?? body.assignedToUserId ?? null,
              plannedDate: override.plannedDate
                ? new Date(override.plannedDate)
                : body.plannedDate
                ? new Date(body.plannedDate)
                : null,
              title: item.jobType.name,
              description: item.notes ?? null,
              unitType: item.jobType.billingUnit,
              status: "scheduled",
            };
          }),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        jobs: {
          include: {
            jobType: { select: { id: true, name: true } },
            field: { select: { id: true, fieldName: true } },
          },
        },
      },
    });

    return success(workOrder, 201);
  } catch (err) {
    return serverError(err);
  }
}
