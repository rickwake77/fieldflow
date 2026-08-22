// src/app/api/customers/import/route.ts
import { prisma } from "@/lib/db";
import { success, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { processCsvUpsert } from "@/lib/csv-import";

type CustomerRow = {
  id?: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { csv } = await parseBody<{ csv: string }>(request);

    const result = await processCsvUpsert<CustomerRow>(
      csv,
      (raw, rowNum) => {
        const name = raw.name?.trim();
        if (!name) return { error: "name is required" };
        return {
          id: raw.id?.trim() ? Number(raw.id) : undefined,
          name,
          contact: raw.contact?.trim() || undefined,
          phone: raw.phone?.trim() || undefined,
          email: raw.email?.trim() || undefined,
          address: raw.address?.trim() || undefined,
        };
      },
      async (row) => {
        const { id, ...data } = row;
        if (id) {
          const existing = await prisma.customer.findUnique({ where: { id } });
          if (!existing) throw new Error(`Customer id ${id} not found`);
          await prisma.customer.update({ where: { id }, data });
          return "updated";
        }
        // No id in the row -- match by name so re-importing the same file
        // (e.g. one exported/edited without an id column) updates the
        // existing customer instead of creating a duplicate.
        const existing = await prisma.customer.findFirst({
          where: { name: { equals: data.name, mode: "insensitive" } },
        });
        if (existing) {
          await prisma.customer.update({ where: { id: existing.id }, data });
          return "updated";
        }
        await prisma.customer.create({ data });
        return "created";
      }
    );

    return success(result);
  } catch (err) {
    return serverError(err);
  }
}
