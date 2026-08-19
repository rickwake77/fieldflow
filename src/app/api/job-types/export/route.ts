// src/app/api/job-types/export/route.ts
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { csvResponse } from "@/lib/csv-import";

const COLUMNS = ["id", "name", "billingUnit", "defaultRate", "vatApplicable", "description"];

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const jobTypes = await prisma.jobType.findMany({ orderBy: { name: "asc" } });
    const rows = jobTypes.map((jt) => ({
      ...jt,
      defaultRate: Number(jt.defaultRate),
    }));
    return csvResponse("job-types.csv", COLUMNS, rows);
  } catch (err) {
    return serverError(err);
  }
}
