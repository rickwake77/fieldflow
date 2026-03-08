// prisma/seed.ts
// Realistic test data for a UK farming contracting business

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding FieldFlow database...\n");

  // Hash a default password for all test users
  // Password: "fieldflow" for all test accounts
  const defaultHash = await bcrypt.hash("fieldflow", 12);

  // ── Organisation ──────────────────────────────────────────
  const org = await prisma.organisation.create({
    data: { name: "Wakeham Contractors" },
  });
  console.log(`✓ Organisation: ${org.name}`);

  // ── Users ─────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.create({
      data: {
        organisationId: org.id,
        name: "Rick Wakeham",
        email: "rickwakeham@hotmail.com",
        phone: "07789 393388",
        passwordHash: defaultHash,
        role: "admin",
      },
    }),
    prisma.user.create({
      data: {
        organisationId: org.id,
        name: "Jack Henderson",
        email: "jack@hendersonag.co.uk",
        phone: "07723 456789",
        passwordHash: defaultHash,
        role: "contractor",
      },
    }),
    prisma.user.create({
      data: {
        organisationId: org.id,
        name: "Mike Davies",
        email: "mike@hendersonag.co.uk",
        phone: "07734 567890",
        passwordHash: defaultHash,
        role: "contractor",
      },
    }),
    prisma.user.create({
      data: {
        organisationId: org.id,
        name: "Steve Parry",
        email: "steve@hendersonag.co.uk",
        phone: "07745 678901",
        passwordHash: defaultHash,
        role: "contractor",
      },
    }),
  ]);
  console.log(`✓ Users: ${users.length} created`);

  const [tom, jack, mike, steve] = users;

  // ── Job Types ─────────────────────────────────────────────
  const jobTypes = await Promise.all([
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Ploughing",
        billingUnit: "hectare",
        defaultRate: 85.0,
        description: "Conventional ploughing with mouldboard plough",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Drilling",
        billingUnit: "hectare",
        defaultRate: 65.0,
        description: "Seed drilling — combinable crops",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Spraying",
        billingUnit: "hectare",
        defaultRate: 35.0,
        description: "Crop spraying — herbicide/fungicide/insecticide",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Combining",
        billingUnit: "hectare",
        defaultRate: 120.0,
        description: "Combine harvesting — cereals and oilseed rape",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Muck Spreading",
        billingUnit: "tonne",
        defaultRate: 45.0,
        description: "FYM or slurry spreading",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Hedge Cutting",
        billingUnit: "hour",
        defaultRate: 75.0,
        description: "Mechanical hedge trimming",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Baling",
        billingUnit: "job",
        defaultRate: 3.5,
        description: "Round or square baling — straw/hay/silage",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Subsoiling",
        billingUnit: "hectare",
        defaultRate: 70.0,
        description: "Deep subsoiling to break compaction pans",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Rolling",
        billingUnit: "hectare",
        defaultRate: 30.0,
        description: "Flat or Cambridge rolling",
      },
    }),
    prisma.jobType.create({
      data: {
        organisationId: org.id,
        name: "Haulage",
        billingUnit: "tonne",
        defaultRate: 55.0,
        description: "Grain or bulk haulage — trailer work",
      },
    }),
  ]);
  console.log(`✓ Job Types: ${jobTypes.length} created`);

  const [ploughing, drilling, spraying, combining, muckSpreading, hedgeCutting, baling, subsoiling, rolling, haulage] = jobTypes;

  // ── Machines ──────────────────────────────────────────────
  const machines = await Promise.all([
    prisma.machine.create({
      data: { organisationId: org.id, name: "John Deere 6250R", machineType: "Tractor", registration: "WX21 FRM" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Fendt 724 Vario", machineType: "Tractor", registration: "AK22 AGR" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Massey Ferguson 8S.265", machineType: "Tractor", registration: "BN23 TRC" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Claas Lexion 770", machineType: "Combine", registration: "BT20 HRV" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Vaderstad Rapid 600C", machineType: "Drill", registration: "N/A" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Hardi Navigator 4000", machineType: "Sprayer", registration: "N/A" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Kverneland 5 Furrow", machineType: "Plough", registration: "N/A" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "McHale Fusion 3 Plus", machineType: "Baler", registration: "N/A" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Richard Western 12T", machineType: "Trailer", registration: "N/A" },
    }),
    prisma.machine.create({
      data: { organisationId: org.id, name: "Bomford Hawk", machineType: "Hedge Cutter", registration: "N/A" },
    }),
  ]);
  console.log(`✓ Machines: ${machines.length} created`);

  const [jd6250, fendt724, mf8s, lexion, vaderstad, hardi, kverneland, mchale, trailer, bomford] = machines;

  // ── Customers ─────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Greenfield Estates",
        contact: "Robert Green",
        phone: "01234 567890",
        email: "robert@greenfieldestate.co.uk",
        address: "Manor Farm, Alton, Hampshire GU34 1AA",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Oakwood Farm",
        contact: "Sarah Williams",
        phone: "01234 567891",
        email: "sarah@oakwoodfarm.co.uk",
        address: "Oakwood Farm, Frensham, Surrey GU10 3BB",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Valley View Holdings",
        contact: "David Jones",
        phone: "01234 567892",
        email: "david@valleyview.co.uk",
        address: "Valley View, Tilford, Surrey GU10 2CC",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Blackdown Farms Ltd",
        contact: "James Blackwell",
        phone: "01428 712345",
        email: "james@blackdownfarms.co.uk",
        address: "Blackdown Farm, Haslemere, Surrey GU27 3DD",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Peper Harow Estate",
        contact: "Charles Middleton",
        phone: "01483 421567",
        email: "charles@peperharow.co.uk",
        address: "Peper Harow, Godalming, Surrey GU8 6EE",
      },
    }),
  ]);
  console.log(`✓ Customers: ${customers.length} created`);

  const [greenfield, oakwood, valleyView, blackdown, peperHarow] = customers;

  // ── Fields ────────────────────────────────────────────────
  const fields = await Promise.all([
    // Greenfield Estates
    prisma.field.create({ data: { customerId: greenfield.id, fieldName: "Top Field", hectares: 24.5, notes: "Heavy clay, watch drainage in winter" } }),
    prisma.field.create({ data: { customerId: greenfield.id, fieldName: "Bottom Meadow", hectares: 18.2, notes: "Good access from main lane" } }),
    prisma.field.create({ data: { customerId: greenfield.id, fieldName: "Long Acre", hectares: 12.8, notes: "Narrow — tight headlands" } }),
    // Oakwood Farm
    prisma.field.create({ data: { customerId: oakwood.id, fieldName: "Home Field", hectares: 32.0, notes: "Steep on south side, careful with sprayer" } }),
    prisma.field.create({ data: { customerId: oakwood.id, fieldName: "Far Pasture", hectares: 15.7, notes: "Access via track past grain store" } }),
    prisma.field.create({ data: { customerId: oakwood.id, fieldName: "Church Field", hectares: 22.4, notes: "Power lines on east boundary" } }),
    // Valley View
    prisma.field.create({ data: { customerId: valleyView.id, fieldName: "River Field", hectares: 42.3, notes: "Flood risk NE corner — avoid after heavy rain" } }),
    prisma.field.create({ data: { customerId: valleyView.id, fieldName: "Hill Ground", hectares: 28.6, notes: "Sandy loam, dries fast" } }),
    // Blackdown
    prisma.field.create({ data: { customerId: blackdown.id, fieldName: "North Piece", hectares: 36.1, notes: "Good all-round field" } }),
    prisma.field.create({ data: { customerId: blackdown.id, fieldName: "Hollow Field", hectares: 19.5, notes: "Wet hollow centre — GPS mark for sprayer" } }),
    prisma.field.create({ data: { customerId: blackdown.id, fieldName: "Beacon Hill", hectares: 44.2, notes: "High & exposed, windy" } }),
    // Peper Harow
    prisma.field.create({ data: { customerId: peperHarow.id, fieldName: "Park Field", hectares: 55.0, notes: "Estate field, keep tidy" } }),
    prisma.field.create({ data: { customerId: peperHarow.id, fieldName: "Wey Meadow", hectares: 18.9, notes: "Riverside — no spraying within 6m of bank" } }),
  ]);
  console.log(`✓ Fields: ${fields.length} created`);

  const [topField, bottomMeadow, longAcre, homeField, farPasture, churchField, riverField, hillGround, northPiece, hollowField, beaconHill, parkField, weyMeadow] = fields;

  // ── Jobs ──────────────────────────────────────────────────
  const jobs = await Promise.all([
    // Completed jobs
    prisma.job.create({
      data: {
        customerId: valleyView.id, fieldId: riverField.id, jobTypeId: hedgeCutting.id,
        assignedToUserId: mike.id, title: "Hedge Cutting — River Field",
        description: "All boundary hedges, leave 2m at river end for nesting",
        plannedDate: new Date("2026-02-20"), estimatedQuantity: 8, unitType: "hour",
        status: "completed", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: blackdown.id, fieldId: northPiece.id, jobTypeId: ploughing.id,
        assignedToUserId: jack.id, title: "Plough North Piece",
        description: "Autumn ploughing, 10\" depth, press behind",
        plannedDate: new Date("2026-02-25"), estimatedQuantity: 36.1, unitType: "hectare",
        status: "completed", createdBy: tom.id,
      },
    }),
    // In progress
    prisma.job.create({
      data: {
        customerId: greenfield.id, fieldId: bottomMeadow.id, jobTypeId: spraying.id,
        assignedToUserId: mike.id, title: "Spray Bottom Meadow",
        description: "Pre-emergence herbicide — Liberator at 0.6L/ha",
        plannedDate: new Date("2026-03-08"), estimatedQuantity: 18.2, unitType: "hectare",
        status: "in_progress", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: peperHarow.id, fieldId: parkField.id, jobTypeId: subsoiling.id,
        assignedToUserId: steve.id, title: "Subsoil Park Field",
        description: "Deep subsoiling at 18\", worst compaction on tramlines",
        plannedDate: new Date("2026-03-07"), estimatedQuantity: 55.0, unitType: "hectare",
        status: "in_progress", createdBy: tom.id,
      },
    }),
    // Scheduled — upcoming
    prisma.job.create({
      data: {
        customerId: greenfield.id, fieldId: topField.id, jobTypeId: ploughing.id,
        assignedToUserId: jack.id, title: "Plough Top Field",
        description: "Spring ploughing for potatoes, 12\" depth",
        plannedDate: new Date("2026-03-10"), estimatedQuantity: 24.5, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: oakwood.id, fieldId: homeField.id, jobTypeId: drilling.id,
        assignedToUserId: jack.id, title: "Drill Home Field",
        description: "Spring barley — KWS Tardis at 160kg/ha",
        plannedDate: new Date("2026-03-15"), estimatedQuantity: 32.0, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: oakwood.id, fieldId: farPasture.id, jobTypeId: muckSpreading.id,
        assignedToUserId: steve.id, title: "Muck Spreading — Far Pasture",
        description: "Cattle FYM, 12t/ha, spread even",
        plannedDate: new Date("2026-03-12"), estimatedQuantity: 20, unitType: "tonne",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: blackdown.id, fieldId: beaconHill.id, jobTypeId: drilling.id,
        assignedToUserId: jack.id, title: "Drill Beacon Hill",
        description: "Winter wheat — Skyfall at 180kg/ha (late drilling)",
        plannedDate: new Date("2026-03-18"), estimatedQuantity: 44.2, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: valleyView.id, fieldId: hillGround.id, jobTypeId: rolling.id,
        assignedToUserId: mike.id, title: "Roll Hill Ground",
        description: "Cambridge roll after drilling, consolidate seed bed",
        plannedDate: new Date("2026-03-20"), estimatedQuantity: 28.6, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: peperHarow.id, fieldId: weyMeadow.id, jobTypeId: spraying.id,
        assignedToUserId: mike.id, title: "Spray Wey Meadow",
        description: "T1 fungicide — Ascra at 1.0L/ha. 6m buffer from river.",
        plannedDate: new Date("2026-03-22"), estimatedQuantity: 18.9, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
    prisma.job.create({
      data: {
        customerId: greenfield.id, fieldId: longAcre.id, jobTypeId: spraying.id,
        assignedToUserId: mike.id, title: "Spray Long Acre",
        description: "Herbicide — watch for drift near houses on west side",
        plannedDate: new Date("2026-03-25"), estimatedQuantity: 12.8, unitType: "hectare",
        status: "scheduled", createdBy: tom.id,
      },
    }),
  ]);
  console.log(`✓ Jobs: ${jobs.length} created`);

  // ── Job Logs ──────────────────────────────────────────────
  const jobLogs = await Promise.all([
    // Completed: Hedge cutting river field
    prisma.jobLog.create({
      data: {
        jobId: jobs[0].id, contractorId: mike.id, machineId: jd6250.id,
        quantityCompleted: 8, hoursWorked: 8,
        notes: "All hedges done. Two gateposts need farmer's attention. Left nesting strip as requested.",
      },
    }),
    // Completed: Plough North Piece (2 logs — took 2 days)
    prisma.jobLog.create({
      data: {
        jobId: jobs[1].id, contractorId: jack.id, machineId: fendt724.id,
        quantityCompleted: 20, hoursWorked: 7.5,
        notes: "Good going, soil in nice condition. Got 20ha done before dark.",
      },
    }),
    prisma.jobLog.create({
      data: {
        jobId: jobs[1].id, contractorId: jack.id, machineId: fendt724.id,
        quantityCompleted: 16.1, hoursWorked: 6,
        notes: "Finished off. Bit sticky in the NW corner but pressed out OK.",
      },
    }),
    // In progress: Spray Bottom Meadow — partial
    prisma.jobLog.create({
      data: {
        jobId: jobs[2].id, contractorId: mike.id, machineId: fendt724.id,
        quantityCompleted: 10.5, hoursWorked: 3.5,
        notes: "Wind picked up mid-afternoon, had to stop. Will finish tomorrow morning.",
      },
    }),
    // In progress: Subsoil Park Field — partial
    prisma.jobLog.create({
      data: {
        jobId: jobs[3].id, contractorId: steve.id, machineId: mf8s.id,
        quantityCompleted: 22, hoursWorked: 8,
        notes: "Heavy going on the tramlines. Broke a point, replaced from stock.",
      },
    }),
  ]);
  console.log(`✓ Job Logs: ${jobLogs.length} created`);

  // ── Invoices ──────────────────────────────────────────────
  const invoice1 = await prisma.invoice.create({
    data: {
      customerId: valleyView.id,
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date("2026-03-01"),
      dueDate: new Date("2026-03-31"),
      status: "sent",
      subtotal: 600.0,
      vat: 120.0,
      total: 720.0,
      items: {
        create: [
          {
            jobId: jobs[0].id,
            description: "Hedge Cutting — River Field (8 hours @ £75/hr)",
            quantity: 8,
            unitPrice: 75.0,
            totalPrice: 600.0,
          },
        ],
      },
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      customerId: blackdown.id,
      invoiceNumber: "INV-2026-002",
      invoiceDate: new Date("2026-03-05"),
      dueDate: new Date("2026-04-04"),
      status: "sent",
      subtotal: 3068.5,
      vat: 613.7,
      total: 3682.2,
      items: {
        create: [
          {
            jobId: jobs[1].id,
            description: "Ploughing — North Piece (36.1 ha @ £85/ha)",
            quantity: 36.1,
            unitPrice: 85.0,
            totalPrice: 3068.5,
          },
        ],
      },
    },
  });
  console.log(`✓ Invoices: 2 created with line items`);

  console.log("\n✅ Seed complete! Your FieldFlow database is ready.\n");
  console.log("Summary:");
  console.log(`  • 1 Organisation`);
  console.log(`  • ${users.length} Users (1 admin, ${users.length - 1} contractors)`);
  console.log(`  • ${customers.length} Customers`);
  console.log(`  • ${fields.length} Fields`);
  console.log(`  • ${jobTypes.length} Job Types`);
  console.log(`  • ${machines.length} Machines`);
  console.log(`  • ${jobs.length} Jobs`);
  console.log(`  • ${jobLogs.length} Job Logs`);
  console.log(`  • 2 Invoices`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
