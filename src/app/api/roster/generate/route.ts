import { NextResponse } from "next/server";
import { generateAndPersistRoster } from "@/lib/roster/generation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function requestError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Menjalankan optimizer roster server-side untuk supervisor terautentikasi. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return requestError("Payload generate roster tidak valid.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return requestError("Payload generate roster tidak valid.");
  }

  const { monthStart, seed } = body as {
    monthStart?: unknown;
    seed?: unknown;
  };
  if (
    typeof monthStart !== "string" ||
    !/^\d{4}-\d{2}-01$/.test(monthStart)
  ) {
    return requestError("Bulan roster wajib memakai tanggal pertama bulan.");
  }
  if (seed !== undefined && (typeof seed !== "string" || seed.length > 100)) {
    return requestError("Seed roster tidak valid.");
  }

  try {
    const client = await createClient();
    const result = await generateAndPersistRoster(
      client,
      monthStart,
      typeof seed === "string" && seed.trim()
        ? seed.trim()
        : `roster:${monthStart}`
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Roster otomatis belum dapat dibuat.";
    const status = /Hanya supervisor|Sesi pengguna|permission|JWT/i.test(message)
      ? 403
      : 422;
    return requestError(message, status);
  }
}
