// src/app/api/auth/create-user/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error("Not authenticated", 401);
    if ((session.user as any).role !== "admin") return error("Admin access required", 403);

    const body = await parseBody<{
      name: string;
      username?: string;
      email?: string;
      phone?: string;
      password: string;
      role?: "admin" | "job_admin" | "contractor";
    }>(request);

    if (!body.name || !body.password) {
      return error("name and password are required");
    }

    if (!body.username && !body.email) {
      return error("Either username or email is required");
    }

    if (body.password.length < 6) {
      return error("Password must be at least 6 characters");
    }

    // Check username not already in use
    if (body.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: body.username.toLowerCase().trim() },
      });
      if (existingUsername) return error("This username is already taken");
    }

    // Check email not already in use
    if (body.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase().trim() },
      });
      if (existingEmail) return error("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        organisationId: (session.user as any).organisationId,
        name: body.name,
        username: body.username ? body.username.toLowerCase().trim() : null,
        email: body.email ? body.email.toLowerCase().trim() : null,
        phone: body.phone,
        passwordHash,
        role: body.role || "contractor",
      },
    });

    return success({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    }, 201);
  } catch (err) {
    return serverError(err);
  }
}
