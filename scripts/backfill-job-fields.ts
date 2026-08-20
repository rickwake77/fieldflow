// scripts/backfill-job-fields.ts
//
// One-off migration: copies every existing Job.fieldId into the new
// JobField join table (a job can now span multiple fields). The old
// fieldId column is left in place untouched — this script only adds rows,
// it never removes anything, so it's safe to run more than once.
//
//   npx tsx scripts/backfill-job-fields.ts            (dry run — reports counts)
//   npx tsx scripts/backfill-job-fields.ts --confirm   (actually writes)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmed = process.argv.includes("--confirm");

async function main() {
  const jobsWithField = await prisma.job.findMany({
    where: { fieldId: { not: null } },
    select: { id: true, fieldId: true },
  });

  let toCreate = 0;
  let alreadyPresent = 0;

  for (const job of jobsWithField) {
    const existing = await prisma.jobField.findUnique({
      where: { jobId_fieldId: { jobId: job.id, fieldId: job.fieldId! } },
    });
    if (existing) alreadyPresent++;
    else toCreate++;
  }

  console.log(`Jobs with a fieldId set: ${jobsWithField.length}`);
  console.log(`  Already migrated:      ${alreadyPresent}`);
  console.log(`  Will be created:       ${toCreate}`);

  if (!confirmed) {
    console.log("\nDry run only — nothing was written. Re-run with --confirm to actually migrate.");
    return;
  }

  console.log("\n--confirm passed — migrating now...");
  let created = 0;
  for (const job of jobsWithField) {
    await prisma.jobField.upsert({
      where: { jobId_fieldId: { jobId: job.id, fieldId: job.fieldId! } },
      update: {},
      create: { jobId: job.id, fieldId: job.fieldId! },
    });
    created++;
  }

  console.log(`Done. ${created} job/field links ensured. The old fieldId column was not touched.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
