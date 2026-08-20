// scripts/clear-test-data.ts
//
// One-off cleanup: wipes all operational/test data (Jobs, Job Logs, Invoices,
// Job Types, Machines, Customers, Fields, Work Orders/Templates) while
// KEEPING Users and the Organisation, so nobody gets locked out of login.
//
// Safe by default: run with no flags to see counts of what WOULD be deleted.
// Add --confirm to actually delete.
//
//   npx tsx scripts/clear-test-data.ts            (dry run — just reports counts)
//   npx tsx scripts/clear-test-data.ts --confirm   (actually deletes)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmed = process.argv.includes("--confirm");

async function main() {
  const counts = {
    invoiceItems: await prisma.invoiceItem.count(),
    invoices: await prisma.invoice.count(),
    jobLogs: await prisma.jobLog.count(),
    jobs: await prisma.job.count(),
    jobGroupItems: await prisma.jobGroupItem.count(),
    jobGroups: await prisma.jobGroup.count(),
    fields: await prisma.field.count(),
    machines: await prisma.machine.count(),
    jobTypes: await prisma.jobType.count(),
    customers: await prisma.customer.count(),
  };

  console.log("This will delete:");
  console.log(`  Invoice items:      ${counts.invoiceItems}`);
  console.log(`  Invoices:           ${counts.invoices}`);
  console.log(`  Job logs:           ${counts.jobLogs}`);
  console.log(`  Jobs:               ${counts.jobs}`);
  console.log(`  Work order items:   ${counts.jobGroupItems}`);
  console.log(`  Work orders/templates: ${counts.jobGroups}`);
  console.log(`  Fields:             ${counts.fields}`);
  console.log(`  Machines:           ${counts.machines}`);
  console.log(`  Job types:          ${counts.jobTypes}`);
  console.log(`  Customers:          ${counts.customers}`);
  console.log("");
  console.log("Users and Organisation records are NOT touched.");

  if (!confirmed) {
    console.log("\nDry run only — nothing was deleted. Re-run with --confirm to actually delete.");
    return;
  }

  console.log("\n--confirm passed — deleting now...");

  // Dependency order: children before parents
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.job.deleteMany();
  await prisma.jobGroupItem.deleteMany();
  await prisma.jobGroup.deleteMany();
  await prisma.field.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.jobType.deleteMany();
  await prisma.customer.deleteMany();

  console.log("Done. All operational data cleared; Users and Organisation left intact.");
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
