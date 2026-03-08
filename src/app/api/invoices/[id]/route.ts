// src/app/api/invoices/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: { job: { select: { id: true, title: true, field: { select: { fieldName: true } } } } },
        },
      },
    });
    if (!invoice) return error("Invoice not found", 404);
    return success(invoice);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH — mainly for status updates (draft → sent → paid)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      status: string;
      dueDate: string;
    }>>(request);

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.dueDate) data.dueDate = new Date(body.dueDate);

    const invoice = await prisma.invoice.update({
      where: { id: Number(id) },
      data,
    });
    return success(invoice);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: Number(id) } });
    await prisma.invoice.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
