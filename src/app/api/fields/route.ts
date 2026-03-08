// src/app/api/fields/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

// GET /api/fields?customerId=1 — list fields, optionally filter by customer
export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customerId");
    const fields = await prisma.field.findMany({
      where: customerId ? { customerId: Number(customerId) } : undefined,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { fieldName: "asc" },
    });
    return success(fields);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/fields
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      customerId: number;
      fieldName: string;
      hectares: number;
      boundaryGeojson?: string;
      notes?: string;
    }>(request);

    if (!body.customerId || !body.fieldName) return error("customerId and fieldName are required");

    const field = await prisma.field.create({
      data: {
        customerId: body.customerId,
        fieldName: body.fieldName,
        hectares: body.hectares || 0,
        boundaryGeojson: body.boundaryGeojson,
        notes: body.notes,
      },
    });
    return success(field, 201);
  } catch (err) {
    return serverError(err);
  }
}
