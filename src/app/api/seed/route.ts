// src/app/api/seed/route.ts
// Convenience endpoint to trigger re-seeding from the browser
// WARNING: This drops all data! Remove before production.

import { prisma } from "@/lib/db";
import { success, serverError } from "@/lib/api-helpers";

export async function POST() {
  try {
    // Clear in dependency order
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.jobLog.deleteMany();
    await prisma.job.deleteMany();
    await prisma.field.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.machine.deleteMany();
    await prisma.jobType.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organisation.deleteMany();

    return success({
      message: "Database cleared. Run `npx prisma db seed` to re-seed.",
      cleared: true,
    });
  } catch (err) {
    return serverError(err);
  }
}
