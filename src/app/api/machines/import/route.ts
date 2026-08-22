// src/app/api/machines/import/route.ts
import { prisma } from "@/lib/db";
import { success, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { processCsvUpsert, parseCsvBool } from "@/lib/csv-import";

type MachineRow = {
  id?: number;
  name: string;
  machineType: string;
  registration?: string;
  active: boolean;
};

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session!.user as any).organisationId;

    const { csv } = await parseBody<{ csv: string }>(request);

    const result = await processCsvUpsert<MachineRow>(
      csv,
      (raw, rowNum) => {
        const name = raw.name?.trim();
        const machineType = raw.machineType?.trim();
        if (!name) return { error: "name is required" };
        if (!machineType) return { error: "machineType is required" };
        return {
          id: raw.id?.trim() ? Number(raw.id) : undefined,
          name,
          machineType,
          registration: raw.registration?.trim() || undefined,
          active: parseCsvBool(raw.active, true),
        };
      },
      async (row) => {
        const { id, ...data } = row;
        if (id) {
          const existing = await prisma.machine.findUnique({ where: { id } });
          if (!existing) throw new Error(`Machine id ${id} not found`);
          await prisma.machine.update({ where: { id }, data });
          return "updated";
        }
        // No id in the row. Unlike customers/job types, machine names can
        // legitimately repeat (two of the same model) -- so a name match
        // isn't auto-updated, just flagged for the admin to check, and the
        // row is still created as a new machine.
        const existing = await prisma.machine.findFirst({
          where: { organisationId, name: { equals: data.name, mode: "insensitive" } },
        });
        const created = await prisma.machine.create({ data: { ...data, organisationId } });
        if (existing) {
          return {
            outcome: "created",
            warning: `A machine named "${data.name}" already existed (id ${existing.id}) -- created as a new machine (id ${created.id}). If this was meant to update the existing one, delete this row and re-import with an id column.`,
          };
        }
        return "created";
      }
    );

    return success(result);
  } catch (err) {
    return serverError(err);
  }
}
