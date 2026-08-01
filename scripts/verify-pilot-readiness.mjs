import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import {
  REQUIRED_POLICY_TYPES,
  countPilotCapableOutlets,
  evaluatePilotReadiness,
} from "./lib/pilot-readiness.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const useJson = args.includes("--json");

function printUsage() {
  console.log(`Verifikasi kesiapan pilot production (read-only)

Penggunaan:
  npm run operations:verify-pilot
  npm run operations:verify-pilot -- --json

Script hanya membaca agregat yang dibutuhkan, tidak mengubah database/Storage,
dan tidak mencetak nama, email, UUID, path Storage, error mentah, atau secret.`);
}

if (args.includes("--help")) {
  printUsage();
  process.exit(0);
}

if (args.some((arg) => !["--json"].includes(arg))) {
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

function jakartaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const value = (type) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatJakarta(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

async function rows(label, query) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label} tidak dapat diperiksa (${error.code ?? "query"}).`);
  }
  return data ?? [];
}

async function exactCount(label, query) {
  const { count, error } = await query;
  if (error) {
    throw new Error(`${label} tidak dapat diperiksa (${error.code ?? "query"}).`);
  }
  return count ?? 0;
}

function jsonNumber(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value[key] === "number" ? value[key] : null;
}

async function collectFacts() {
  const today = jakartaDate();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();

  const [
    employees,
    jobPositions,
    userAccounts,
    outlets,
    placements,
    shiftTemplates,
    policies,
    exhaustedDeletionJobs,
    overdueDeletionJobs,
    staleDeletionJobs,
    exhaustedReportJobs,
    cronResult,
  ] = await Promise.all([
    rows(
      "Karyawan",
      supabase.from("employees").select("id,job_position_id,archived_at")
    ),
    rows(
      "Jabatan",
      supabase
        .from("job_positions")
        .select("id,is_active,auto_roster_eligible")
    ),
    rows(
      "Akun",
      supabase
        .from("user_accounts")
        .select(
          "employee_id,access_role,account_status,must_change_password"
        )
    ),
    rows(
      "Outlet",
      supabase.from("outlets").select("id,is_active")
    ),
    rows(
      "Penempatan",
      supabase
        .from("employee_placements")
        .select("employee_id,outlet_id,start_date,end_date,is_primary")
    ),
    rows(
      "Template shift",
      supabase
        .from("outlet_shift_templates")
        .select("id,outlet_id,shift_type,is_active")
    ),
    rows(
      "Kebijakan",
      supabase
        .from("policy_versions")
        .select("policy_type,effective_from,effective_until")
    ),
    exactCount(
      "Retry retensi",
      supabase
        .from("file_deletion_jobs")
        .select("id", { count: "exact", head: true })
        .not("evidence_id", "is", null)
        .eq("status", "failed")
        .gte("attempt_count", 6)
    ),
    exactCount(
      "Job retensi jatuh tempo",
      supabase
        .from("file_deletion_jobs")
        .select("id", { count: "exact", head: true })
        .not("evidence_id", "is", null)
        .in("status", ["scheduled", "failed"])
        .lte("scheduled_for", now)
        .lt("attempt_count", 6)
    ),
    exactCount(
      "Lease retensi",
      supabase
        .from("file_deletion_jobs")
        .select("id", { count: "exact", head: true })
        .not("evidence_id", "is", null)
        .eq("status", "processing")
        .lt("updated_at", staleBefore)
    ),
    exactCount(
      "Retry ekspor",
      supabase
        .from("backup_exports")
        .select("id", { count: "exact", head: true })
        .eq("export_type", "report")
        .eq("status", "failed")
        .gte("attempt_count", 3)
    ),
    supabase
      .from("audit_logs")
      .select("action,after_values,created_at")
      .eq("entity_type", "attendance_retention_worker")
      .eq("user_agent", "vercel-cron/1.0")
      .in("action", ["cron_completed", "cron_failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (cronResult.error) {
    throw new Error(
      `Audit cron tidak dapat diperiksa (${cronResult.error.code ?? "query"}).`
    );
  }

  const activePositionIds = new Set(
    jobPositions
      .filter((position) => position.is_active && position.auto_roster_eligible)
      .map((position) => position.id)
  );
  const activePolicyTypes = [
    ...new Set(
      policies
        .filter(
          (policy) =>
            policy.effective_from <= today &&
            (policy.effective_until === null || policy.effective_until >= today)
        )
        .map((policy) => policy.policy_type)
        .filter((type) => REQUIRED_POLICY_TYPES.includes(type))
    ),
  ].sort();
  const latestCron = cronResult.data
    ? {
        action: cronResult.data.action,
        createdAt: formatJakarta(cronResult.data.created_at),
        failed: jsonNumber(cronResult.data.after_values, "failed"),
        isStale:
          Date.now() - new Date(cronResult.data.created_at).getTime() >
          26 * 60 * 60 * 1000,
      }
    : null;
  const snapshot = {
    today,
    employees,
    jobPositions,
    userAccounts,
    outlets,
    placements,
    shiftTemplates,
  };

  return {
    activeSupervisors: userAccounts.filter(
      (account) =>
        account.access_role === "supervisor" &&
        account.account_status === "active"
    ).length,
    activeOutlets: outlets.filter((outlet) => outlet.is_active).length,
    rosterEligibleEmployees: employees.filter(
      (employee) =>
        employee.archived_at === null &&
        activePositionIds.has(employee.job_position_id)
    ).length,
    readyEmployeeAccounts: userAccounts.filter(
      (account) =>
        account.access_role === "employee" &&
        account.account_status === "active" &&
        account.must_change_password === false
    ).length,
    pilotCapableOutlets: countPilotCapableOutlets(snapshot),
    activePolicyTypes,
    exhaustedDeletionJobs,
    overdueDeletionJobs,
    staleDeletionJobs,
    exhaustedReportJobs,
    latestCron,
    checkedAt: formatJakarta(now),
  };
}

async function run() {
  const facts = await collectFacts();
  const result = evaluatePilotReadiness(facts);

  if (useJson) {
    console.log(JSON.stringify({ ...result, checkedAt: facts.checkedAt }, null, 2));
  } else {
    console.log("Verifikasi kesiapan pilot production");
    console.log(`Diperiksa: ${facts.checkedAt}`);
    console.log("");
    for (const item of result.checks) {
      console.log(`[${item.status.padEnd(7)}] ${item.label}: ${item.detail}`);
    }
    console.log("");
    console.log(`HASIL: ${result.status}`);
  }

  if (result.status === "BLOCKED") process.exitCode = 1;
}

run().catch((error) => {
  console.error(
    `Verifikasi gagal dijalankan: ${
      error instanceof Error ? error.message : "kesalahan tidak dikenal"
    }`
  );
  process.exitCode = 1;
});
