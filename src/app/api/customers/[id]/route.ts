// src/app/api/customers/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/:id
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      include: {
        fields: true,
        jobs: {
          include: { jobType: true, field: true, assignedTo: { select: { id: true, name: true } } },
          orderBy: { plannedDate: "desc" },
        },
        invoices: { orderBy: { invoiceDate: "desc" } },
      },
    });
    if (!customer) return error("Customer not found", 404);
    return success(customer);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/customers/:id
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      name: string;
      contact: string;
      phone: string;
      email: string;
      address: string;
    }>>(request);

    const customer = await prisma.customer.update({
      where: { id: Number(id) },
      data: body,
    });
    return success(customer);
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/customers/:id
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.customer.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
