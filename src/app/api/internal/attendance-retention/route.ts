import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processDueAttendanceDeletionJobs } from "@/lib/attendance/retention-worker";

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

/** Endpoint internal Vercel Cron untuk retry antrean retensi selfie. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await processDueAttendanceDeletionJobs());
  } catch {
    return NextResponse.json(
      { error: "Worker retensi belum dapat dijalankan." },
      { status: 500 }
    );
  }
}
