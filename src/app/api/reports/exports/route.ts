import { after, NextResponse } from "next/server";
import { processReportExport } from "@/lib/reports/export-worker";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function optionalId(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function parseJob(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons job ekspor tidak valid.");
  }
  return value;
}

function sessionExpired() {
  return NextResponse.json(
    { error: "Sesi habis. Silakan login ulang." },
    { status: 401 }
  );
}

/** Menjadwalkan atau mengulang ekspor XLSX tanpa menunggu worker selesai. */
export async function POST(request: Request) {
  // Mode demo/CI sengaja tidak membawa env Supabase. Tolak seperti request
  // anonim tanpa mencoba membuat client atau membocorkan detail konfigurasi.
  if (!isSupabaseConfigured()) return sessionExpired();

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Layanan ekspor belum tersedia." },
      { status: 503 }
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return sessionExpired();
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Payload ekspor tidak valid." },
      { status: 400 }
    );
  }

  let job: Json;
  if (typeof body.exportId === "string" && body.exportId) {
    const { data, error } = await supabase.rpc("retry_report_export", {
      p_export_id: body.exportId,
    });
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Ekspor belum dapat diulang." },
        { status: 400 }
      );
    }
    job = data;
  } else {
    if (
      !isDate(body.periodStart) ||
      !isDate(body.periodEnd) ||
      typeof body.requestKey !== "string"
    ) {
      return NextResponse.json(
        { error: "Periode atau kunci permintaan ekspor tidak valid." },
        { status: 400 }
      );
    }
    const { data, error } = await supabase.rpc("request_report_export", {
      p_period_start: body.periodStart,
      p_period_end: body.periodEnd,
      p_outlet_id: optionalId(body.outletId),
      p_employee_id: optionalId(body.employeeId),
      p_request_key: body.requestKey,
    });
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Ekspor belum dapat dijadwalkan." },
        { status: 400 }
      );
    }
    job = data;
  }

  const parsedJob = parseJob(job);
  const exportId = String(parsedJob.id);
  after(() =>
    processReportExport(exportId, supabase).catch(() => {
      // Worker sudah menulis status gagal dan audit yang aman.
    })
  );

  return NextResponse.json({ job: parsedJob }, { status: 202 });
}
