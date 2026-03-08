// src/app/api/job-types/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      name: string;
      billingUnit: string;
      defaultRate: number;
      description: string;
    }>>(request);
    const jobType = await prisma.jobType.update({ where: { id: Number(id) }, data: body });
    return success(jobType);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    // Check if any jobs use this type
    const jobCount = await prisma.job.count({ where: { jobTypeId: Number(id) } });
    if (jobCount > 0) return error(`Cannot delete: ${jobCount} jobs use this type`);
    await prisma.jobType.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
