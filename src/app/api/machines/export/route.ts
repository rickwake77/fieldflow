// src/app/api/machines/export/route.ts
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { csvResponse } from "@/lib/csv-import";

const COLUMNS = ["id", "name", "machineType", "registration", "active"];

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const machines = await prisma.machine.findMany({ orderBy: { name: "asc" } });
    return csvResponse("machines.csv", COLUMNS, machines);
  } catch (err) {
    return serverError(err);
  }
}
