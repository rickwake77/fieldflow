// src/app/api/jobs/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/jobs/:id — full detail with logs
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        field: true,
        jobType: true,
        assignedTo: { select: { id: true, name: true, phone: true } },
        createdByUser: { select: { id: true, name: true } },
        jobLogs: {
          include: {
            contractor: { select: { id: true, name: true } },
            machine: { select: { id: true, name: true, registration: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        invoiceItems: {
          include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
        },
      },
    });
    if (!job) return error("Job not found", 404);
    return success(job);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/jobs/:id — update job (including status changes)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      assignedToUserId: number;
      title: string;
      description: string;
      plannedDate: string;
      estimatedQuantity: number;
      unitType: string;
      status: string;
    }>>(request);

    const data: Record<string, unknown> = { ...body };
    if (body.plannedDate) data.plannedDate = new Date(body.plannedDate);

    const job = await prisma.job.update({
      where: { id: Number(id) },
      data,
      include: {
        customer: { select: { id: true, name: true } },
        field: { select: { id: true, fieldName: true } },
        jobType: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    return success(job);
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/jobs/:id
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    // Delete related logs first
    await prisma.jobLog.deleteMany({ where: { jobId: Number(id) } });
    await prisma.job.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
