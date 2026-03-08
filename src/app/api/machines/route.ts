// src/app/api/machines/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

export async function GET() {
  try {
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
    const body = await parseBody<{
      organisationId: number;
      name: string;
      machineType: string;
      registration?: string;
    }>(request);

    if (!body.name || !body.machineType || !body.organisationId) {
      return error("name, machineType, and organisationId are required");
    }

    const machine = await prisma.machine.create({ data: body });
    return success(machine, 201);
  } catch (err) {
    return serverError(err);
  }
}
