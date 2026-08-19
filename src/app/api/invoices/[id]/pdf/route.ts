// src/app/api/invoices/[id]/pdf/route.ts
//
// Generates a PDF invoice — same data as the docx version, laid out to
// match the company letterhead, ready to email as-is (no editing needed).

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/lib/invoice-pdf";
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
          include: {
            job: {
              select: {
                id: true,
                title: true,
                field: { select: { fieldName: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // react-pdf's types require a ReactElement<DocumentProps>; InvoicePdf renders one but isn't typed as returning one
    const buffer = await renderToBuffer(createElement(InvoicePdf, { invoice }) as any);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Error generating invoice PDF:", err);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF" },
      { status: 500 }
    );
  }
}
