import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const configPath = path.join(repositoryRoot, "supabase", "config.toml");
const config = readFileSync(configPath, "utf8");
const projectId = config.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];

if (!projectId || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(projectId)) {
  throw new Error("project_id lokal Supabase tidak valid.");
}

const container = `supabase_db_${projectId}`;
const timestamp = new Date()
  .toISOString()
  .replaceAll(/[-:TZ.]/g, "")
  .slice(0, 14);
const drillDatabase = `hr_restore_drill_${timestamp}`;
const dumpPath = `/tmp/${drillDatabase}.dump`;

if (!/^hr_restore_drill_\d{14}$/.test(drillDatabase)) {
  throw new Error("Nama database drill tidak lolos validasi keselamatan.");
}

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? result.stderr.trim() : "";
    throw new Error(
      `Perintah Docker gagal (${result.status ?? "unknown"}).${detail ? ` ${detail}` : ""}`
    );
  }
  return options.capture ? result.stdout.trim() : "";
}

function databaseMetric(database, sql) {
  return Number(
    runDocker(
      [
        "exec",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      { capture: true }
    )
  );
}

const running = runDocker(
  ["inspect", "--format", "{{.State.Running}}", container],
  { capture: true }
);
if (running !== "true") {
  throw new Error(`Container lokal ${container} tidak aktif.`);
}

const projectLabel = runDocker(
  [
    "inspect",
    "--format",
    "{{ index .Config.Labels \"com.supabase.cli.project\" }}",
    container,
  ],
  { capture: true }
);
if (projectLabel !== projectId) {
  throw new Error("Container Docker bukan milik project Supabase aktif.");
}

let drillCreated = false;
try {
  console.log(`[1/5] Membuat logical backup lokal project ${projectId}...`);
  runDocker([
    "exec",
    container,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpPath,
  ]);

  const sourceTables = databaseMetric(
    "postgres",
    "select count(*) from pg_catalog.pg_tables where schemaname = 'public'"
  );
  const sourceMigrations = databaseMetric(
    "postgres",
    "select count(*) from supabase_migrations.schema_migrations"
  );
  const sourceFunctions = databaseMetric(
    "postgres",
    "select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"
  );

  console.log(`[2/5] Membuat database disposable ${drillDatabase}...`);
  runDocker([
    "exec",
    "-e",
    "PGPASSWORD=postgres",
    container,
    "createdb",
    "-U",
    "supabase_admin",
    "--template=template0",
    drillDatabase,
  ]);
  drillCreated = true;

  console.log("[3/5] Memulihkan backup ke database disposable...");
  runDocker([
    "exec",
    "-e",
    "PGPASSWORD=postgres",
    container,
    "pg_restore",
    "-U",
    "supabase_admin",
    "-d",
    drillDatabase,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    dumpPath,
  ]);

  console.log("[4/5] Membandingkan struktur dan ledger migration...");
  const restoredTables = databaseMetric(
    drillDatabase,
    "select count(*) from pg_catalog.pg_tables where schemaname = 'public'"
  );
  const restoredMigrations = databaseMetric(
    drillDatabase,
    "select count(*) from supabase_migrations.schema_migrations"
  );
  const restoredFunctions = databaseMetric(
    drillDatabase,
    "select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"
  );

  const comparisons = [
    ["tabel public", sourceTables, restoredTables],
    ["migration", sourceMigrations, restoredMigrations],
    ["fungsi public", sourceFunctions, restoredFunctions],
  ];
  const mismatch = comparisons.find(([, source, restored]) => source !== restored);
  if (mismatch) {
    throw new Error(
      `Verifikasi ${mismatch[0]} gagal: sumber ${mismatch[1]}, hasil restore ${mismatch[2]}.`
    );
  }

  const checksum = runDocker(
    ["exec", container, "sha256sum", dumpPath],
    { capture: true }
  ).split(/\s+/)[0];
  console.log(
    `[PASS] Restore cocok: ${sourceTables} tabel, ${sourceFunctions} fungsi, ${sourceMigrations} migration.`
  );
  console.log(`[PASS] Checksum backup SHA-256: ${checksum}`);
} finally {
  console.log("[5/5] Membersihkan database dan artefak drill...");
  if (drillCreated) {
    runDocker(
      [
        "exec",
        "-e",
        "PGPASSWORD=postgres",
        container,
        "dropdb",
        "-U",
        "supabase_admin",
        "--if-exists",
        drillDatabase,
      ],
      { allowFailure: true }
    );
  }
  runDocker(
    ["exec", container, "rm", "-f", dumpPath],
    { allowFailure: true }
  );
}
