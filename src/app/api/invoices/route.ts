// src/app/api/invoices/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

// GET /api/invoices
export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        items: { include: { job: { select: { id: true, title: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
    });
    return success(invoices);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/invoices — generate invoice from completed jobs
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      customerId: number;
      jobIds: number[];
      dueInDays?: number; // defaults to 30
    }>(request);

    if (!body.customerId || !body.jobIds?.length) {
      return error("customerId and jobIds are required");
    }

    // Fetch the jobs with their types to calculate pricing
    const jobs = await prisma.job.findMany({
      where: { id: { in: body.jobIds }, customerId: body.customerId },
      include: {
        jobType: true,
        field: true,
        jobLogs: true,
      },
    });

    if (jobs.length === 0) return error("No matching jobs found");

    // Build line items from job data
    const items = jobs.map((job) => {
      // Use actual logged quantity if available, otherwise estimated
      const totalQty = job.jobLogs.reduce(
        (sum, log) => sum + Number(log.quantityCompleted),
        0
      );
      const quantity = totalQty > 0 ? totalQty : Number(job.estimatedQuantity || 0);
      const unitPrice = Number(job.jobType.defaultRate);
      const totalPrice = Math.round(quantity * unitPrice * 100) / 100;

      return {
        jobId: job.id,
        description: `${job.jobType.name}${job.field ? ` — ${job.field.fieldName}` : ""} (${quantity} ${job.jobType.billingUnit}s @ £${unitPrice}/${job.jobType.billingUnit})`,
        quantity,
        unitPrice,
        totalPrice,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const vat = Math.round(subtotal * 0.2 * 100) / 100; // 20% UK VAT
    const total = Math.round((subtotal + vat) * 100) / 100;

    // Generate invoice number
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: `INV-${year}` },
      },
    });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, "0")}`;

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (body.dueInDays || 30));

    const invoice = await prisma.invoice.create({
      data: {
        customerId: body.customerId,
        invoiceNumber,
        invoiceDate: today,
        dueDate,
        status: "draft",
        subtotal,
        vat,
        total,
        items: {
          create: items,
        },
      },
      include: {
        customer: true,
        items: { include: { job: { select: { id: true, title: true } } } },
      },
    });

    return success(invoice, 201);
  } catch (err) {
    return serverError(err);
  }
}
