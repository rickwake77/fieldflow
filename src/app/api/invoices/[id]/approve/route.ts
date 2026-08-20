// src/app/api/invoices/[id]/approve/route.ts
// An admin approves a draft invoice — must be a different admin than
// whoever created it, a genuine second set of eyes rather than a formality.

import { prisma } from "@/lib/db";
import { success, error, serverError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const userId = (session.user as any).id;

    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Invoice not found", 404);
    if (existing.status !== "draft") return error("Only draft invoices can be approved");
    if (existing.createdBy === userId) return error("You can't approve an invoice you created", 403);

    const invoice = await prisma.invoice.update({
      where: { id: Number(id) },
      data: {
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionComment: null,
      },
      include: {
        customer: true,
        items: { include: { job: { select: { id: true, title: true } } } },
        createdByUser: { select: { id: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
      },
    });
    return success(invoice);
  } catch (err) {
    return serverError(err);
  }
}
