// src/app/api/business-profile/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth-guards";
import { getBusinessProfile } from "@/lib/business-profile";

// GET /api/business-profile — admin only; contains bank details
export async function GET() {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const profile = await getBusinessProfile(organisationId);
    return success(profile);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/business-profile — upserts the org's single profile row
export async function PATCH(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const organisationId = (session.user as any).organisationId;

    const body = await parseBody<Partial<{
      legalName: string;
      tradeDescription: string;
      addressLine: string;
      phone: string;
      bankSortCode: string;
      bankAccountNumber: string;
      vatNumber: string;
    }>>(request);

    if (body.legalName !== undefined && !body.legalName.trim()) {
      return error("legalName cannot be blank");
    }

    const updateData = {
      ...(body.legalName !== undefined && { legalName: body.legalName }),
      tradeDescription: body.tradeDescription ?? null,
      addressLine: body.addressLine ?? null,
      phone: body.phone ?? null,
      bankSortCode: body.bankSortCode ?? null,
      bankAccountNumber: body.bankAccountNumber ?? null,
      vatNumber: body.vatNumber ?? null,
    };

    const profile = await prisma.businessProfile.upsert({
      where: { organisationId },
      update: updateData,
      create: { organisationId, ...updateData, legalName: body.legalName || "" },
    });

    return success(profile);
  } catch (err) {
    return serverError(err);
  }
}
