import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const expectDeleted = args.includes("--expect-deleted");
const useLatest = args.includes("--latest");
const checkCronStatus = args.includes("--cron-status");
const evidenceIdIndex = args.indexOf("--evidence-id");
const evidenceId =
  evidenceIdIndex >= 0 ? args[evidenceIdIndex + 1]?.trim() : undefined;

function printUsage() {
  console.log(`Verifikasi retensi selfie presensi (read-only)

Penggunaan:
  npm run attendance:verify-retention -- --latest
  npm run attendance:verify-retention -- --evidence-id <uuid>
  npm run attendance:verify-retention -- --evidence-id <uuid> --expect-deleted
  npm run attendance:verify-retention -- --cron-status

Opsi:
  --latest          Periksa evidence presensi terbaru.
  --evidence-id     Periksa satu evidence berdasarkan UUID.
  --expect-deleted  Jadikan kondisi belum terhapus sebagai kegagalan.
  --cron-status     Periksa invocation otomatis Vercel Cron terbaru.
  --help            Tampilkan bantuan.

Script tidak mengubah database atau Storage dan tidak mencetak secret/path file.`);
}

if (args.includes("--help")) {
  printUsage();
  process.exit(0);
}

if (
  [useLatest, Boolean(evidenceId), checkCronStatus].filter(Boolean).length !==
    1 ||
  (expectDeleted && checkCronStatus) ||
  (evidenceId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      evidenceId
    ))
) {
  printUsage();
  process.exit(1);
}

const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Environment ${key} belum tersedia.`);
    process.exit(1);
  }
}

const expectedProjectHost = "ttbogurultjbporryylb.supabase.co";
const configuredProjectHost = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL
).hostname;
if (configuredProjectHost !== expectedProjectHost) {
  console.error(
    `Target Supabase tidak sesuai. Diharapkan ${expectedProjectHost}, diterima ${configuredProjectHost}.`
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const checks = [];

function addCheck(status, label, detail) {
  checks.push({ status, label, detail });
}

function formatJakarta(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

async function objectExists(bucket, path) {
  const parts = path.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName,
  });

  if (error) throw error;
  return (data ?? []).some((item) => item.name === fileName);
}

async function freshSignedUrlCanRetrieve(bucket, path) {
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 30);
  if (signed.error || !signed.data?.signedUrl) return false;

  try {
    const response = await fetch(signed.data.signedUrl, {
      method: "HEAD",
      redirect: "manual",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function runCronStatus() {
  const { data: invocation, error } = await supabase
    .from("audit_logs")
    .select("action,after_values,created_at,user_agent")
    .eq("entity_type", "attendance_retention_worker")
    .eq("user_agent", "vercel-cron/1.0")
    .in("action", ["cron_completed", "cron_failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  console.log("Verifikasi invocation otomatis Vercel Cron");
  if (!invocation) {
    console.log("[WAIT] Invocation: belum ada audit otomatis yang tersimpan");
    console.log("");
    console.log("HASIL: WAIT");
    return;
  }

  const result =
    invocation.after_values &&
    typeof invocation.after_values === "object" &&
    !Array.isArray(invocation.after_values)
      ? invocation.after_values
      : {};
  const succeeded =
    invocation.action === "cron_completed" && result.failed === 0;

  console.log(
    `[${succeeded ? "PASS" : "FAIL"}] Invocation: ${formatJakarta(
      invocation.created_at
    )}`
  );
  console.log(
    `       Hasil: scanned ${result.scanned ?? "-"}, completed ${
      result.completed ?? "-"
    }, failed ${result.failed ?? "-"}`
  );
  console.log("");
  console.log(`HASIL: ${succeeded ? "PASS" : "FAIL"}`);

  if (!succeeded) process.exitCode = 1;
}

async function run() {
  if (checkCronStatus) {
    await runCronStatus();
    return;
  }

  let evidenceQuery = supabase
    .from("attendance_evidence")
    .select(
      "id,attendance_record_id,storage_bucket,storage_path,retention_status,uploaded_at,deleted_at"
    );

  evidenceQuery = evidenceId
    ? evidenceQuery.eq("id", evidenceId)
    : evidenceQuery.order("uploaded_at", { ascending: false }).limit(1);

  const { data: evidence, error: evidenceError } =
    await evidenceQuery.maybeSingle();
  if (evidenceError) throw evidenceError;
  if (!evidence) {
    throw new Error("Evidence presensi tidak ditemukan.");
  }

  const [
    { data: attendance, error: attendanceError },
    { data: jobs, error: jobsError },
    { data: validations, error: validationsError },
  ] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("id,validation_status")
      .eq("id", evidence.attendance_record_id)
      .maybeSingle(),
    supabase
      .from("file_deletion_jobs")
      .select("id,status,attempt_count,scheduled_for,completed_at")
      .eq("evidence_id", evidence.id)
      .eq("deletion_reason", "attendance_selfie_seven_day_retention")
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance_validations")
      .select("id,decision,decided_at")
      .eq("attendance_record_id", evidence.attendance_record_id)
      .order("decided_at", { ascending: false }),
  ]);

  if (attendanceError) throw attendanceError;
  if (jobsError) throw jobsError;
  if (validationsError) throw validationsError;

  const job = jobs?.[0] ?? null;
  const retentionDeadline = new Date(
    new Date(evidence.uploaded_at).getTime() + 7 * 24 * 60 * 60 * 1000
  );
  const isDue = Date.now() >= retentionDeadline.getTime();
  const exists = await objectExists(
    evidence.storage_bucket,
    evidence.storage_path
  );

  let deletionAudit = null;
  if (job) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,created_at")
      .eq("entity_type", "file_deletion_job")
      .eq("entity_id", job.id)
      .eq("action", "delete_storage_object")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    deletionAudit = data;
  }

  console.log("Verifikasi retensi selfie presensi");
  console.log(`Evidence       : ${evidence.id}`);
  console.log(`Attendance     : ${evidence.attendance_record_id}`);
  console.log(`Upload         : ${formatJakarta(evidence.uploaded_at)}`);
  console.log(`Batas retensi  : ${formatJakarta(retentionDeadline.toISOString())}`);
  console.log(`Fase           : ${isDue ? "jatuh tempo" : "masa retensi"}`);
  console.log("");

  addCheck(
    attendance ? "PASS" : "FAIL",
    "Metadata presensi",
    attendance ? `tersedia (${attendance.validation_status})` : "tidak ditemukan"
  );
  addCheck(
    job ? "PASS" : "FAIL",
    "Deletion job tujuh hari",
    job
      ? `${job.status}, percobaan ${job.attempt_count}`
      : "tidak ditemukan"
  );

  if (job) {
    const scheduleDelta = Math.abs(
      new Date(job.scheduled_for).getTime() - retentionDeadline.getTime()
    );
    addCheck(
      scheduleDelta <= 1000 ? "PASS" : "FAIL",
      "Jadwal tepat tujuh hari",
      formatJakarta(job.scheduled_for)
    );
  }

  if (attendance?.validation_status !== "pending") {
    addCheck(
      (validations?.length ?? 0) > 0 ? "PASS" : "FAIL",
      "Metadata keputusan",
      validations?.[0]
        ? `${validations[0].decision} (${formatJakarta(
            validations[0].decided_at
          )})`
        : "keputusan final tidak ditemukan"
    );
  } else {
    addCheck(
      "WAIT",
      "Metadata keputusan",
      "presensi masih menunggu validasi"
    );
  }

  const deletionComplete =
    job?.status === "completed" &&
    Boolean(job.completed_at) &&
    evidence.retention_status === "deleted" &&
    Boolean(evidence.deleted_at);

  if (deletionComplete || expectDeleted) {
    addCheck(
      deletionComplete ? "PASS" : "FAIL",
      "Finalisasi metadata",
      deletionComplete
        ? `deleted (${formatJakarta(evidence.deleted_at)})`
        : `${evidence.retention_status}; job ${job?.status ?? "tidak ada"}`
    );
    addCheck(
      exists ? "FAIL" : "PASS",
      "Objek Storage",
      exists ? "masih tersedia" : "sudah tidak tersedia"
    );
    addCheck(
      deletionAudit ? "PASS" : "FAIL",
      "Audit penghapusan",
      deletionAudit
        ? `tersedia (${formatJakarta(deletionAudit.created_at)})`
        : "tidak ditemukan"
    );

    const canRetrieve = exists
      ? true
      : await freshSignedUrlCanRetrieve(
          evidence.storage_bucket,
          evidence.storage_path
        );
    addCheck(
      canRetrieve ? "FAIL" : "PASS",
      "Akses signed URL baru",
      canRetrieve ? "objek masih dapat diambil" : "objek tidak dapat diambil"
    );
  } else {
    addCheck(
      exists ? "PASS" : "FAIL",
      "Objek selama masa retensi",
      exists ? "masih tersimpan privat" : "hilang sebelum finalisasi"
    );
    addCheck(
      isDue ? "WAIT" : "PASS",
      "Finalisasi penghapusan",
      isDue
        ? "jatuh tempo dan menunggu worker"
        : "belum jatuh tempo"
    );
  }

  if (
    job?.status === "failed" &&
    job.attempt_count >= 6
  ) {
    addCheck(
      "FAIL",
      "Batas retry worker",
      "enam percobaan habis; periksa last_error di dashboard"
    );
  }

  for (const check of checks) {
    console.log(
      `[${check.status.padEnd(4)}] ${check.label}: ${check.detail}`
    );
  }

  const failed = checks.filter((check) => check.status === "FAIL");
  const waiting = checks.filter((check) => check.status === "WAIT");
  console.log("");
  console.log(
    `HASIL: ${failed.length > 0 ? "FAIL" : waiting.length > 0 ? "WAIT" : "PASS"}`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(
    `Verifikasi gagal dijalankan: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
});
