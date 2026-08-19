// src/app/api/seed/route.ts
// Convenience endpoint to trigger re-seeding from the browser
// WARNING: This drops all data! Admin-only, and hard-disabled outside
// local development regardless of role — a compromised admin session
// shouldn't be able to wipe a production database via a dev convenience tool.

import { prisma } from "@/lib/db";
import { success, error, serverError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return error("This endpoint is disabled in production", 404);
    }
    const { response } = await requireAdmin();
    if (response) return response;

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
