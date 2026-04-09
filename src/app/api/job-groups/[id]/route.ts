// src/app/api/job-groups/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

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
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const group = await prisma.jobGroup.findUnique({ where: { id: Number(id) }, include });
    if (!group) return error("Not found", 404);
    return success(group);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      name: string;
      description: string;
      status: string;
      templateItems: Array<{ jobTypeId: number; sequence: number; notes?: string }>;
    }>>(request);

    // If updating template items, replace them all
    if (body.templateItems) {
      await prisma.jobGroupItem.deleteMany({ where: { jobGroupId: Number(id) } });
      await prisma.jobGroupItem.createMany({
        data: body.templateItems.map((item) => ({ ...item, jobGroupId: Number(id) })),
      });
    }

    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.status) data.status = body.status;

    const group = await prisma.jobGroup.update({ where: { id: Number(id) }, data, include });
    return success(group);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    // Unlink jobs from the group rather than deleting them
    await prisma.job.updateMany({ where: { jobGroupId: Number(id) }, data: { jobGroupId: null } });
    await prisma.jobGroupItem.deleteMany({ where: { jobGroupId: Number(id) } });
    await prisma.jobGroup.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
