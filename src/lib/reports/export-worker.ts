import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  getReportWorkspace,
  type ReportExportJob,
  type ReportOutletComparison,
  type ReportShiftDistribution,
  type ReportWorkspace,
} from "./repository";
import { reportWorkbookSheets } from "./workbook";

type ReportClient = SupabaseClient<Database>;

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function chunkPeriod(periodStart: string, periodEnd: string) {
  const chunks: Array<{ start: string; end: string }> = [];
  let start = periodStart;
  while (start <= periodEnd) {
    const candidateEnd = addDays(start, 91);
    const end = candidateEnd < periodEnd ? candidateEnd : periodEnd;
    chunks.push({ start, end });
    start = addDays(end, 1);
  }
  return chunks;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function mergeShiftDistribution(rows: ReportShiftDistribution[]) {
  const totals = new Map<string, ReportShiftDistribution>();
  for (const row of rows) {
    const key = `${row.shift_type}|${row.assignment_type}|${row.status}`;
    const existing = totals.get(key);
    totals.set(key, {
      ...row,
      total: (existing?.total ?? 0) + row.total,
    });
  }
  return [...totals.values()];
}

function mergeOutletComparison(rows: ReportOutletComparison[]) {
  const totals = new Map<string, ReportOutletComparison>();
  for (const row of rows) {
    const existing = totals.get(row.outlet_id);
    totals.set(row.outlet_id, {
      ...row,
      attendance_count:
        (existing?.attendance_count ?? 0) + row.attendance_count,
      late_count: (existing?.late_count ?? 0) + row.late_count,
      early_checkout_count:
        (existing?.early_checkout_count ?? 0) + row.early_checkout_count,
    });
  }
  return [...totals.values()].sort((a, b) =>
    a.outlet_name.localeCompare(b.outlet_name, "id-ID")
  );
}

function mergeReportChunks(
  chunks: ReportWorkspace[],
  job: ReportExportJob
): ReportWorkspace {
  const first = chunks[0];
  if (!first) throw new Error("Dataset laporan kosong.");

  const attendance = uniqueById(chunks.flatMap((chunk) => chunk.attendance));
  const leaves = uniqueById(chunks.flatMap((chunk) => chunk.leaves));
  const overtime = uniqueById(chunks.flatMap((chunk) => chunk.overtime));

  return {
    ...first,
    period_start: job.period_start,
    period_end: job.period_end,
    attendance: attendance.sort((a, b) =>
      b.clock_in_at.localeCompare(a.clock_in_at)
    ),
    leaves: leaves.sort((a, b) => b.starts_on.localeCompare(a.starts_on)),
    overtime: overtime.sort((a, b) =>
      b.overtime_date.localeCompare(a.overtime_date)
    ),
    shift_distribution: mergeShiftDistribution(
      chunks.flatMap((chunk) => chunk.shift_distribution)
    ),
    outlet_comparison: mergeOutletComparison(
      chunks.flatMap((chunk) => chunk.outlet_comparison)
    ),
    summary: {
      employee_count: first.summary.employee_count,
      attendance_count: attendance.length,
      on_time_count: attendance.filter((row) =>
        ["on_time", "flexible"].includes(row.clock_in_state)
      ).length,
      late_count: attendance.filter((row) => row.clock_in_state === "late")
        .length,
      early_checkout_count: attendance.filter((row) =>
        ["early", "short_hours"].includes(row.clock_out_state ?? "")
      ).length,
      approved_leave_days: leaves
        .filter((row) => row.status === "approved")
        .reduce((total, row) => total + row.requested_days, 0),
      approved_overtime_minutes: overtime
        .filter((row) => row.status === "approved")
        .reduce(
          (total, row) => total + (row.approved_duration_min ?? 0),
          0
        ),
    },
  };
}

/** Mengklaim satu job, membangun XLSX dari snapshot tersegmentasi, lalu upload privat. */
export async function processReportExport(
  exportId: string,
  requesterClient: ReportClient
) {
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_report_export",
    { p_export_id: exportId }
  );
  if (claimError || !claimed) {
    throw new Error(claimError?.message ?? "Job ekspor tidak dapat diklaim.");
  }

  const job = claimed as ReportExportJob;
  try {
    const snapshots = await Promise.all(
      chunkPeriod(job.period_start, job.period_end).map((period) =>
        getReportWorkspace(requesterClient, {
          periodStart: period.start,
          periodEnd: period.end,
          outletId: job.outlet_id ?? "",
          employeeId: job.employee_id ?? "",
        })
      )
    );
    const report = mergeReportChunks(snapshots, job);
    const { default: writeXlsxFile } = await import("write-excel-file/node");
    const buffer = await writeXlsxFile(reportWorkbookSheets(report)).toBuffer();
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const year = job.period_start.slice(0, 4);
    const month = job.period_start.slice(5, 7);
    const storagePath = `${job.requested_by}/${year}/${month}/${job.id}.xlsx`;
    const { error: uploadError } = await admin.storage
      .from("exports")
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: completionError } = await admin.rpc(
      "complete_report_export",
      {
        p_export_id: job.id,
        p_storage_path: storagePath,
        p_checksum: checksum,
        p_file_size_bytes: buffer.byteLength,
      }
    );
    if (completionError) throw completionError;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Worker ekspor gagal.";
    await admin.rpc("fail_report_export", {
      p_export_id: job.id,
      p_error: message,
    });
    throw error;
  }
}
