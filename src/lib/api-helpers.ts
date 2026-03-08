// src/lib/api-helpers.ts
// Shared utilities for API routes

import { NextResponse } from "next/server";

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function serverError(err: unknown) {
  console.error("API Error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

// Parse request body safely
export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}
