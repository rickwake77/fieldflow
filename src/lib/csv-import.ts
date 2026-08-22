// src/lib/csv-import.ts
// Shared CSV import/export helpers for admin bulk data tools.
// Import: rows with a matching id update that record, rows with no id
// create a new one, rows with an id that doesn't match anything are
// reported as an error rather than silently created under a new id.

import Papa from "papaparse";
import { NextResponse } from "next/server";

export type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
};

// Most rows upsert cleanly ("created"/"updated"). A row can also come back
// flagged with a warning -- e.g. a possible-duplicate name that was still
// created because the caller can't safely assume it's the same record.
export type UpsertOutcome = "created" | "updated" | { outcome: "created" | "updated"; warning: string };

export async function processCsvUpsert<T>(
  csv: string,
  parseRow: (raw: Record<string, string>, rowNum: number) => T | { error: string },
  upsert: (row: T) => Promise<UpsertOutcome>
): Promise<ImportResult> {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const result: ImportResult = { created: 0, updated: 0, errors: [], warnings: [] };

  for (let i = 0; i < parsed.data.length; i++) {
    const rowNum = i + 2; // +1 for zero-index, +1 for the header row
    const parsedRow = parseRow(parsed.data[i], rowNum);
    if (parsedRow && typeof parsedRow === "object" && "error" in parsedRow) {
      result.errors.push({ row: rowNum, message: (parsedRow as { error: string }).error });
      continue;
    }
    try {
      const outcome = await upsert(parsedRow as T);
      if (typeof outcome === "string") {
        result[outcome]++;
      } else {
        result[outcome.outcome]++;
        result.warnings.push({ row: rowNum, message: outcome.warning });
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message || "Unknown error" });
    }
  }

  return result;
}

// Reads a boolean-ish CSV cell ("true"/"false"/"1"/"0"/"yes"/"no"),
// defaulting to `fallback` when the cell is blank
export function parseCsvBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

export function csvResponse(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const csv = Papa.unparse({
    fields: columns,
    data: rows.map((r) => columns.map((c) => r[c] ?? "")),
  });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
