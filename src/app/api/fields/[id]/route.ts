// src/app/api/fields/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const field = await prisma.field.findUnique({
      where: { id: Number(id) },
      include: { customer: true, jobs: { include: { jobType: true } } },
    });
    if (!field) return error("Field not found", 404);
    return success(field);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      fieldName: string;
      hectares: number;
      boundaryGeojson: string;
      notes: string;
    }>>(request);
    const field = await prisma.field.update({ where: { id: Number(id) }, data: body });
    return success(field);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.field.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
