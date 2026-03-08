// src/app/api/users/[id]/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error("Not authenticated", 401);
    if ((session.user as any).role !== "admin") return error("Admin access required", 403);

    const { id } = await params;
    const body = await parseBody<Partial<{
      name: string;
      username: string;
      email: string;
      phone: string;
      role: string;
      active: boolean;
      password: string;
    }>>(request);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.username !== undefined) data.username = body.username ? body.username.toLowerCase().trim() : null;
    if (body.email !== undefined) data.email = body.email ? body.email.toLowerCase().trim() : null;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.role !== undefined) data.role = body.role;
    if (body.active !== undefined) data.active = body.active;
    if (body.password) {
      if (body.password.length < 6) return error("Password must be at least 6 characters");
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    // Prevent username conflicts
    if (body.username) {
      const existing = await prisma.user.findUnique({ where: { username: body.username.toLowerCase().trim() } });
      if (existing && existing.id !== Number(id)) {
        return error("This username is already taken");
      }
    }

    // Prevent email conflicts
    if (body.email) {
      const existing = await prisma.user.findFirst({ where: { email: body.email.toLowerCase().trim() } });
      if (existing && existing.id !== Number(id)) {
        return error("A user with this email already exists");
      }
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data,
    });

    return success({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
    });
  } catch (err) {
    return serverError(err);
  }
}
