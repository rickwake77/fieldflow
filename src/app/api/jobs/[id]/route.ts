// src/app/api/jobs/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth-guards";

type Params = { params: Promise<{ id: string }> };

const isManager = (role: string) => role === "admin" || role === "job_admin";

// GET /api/jobs/:id — full detail with logs
export async function GET(_request: Request, { params }: Params) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        jobFields: { include: { field: true } },
        jobType: true,
        assignedTo: { select: { id: true, name: true, phone: true } },
        createdByUser: { select: { id: true, name: true } },
        jobLogs: {
          include: {
            contractor: { select: { id: true, name: true } },
            logMachines: { include: { machine: { select: { id: true, name: true, registration: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
        invoiceItems: {
          include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
        },
      },
    });
    if (!job) return error("Job not found", 404);
    if (!isManager(role) && job.assignedToUserId !== userId) {
      return error("Not authorized", 403);
    }
    return success(job);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/jobs/:id — update job (including status changes).
// Contractors may only change the status of a job assigned to them (the
// offline-critical path); everything else — reassigning, retitling,
// rescheduling — is an admin/job_admin action.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const { id } = await params;
    const existing = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Job not found", 404);

    const body = await parseBody<Partial<{
      assignedToUserId: number;
      title: string;
      description: string;
      plannedDate: string;
      estimatedQuantity: number;
      unitType: string;
      status: string;
      fieldIds: number[];
      noLogRequired: boolean;
    }>>(request);

    if (!isManager(role)) {
      if (existing.assignedToUserId !== userId) return error("Not authorized", 403);
      const fields = Object.keys(body);
      if (fields.some((f) => f !== "status")) {
        return error("Contractors can only update job status", 403);
      }
    }

    // A job can't be marked completed with nothing actually logged against
    // it, unless it's flagged as not needing logging (supply only, hire, etc.)
    if (body.status === "completed" && !(body.noLogRequired ?? existing.noLogRequired)) {
      const logCount = await prisma.jobLog.count({ where: { jobId: Number(id) } });
      if (logCount === 0) {
        return error("Log some work against this job before marking it completed");
      }
    }

    const { fieldIds, ...scalarBody } = body;
    const data: Record<string, unknown> = { ...scalarBody };
    if (body.plannedDate) data.plannedDate = new Date(body.plannedDate);
    if (fieldIds) {
      data.jobFields = { deleteMany: {}, create: fieldIds.map((fieldId) => ({ fieldId })) };
    }

    const job = await prisma.job.update({
      where: { id: Number(id) },
      data,
      include: {
        customer: { select: { id: true, name: true } },
        jobFields: { include: { field: { select: { id: true, fieldName: true } } } },
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
    const { session, response } = await requireAuth();
    if (response) return response;
    if (!isManager((session.user as any).role)) return error("Not authorized", 403);

    const { id } = await params;
    // Delete related logs first
    await prisma.jobLog.deleteMany({ where: { jobId: Number(id) } });
    await prisma.job.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
