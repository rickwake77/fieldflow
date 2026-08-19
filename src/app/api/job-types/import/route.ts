// src/app/api/job-types/import/route.ts
import { prisma } from "@/lib/db";
import { success, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { processCsvUpsert, parseCsvBool } from "@/lib/csv-import";

type JobTypeRow = {
  id?: number;
  name: string;
  billingUnit: string;
  defaultRate: number;
  vatApplicable: boolean;
  description?: string;
};

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session!.user as any).organisationId;

    const { csv } = await parseBody<{ csv: string }>(request);

    const result = await processCsvUpsert<JobTypeRow>(
      csv,
      (raw, rowNum) => {
        const name = raw.name?.trim();
        const billingUnit = raw.billingUnit?.trim();
        const defaultRate = Number(raw.defaultRate);
        if (!name) return { error: "name is required" };
        if (!billingUnit) return { error: "billingUnit is required" };
        if (!raw.defaultRate?.trim() || !Number.isFinite(defaultRate) || defaultRate < 0) {
          return { error: "defaultRate must be a non-negative number" };
        }
        return {
          id: raw.id?.trim() ? Number(raw.id) : undefined,
          name,
          billingUnit,
          defaultRate,
          vatApplicable: parseCsvBool(raw.vatApplicable, true),
          description: raw.description?.trim() || undefined,
        };
      },
      async (row) => {
        const { id, ...data } = row;
        if (id) {
          const existing = await prisma.jobType.findUnique({ where: { id } });
          if (!existing) throw new Error(`Job type id ${id} not found`);
          await prisma.jobType.update({ where: { id }, data });
          return "updated";
        }
        await prisma.jobType.create({ data: { ...data, organisationId } });
        return "created";
      }
    );

    return success(result);
  } catch (err) {
    return serverError(err);
  }
}
