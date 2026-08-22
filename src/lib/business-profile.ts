// src/lib/business-profile.ts
//
// The org's letterhead details for invoice generation. Falls back to the
// real current values so existing invoices render identically until an
// admin explicitly saves something through the Business Profile settings
// screen — no backfill needed for the live database.

import { prisma } from "@/lib/db";

export const DEFAULT_BUSINESS_PROFILE = {
  legalName: "M. & J. WAKEHAM & SON",
  tradeDescription: "(Agricultural Contractors)",
  addressLine: "Little Allers, Avonwick, South Brent, Devon, TQ10 9HA",
  phone: "07811 266 791 · 07855 427 510",
  bankSortCode: "30-93-14",
  bankAccountNumber: "05105229",
  vatNumber: "501 1588 83",
};

export type BusinessProfile = typeof DEFAULT_BUSINESS_PROFILE;

export async function getBusinessProfile(organisationId: number): Promise<BusinessProfile> {
  const row = await prisma.businessProfile.findUnique({ where: { organisationId } });
  if (!row) return DEFAULT_BUSINESS_PROFILE;
  return {
    legalName: row.legalName,
    tradeDescription: row.tradeDescription || "",
    addressLine: row.addressLine || "",
    phone: row.phone || "",
    bankSortCode: row.bankSortCode || "",
    bankAccountNumber: row.bankAccountNumber || "",
    vatNumber: row.vatNumber || "",
  };
}

// Comma/newline-separated free text, joined with middots for the letterhead
// line — matches how the address always used to be typeset
export const formatAddressLine = (addressLine: string) =>
  addressLine
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
