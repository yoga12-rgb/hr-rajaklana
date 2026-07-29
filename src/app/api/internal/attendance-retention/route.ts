import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processDueAttendanceDeletionJobs } from "@/lib/attendance/retention-worker";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

async function recordInvocation(
  request: NextRequest,
  action: "cron_completed" | "cron_failed",
  result?: { scanned: number; completed: number; failed: number }
) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    entity_type: "attendance_retention_worker",
    action,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    after_values: result ?? null,
    reason:
      action === "cron_failed"
        ? "Worker retensi gagal sebelum memberikan hasil."
        : null,
  });

  if (error) {
    throw new Error(`Audit invocation cron gagal disimpan: ${error.message}`);
  }
}

/** Endpoint internal Vercel Cron untuk retry antrean retensi selfie. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let result: { scanned: number; completed: number; failed: number };
  try {
    result = await processDueAttendanceDeletionJobs();
  } catch {
    await recordInvocation(request, "cron_failed").catch(() => undefined);
    return NextResponse.json(
      { error: "Worker retensi belum dapat dijalankan." },
      { status: 500 }
    );
  }

  try {
    await recordInvocation(request, "cron_completed", result);
  } catch {
    return NextResponse.json(
      { error: "Hasil worker retensi belum dapat diaudit." },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
