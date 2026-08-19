// src/app/api/customers/export/route.ts
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { csvResponse } from "@/lib/csv-import";

const COLUMNS = ["id", "name", "contact", "phone", "email", "address"];

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    return csvResponse("customers.csv", COLUMNS, customers);
  } catch (err) {
    return serverError(err);
  }
}
