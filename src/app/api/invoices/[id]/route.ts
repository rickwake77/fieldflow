// src/app/api/invoices/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: { job: { select: { id: true, title: true, field: { select: { fieldName: true } } } } },
        },
        createdByUser: { select: { id: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
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
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Invoice not found", 404);

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

    // Locked once approved (or beyond) — only Draft invoices can have their
    // line items rewritten. Use the reject endpoint to send one back to Draft first.
    if (body.items?.length && existing.status !== "draft") {
      return error("Approved invoices can't be edited");
    }

    // The approval step is meaningless if you can skip straight to "sent"
    if (body.status === "sent" && existing.status !== "approved") {
      return error("Invoice must be approved before it can be sent");
    }

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
          // Editing and saving a rejected invoice counts as resubmitting it —
          // clear the old comment so the approver can tell it's been addressed
          rejectionComment: null,
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
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Invoice not found", 404);
    if (existing.status !== "draft") return error("Only draft invoices can be deleted");

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: Number(id) } });
    await prisma.invoice.delete({ where: { id: Number(id) } });
    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
