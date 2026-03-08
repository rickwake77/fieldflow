// src/app/api/customers/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

// GET /api/customers — list all customers with field count
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        fields: { select: { id: true, fieldName: true, hectares: true } },
        _count: { select: { jobs: true, invoices: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(customers);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/customers — create a new customer
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      name: string;
      contact?: string;
      phone?: string;
      email?: string;
      address?: string;
    }>(request);

    if (!body.name) return error("Customer name is required");

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        contact: body.contact,
        phone: body.phone,
        email: body.email,
        address: body.address,
      },
    });
    return success(customer, 201);
  } catch (err) {
    return serverError(err);
  }
}
