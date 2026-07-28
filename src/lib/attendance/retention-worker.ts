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

      const deletedAt = new Date().toISOString();
      if (job.evidence_id) {
        const { error: evidenceError } = await admin
          .from("attendance_evidence")
          .update({
            deleted_at: deletedAt,
            retention_status: "deleted",
          })
          .eq("id", job.evidence_id);
        if (evidenceError) throw evidenceError;
      }

      const { error: completionError } = await admin
        .from("file_deletion_jobs")
        .update({
          status: "completed",
          completed_at: deletedAt,
          last_error: null,
        })
        .eq("id", job.id)
        .eq("status", "processing");
      if (completionError) throw completionError;

      await admin.from("audit_logs").insert({
        action: "delete_storage_object",
        entity_type: "file_deletion_job",
        entity_id: job.id,
        after_values: {
          storage_bucket: job.storage_bucket,
          storage_path: job.storage_path,
          deletion_reason: job.deletion_reason,
          attempt,
        },
        reason: job.deletion_reason,
      });
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
