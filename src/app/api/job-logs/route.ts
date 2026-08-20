// src/app/api/job-logs/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth-guards";
import { NextRequest } from "next/server";

const isManager = (role: string) => role === "admin" || role === "job_admin";

// GET /api/job-logs?jobId=1&contractorId=2
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAuth();
    if (response) return response;

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
        logMachines: { include: { machine: { select: { id: true, name: true, registration: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(logs);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/job-logs — a user logs their own work against a job. This is the
// most offline-critical write in the app (goes through the IndexedDB sync
// queue and replays automatically on reconnect), so the only requirement is
// "must be logged in" — no extra restriction that could behave differently
// offline vs online.
export async function POST(request: Request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const contractorId = (session.user as any).id;

    const body = await parseBody<{
      jobId: number;
      machineIds?: number[];
      quantityCompleted: number;
      hoursWorked: number;
      notes?: string;
      photoUrl?: string;
    }>(request);

    if (!body.jobId) {
      return error("jobId is required");
    }

    const job = await prisma.job.findUnique({ where: { id: body.jobId } });
    if (!job) return error("Job not found", 404);
    if (!isManager(role) && job.assignedToUserId !== contractorId) {
      return error("You can only log work against jobs assigned to you", 403);
    }

    // contractorId always comes from the session, never the request body,
    // so a log can't be submitted under someone else's name
    const log = await prisma.jobLog.create({
      data: {
        jobId: body.jobId,
        contractorId,
        quantityCompleted: body.quantityCompleted,
        hoursWorked: body.hoursWorked,
        notes: body.notes,
        photoUrl: body.photoUrl,
        logMachines: body.machineIds?.length
          ? { create: body.machineIds.map((machineId) => ({ machineId })) }
          : undefined,
      },
      include: {
        contractor: { select: { id: true, name: true } },
        logMachines: { include: { machine: { select: { id: true, name: true } } } },
      },
    });

    // Auto-update job status to in_progress if it was scheduled
    if (job.status === "scheduled") {
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
