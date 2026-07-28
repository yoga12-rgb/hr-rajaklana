"use server";

import { requireSupervisorAccount } from "@/lib/auth/session";
import { processDueAttendanceDeletionJobs } from "./retention-worker";

/**
 * Best-effort immediate cleanup setelah supervisor menyetujui presensi.
 * Cron tetap menjadi jalur retry bila Storage sedang tidak tersedia.
 */
export async function runAttendanceRetentionAfterDecision() {
  await requireSupervisorAccount();
  return processDueAttendanceDeletionJobs(5);
}
