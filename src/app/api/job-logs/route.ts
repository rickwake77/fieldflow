// src/app/api/job-logs/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

// GET /api/job-logs?jobId=1&contractorId=2
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const jobId = sp.get("jobId");
    const contractorId = sp.get("contractorId");

    const where: Record<string, unknown> = {};
    if (jobId) where.jobId = Number(jobId);
    if (contractorId) where.contractorId = Number(contractorId);

    const logs = await prisma.jobLog.findMany({
      where,
      include: {
        job: { select: { id: true, title: true, customer: { select: { name: true } } } },
        contractor: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true, registration: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(logs);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/job-logs — contractor logs work against a job
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      jobId: number;
      contractorId: number;
      machineId?: number;
      quantityCompleted: number;
      hoursWorked: number;
      notes?: string;
      photoUrl?: string;
    }>(request);

    if (!body.jobId || !body.contractorId) {
      return error("jobId and contractorId are required");
    }

    // Create the log
    const log = await prisma.jobLog.create({
      data: {
        jobId: body.jobId,
        contractorId: body.contractorId,
        machineId: body.machineId,
        quantityCompleted: body.quantityCompleted,
        hoursWorked: body.hoursWorked,
        notes: body.notes,
        photoUrl: body.photoUrl,
      },
      include: {
        contractor: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true } },
      },
    });

    // Auto-update job status to in_progress if it was scheduled
    const job = await prisma.job.findUnique({ where: { id: body.jobId } });
    if (job && job.status === "scheduled") {
      await prisma.job.update({
        where: { id: body.jobId },
        data: { status: "in_progress" },
      });
    }

    return success(log, 201);
  } catch (err) {
    return serverError(err);
  }
}
