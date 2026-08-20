// src/app/api/invoices/[id]/reject/route.ts
// Rejecting sends a draft invoice back for edits with a required comment —
// self-rejection is fine (equivalent to just editing it yourself), the
// self-approval restriction is what lives on the approve route instead.

import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const existing = await prisma.invoice.findUnique({ where: { id: Number(id) } });
    if (!existing) return error("Invoice not found", 404);
    if (existing.status !== "draft") return error("Only draft invoices can be rejected");

    const body = await parseBody<{ comment: string }>(request);
    const comment = body.comment?.trim();
    if (!comment) return error("A comment is required when rejecting an invoice");

    const invoice = await prisma.invoice.update({
      where: { id: Number(id) },
      data: {
        status: "draft",
        rejectionComment: comment,
      },
      include: {
        customer: true,
        items: { include: { job: { select: { id: true, title: true } } } },
        createdByUser: { select: { id: true, name: true } },
      },
    });
    return success(invoice);
  } catch (err) {
    return serverError(err);
  }
}
