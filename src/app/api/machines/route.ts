// src/app/api/machines/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireManager } from "@/lib/auth-guards";

export async function GET() {
  try {
    const { response } = await requireAuth();
    if (response) return response;

    const machines = await prisma.machine.findMany({
      include: { _count: { select: { jobLogs: true } } },
      orderBy: { name: "asc" },
    });
    return success(machines);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, response } = await requireManager();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const body = await parseBody<{
      name: string;
      machineType: string;
      registration?: string;
    }>(request);

    if (!body.name || !body.machineType) {
      return error("name and machineType are required");
    }

    const machine = await prisma.machine.create({ data: { ...body, organisationId } });
    return success(machine, 201);
  } catch (err) {
    return serverError(err);
  }
}
