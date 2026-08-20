// scripts/backfill-job-log-machines.ts
//
// One-off migration: copies every existing JobLog.machineId into the new
// JobLogMachine join table (a work log can now involve multiple machines).
// The old machineId column is left in place untouched — this script only
// adds rows, it never removes anything, so it's safe to run more than once.
//
//   npx tsx scripts/backfill-job-log-machines.ts            (dry run — reports counts)
//   npx tsx scripts/backfill-job-log-machines.ts --confirm   (actually writes)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmed = process.argv.includes("--confirm");

async function main() {
  const logsWithMachine = await prisma.jobLog.findMany({
    where: { machineId: { not: null } },
    select: { id: true, machineId: true },
  });

  let toCreate = 0;
  let alreadyPresent = 0;

  for (const log of logsWithMachine) {
    const existing = await prisma.jobLogMachine.findUnique({
      where: { jobLogId_machineId: { jobLogId: log.id, machineId: log.machineId! } },
    });
    if (existing) alreadyPresent++;
    else toCreate++;
  }

  console.log(`Job logs with a machineId set: ${logsWithMachine.length}`);
  console.log(`  Already migrated:            ${alreadyPresent}`);
  console.log(`  Will be created:             ${toCreate}`);

  if (!confirmed) {
    console.log("\nDry run only — nothing was written. Re-run with --confirm to actually migrate.");
    return;
  }

  console.log("\n--confirm passed — migrating now...");
  let created = 0;
  for (const log of logsWithMachine) {
    await prisma.jobLogMachine.upsert({
      where: { jobLogId_machineId: { jobLogId: log.id, machineId: log.machineId! } },
      update: {},
      create: { jobLogId: log.id, machineId: log.machineId! },
    });
    created++;
  }

  console.log(`Done. ${created} log/machine links ensured. The old machineId column was not touched.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
