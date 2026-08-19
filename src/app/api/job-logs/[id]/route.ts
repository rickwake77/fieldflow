// src/app/api/job-logs/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth-guards";

type Params = { params: Promise<{ id: string }> };

const isManager = (role: string) => role === "admin" || role === "job_admin";

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const { id } = await params;
    const existing = await prisma.jobLog.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Log not found", 404);
    if (!isManager(role) && existing.contractorId !== userId) return error("Not authorized", 403);

    const body = await parseBody<Partial<{
      quantityCompleted: number;
      hoursWorked: number;
      notes: string;
      machineId: number;
    }>>(request);
    const log = await prisma.jobLog.update({ where: { id: Number(id) }, data: body });
    return success(log);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const { id } = await params;
    const existing = await prisma.jobLog.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Log not found", 404);
    if (!isManager(role) && existing.contractorId !== userId) return error("Not authorized", 403);

    await prisma.jobLog.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
