// src/app/api/jobs/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireManager } from "@/lib/auth-guards";
import { NextRequest } from "next/server";

// GET /api/jobs?status=scheduled&assignedTo=2&customerId=1
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;
    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    const sp = request.nextUrl.searchParams;
    const status = sp.get("status");
    const assignedTo = sp.get("assignedTo");
    const customerId = sp.get("customerId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (customerId) where.customerId = Number(customerId);
    if (role === "admin" || role === "job_admin") {
      // Managers can see everything, optionally filtered by contractor
      if (assignedTo) where.assignedToUserId = Number(assignedTo);
    } else {
      // Contractors only ever see their own jobs — enforced here, not just client-side
      where.assignedToUserId = userId;
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        jobFields: { include: { field: { select: { id: true, fieldName: true, hectares: true } } } },
        jobType: { select: { id: true, name: true, billingUnit: true, defaultRate: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { jobLogs: true, invoiceItems: true } },
      },
      orderBy: { plannedDate: "asc" },
    });
    return success(jobs);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/jobs — scheduling a job is an admin/job_admin action
export async function POST(request: Request) {
  try {
    const { session, response } = await requireManager();
    if (response) return response;
    const createdBy = (session.user as any).id;

    const body = await parseBody<{
      customerId: number;
      fieldIds?: number[];
      jobTypeId: number;
      assignedToUserId?: number;
      title: string;
      description?: string;
      plannedDate?: string;
      estimatedQuantity?: number;
      unitType?: string;
      noLogRequired?: boolean;
    }>(request);

    if (!body.customerId || !body.jobTypeId || !body.title) {
      return error("customerId, jobTypeId, and title are required");
    }

    const job = await prisma.job.create({
      data: {
        customerId: body.customerId,
        jobTypeId: body.jobTypeId,
        assignedToUserId: body.assignedToUserId,
        title: body.title,
        description: body.description,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
        estimatedQuantity: body.estimatedQuantity,
        unitType: body.unitType,
        noLogRequired: body.noLogRequired ?? false,
        createdBy,
        jobFields: body.fieldIds?.length
          ? { create: body.fieldIds.map((fieldId) => ({ fieldId })) }
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true } },
        jobFields: { include: { field: { select: { id: true, fieldName: true } } } },
        jobType: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    return success(job, 201);
  } catch (err) {
    return serverError(err);
  }
}
