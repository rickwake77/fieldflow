// src/app/api/machines/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      name: string;
      machineType: string;
      registration: string;
      active: boolean;
    }>>(request);
    const machine = await prisma.machine.update({ where: { id: Number(id) }, data: body });
    return success(machine);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const logCount = await prisma.jobLog.count({ where: { machineId: Number(id) } });
    if (logCount > 0) return error(`Cannot delete: ${logCount} work logs reference this machine. Deactivate instead.`);
    await prisma.machine.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
