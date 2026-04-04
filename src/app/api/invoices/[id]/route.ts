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

// PATCH — status updates, or full line-item edit for draft invoices
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await parseBody<Partial<{
      status: string;
      dueDate: string;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        vatApplicable: boolean;
        jobId?: number | null;
      }>;
    }>>(request);

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.dueDate) data.dueDate = new Date(body.dueDate);

    // If items are provided, replace all line items and recalculate totals
    if (body.items?.length) {
      const items = body.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
        vatApplicable: item.vatApplicable !== false,
        jobId: item.jobId ?? null,
      }));

      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const vatableTotal = items
        .filter((item) => item.vatApplicable)
        .reduce((sum, item) => sum + item.totalPrice, 0);
      const vat = Math.round(vatableTotal * 0.2 * 100) / 100;
      const total = Math.round((subtotal + vat) * 100) / 100;

      // Delete existing items and recreate
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: Number(id) } });

      const invoice = await prisma.invoice.update({
        where: { id: Number(id) },
        data: {
          ...data,
          subtotal,
          vat,
          total,
          items: { create: items },
        },
        include: {
          customer: true,
          items: { include: { job: { select: { id: true, title: true } } } },
        },
      });
      return success(invoice);
    }

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
