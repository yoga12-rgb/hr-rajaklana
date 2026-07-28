"use server";

import { requireSupervisorAccount } from "@/lib/auth/session";
import { processDueAttendanceDeletionJobs } from "./retention-worker";

/**
 * Best-effort memproses job retensi yang sudah jatuh tempo setelah keputusan.
 * Selfie yang belum berumur tujuh hari tidak akan dihapus; cron tetap menjadi
 * jalur retry utama bila Storage sedang tidak tersedia.
 */
export async function runAttendanceRetentionAfterDecision() {
  await requireSupervisorAccount();
  return processDueAttendanceDeletionJobs(5);
}
