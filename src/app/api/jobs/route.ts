// src/app/api/jobs/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

// GET /api/jobs?status=scheduled&assignedTo=2&customerId=1
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status");
    const assignedTo = sp.get("assignedTo");
    const customerId = sp.get("customerId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedTo) where.assignedToUserId = Number(assignedTo);
    if (customerId) where.customerId = Number(customerId);

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        field: { select: { id: true, fieldName: true, hectares: true } },
        jobType: { select: { id: true, name: true, billingUnit: true, defaultRate: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { jobLogs: true } },
      },
      orderBy: { plannedDate: "asc" },
    });
    return success(jobs);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/jobs
export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      customerId: number;
      fieldId?: number;
      jobTypeId: number;
      assignedToUserId?: number;
      title: string;
      description?: string;
      plannedDate?: string;
      estimatedQuantity?: number;
      unitType?: string;
      createdBy?: number;
    }>(request);

    if (!body.customerId || !body.jobTypeId || !body.title) {
      return error("customerId, jobTypeId, and title are required");
    }

    const job = await prisma.job.create({
      data: {
        customerId: body.customerId,
        fieldId: body.fieldId || null,
        jobTypeId: body.jobTypeId,
        assignedToUserId: body.assignedToUserId,
        title: body.title,
        description: body.description,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
        estimatedQuantity: body.estimatedQuantity,
        unitType: body.unitType,
        createdBy: body.createdBy,
      },
      include: {
        customer: { select: { id: true, name: true } },
        field: { select: { id: true, fieldName: true } },
        jobType: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    return success(job, 201);
  } catch (err) {
    return serverError(err);
  }
}
