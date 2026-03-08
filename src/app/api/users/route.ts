// src/app/api/users/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: { select: { assignedJobs: true, jobLogs: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(users);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody<{
      organisationId: number;
      name: string;
      email: string;
      phone?: string;
      role?: "admin" | "contractor";
    }>(request);

    if (!body.name || !body.email || !body.organisationId) {
      return error("name, email, and organisationId are required");
    }

    const user = await prisma.user.create({ data: body });
    return success(user, 201);
  } catch (err) {
    return serverError(err);
  }
}
