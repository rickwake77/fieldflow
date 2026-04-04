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
      extraItems?: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        vatApplicable?: boolean;
      }>;
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
    const jobItems = jobs.map((job) => {
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
        vatApplicable: job.jobType.vatApplicable,
      };
    });

    // Build extra line items
    const extraItems = (body.extraItems || []).map((item) => ({
      jobId: null as number | null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
      vatApplicable: item.vatApplicable === true,
    }));

    const items = [...jobItems, ...extraItems];

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    // VAT at 20% only on items where vatApplicable is true
    const vatableTotal = items
      .filter((item) => item.vatApplicable)
      .reduce((sum, item) => sum + item.totalPrice, 0);
    const vat = Math.round(vatableTotal * 0.2 * 100) / 100;
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
          create: items.map(({ vatApplicable, ...item }) => ({ ...item, vatApplicable })),
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
