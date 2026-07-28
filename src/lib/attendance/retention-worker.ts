import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 6;

function retryAt(attempt: number) {
  const delayMinutes = Math.min(24 * 60, 5 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function isAlreadyMissing(message: string) {
  const normalized = message.toLocaleLowerCase("en-US");
  return normalized.includes("not found") || normalized.includes("404");
}

/**
 * Memproses antrean penghapusan Storage secara idempotent. Claim bersyarat
 * mencegah dua worker menghapus job yang sama secara bersamaan.
 */
export async function processDueAttendanceDeletionJobs(limit = 20) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();

  const { error: leaseRecoveryError } = await admin
    .from("file_deletion_jobs")
    .update({
      status: "failed",
      scheduled_for: now,
      last_error: "Worker sebelumnya berhenti sebelum menyelesaikan job.",
    })
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .not("evidence_id", "is", null);

  if (leaseRecoveryError) {
    throw new Error(
      `Lease retensi belum dapat dipulihkan: ${leaseRecoveryError.message}`
    );
  }

  const { data: jobs, error: listError } = await admin
    .from("file_deletion_jobs")
    .select(
      "id,evidence_id,storage_bucket,storage_path,deletion_reason,status,attempt_count"
    )
    .in("status", ["scheduled", "failed"])
    .lte("scheduled_for", now)
    .lt("attempt_count", MAX_ATTEMPTS)
    .not("evidence_id", "is", null)
    .order("scheduled_for")
    .limit(Math.max(1, Math.min(limit, 50)));

  if (listError) {
    throw new Error(`Antrean retensi belum dapat dibaca: ${listError.message}`);
  }

  let completed = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const attempt = job.attempt_count + 1;
    const { data: claimed, error: claimError } = await admin
      .from("file_deletion_jobs")
      .update({
        status: "processing",
        attempt_count: attempt,
        last_error: null,
      })
      .eq("id", job.id)
      .eq("status", job.status)
      .eq("attempt_count", job.attempt_count)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) continue;

    try {
      const removal = await admin.storage
        .from(job.storage_bucket)
        .remove([job.storage_path]);
      if (removal.error && !isAlreadyMissing(removal.error.message)) {
        throw removal.error;
      }

      const { error: completionError } = await admin.rpc(
        "complete_attendance_file_deletion_job",
        {
          p_job_id: job.id,
          p_deleted_at: new Date().toISOString(),
        }
      );
      if (completionError) {
        throw completionError;
      }

      // Audit dan perubahan metadata diselesaikan atomik oleh RPC.
      if (!job.evidence_id) {
        throw new Error("Deletion job tidak memiliki evidence presensi.");
      }
      completed += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Penghapusan file gagal.";
      await admin
        .from("file_deletion_jobs")
        .update({
          status: "failed",
          scheduled_for: retryAt(attempt),
          last_error: message.slice(0, 500),
        })
        .eq("id", job.id)
        .eq("status", "processing");
      failed += 1;
    }
  }

  return { scanned: jobs?.length ?? 0, completed, failed };
}
