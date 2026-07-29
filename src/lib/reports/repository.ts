import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ReportFilters } from "./query-keys";

type ReportClient = SupabaseClient<Database>;

export interface ReportOption {
  id: string;
  name: string;
  code?: string;
  nik?: string;
  position_name?: string;
  is_active?: boolean;
}

export interface ReportAttendanceRow {
  id: string;
  employee_id: string;
  employee_name: string;
  position_name: string;
  outlet_id: string;
  outlet_name: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  worked_duration_min: number | null;
  clock_in_state: "on_time" | "late" | "flexible";
  clock_out_state: string | null;
  validation_status: string;
}

export interface ReportLeaveRow {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_name: string;
  starts_on: string;
  ends_on: string;
  requested_days: number;
  status: string;
}

export interface ReportOvertimeRow {
  id: string;
  employee_id: string;
  employee_name: string;
  overtime_date: string;
  source_type: string;
  planned_duration_min: number;
  actual_duration_min: number | null;
  approved_duration_min: number | null;
  status: string;
}

export interface ReportShiftDistribution {
  shift_type: string;
  assignment_type: string;
  status: string;
  total: number;
}

export interface ReportOutletComparison {
  outlet_id: string;
  outlet_name: string;
  attendance_count: number;
  late_count: number;
  early_checkout_count: number;
}

export interface ReportWorkspace {
  role: "supervisor" | "management";
  period_start: string;
  period_end: string;
  selected_outlet_id: string | null;
  selected_employee_id: string | null;
  filters: {
    outlets: ReportOption[];
    employees: ReportOption[];
  };
  summary: {
    employee_count: number;
    attendance_count: number;
    on_time_count: number;
    late_count: number;
    early_checkout_count: number;
    approved_leave_days: number;
    approved_overtime_minutes: number;
  };
  attendance: ReportAttendanceRow[];
  leaves: ReportLeaveRow[];
  overtime: ReportOvertimeRow[];
  shift_distribution: ReportShiftDistribution[];
  outlet_comparison: ReportOutletComparison[];
}

export interface ReportExportJob {
  id: string;
  period_start: string;
  period_end: string;
  outlet_id: string | null;
  employee_id: string | null;
  requested_by: string;
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  storage_path: string | null;
  checksum: string | null;
  file_size_bytes: number | null;
  attempt_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function parseWorkspace(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons server laporan tidak valid.");
  }
  return value as unknown as ReportWorkspace;
}

export async function getReportWorkspace(
  client: ReportClient,
  filters: ReportFilters
) {
  const { data, error } = await client.rpc("get_report_workspace", {
    p_period_start: filters.periodStart,
    p_period_end: filters.periodEnd,
    ...(filters.outletId ? { p_outlet_id: filters.outletId } : {}),
    ...(filters.employeeId ? { p_employee_id: filters.employeeId } : {}),
  });
  if (error) {
    throw new Error(`Laporan belum dapat dimuat: ${error.message}`);
  }
  return parseWorkspace(data);
}

export async function getReportExportJobs(client: ReportClient) {
  const { data, error } = await client.rpc("get_report_export_jobs");
  if (error) {
    throw new Error(`Riwayat ekspor belum dapat dimuat: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Respons riwayat ekspor tidak valid.");
  }
  return data as unknown as ReportExportJob[];
}

export async function requestReportExport(filters: ReportFilters) {
  const response = await fetch("/api/reports/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...filters,
      requestKey: crypto.randomUUID(),
    }),
  });
  const payload = (await response.json()) as {
    job?: ReportExportJob;
    error?: string;
  };
  if (!response.ok || !payload.job) {
    throw new Error(payload.error ?? "Ekspor belum dapat dijadwalkan.");
  }
  return payload.job;
}

export async function retryReportExport(exportId: string) {
  const response = await fetch("/api/reports/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exportId }),
  });
  const payload = (await response.json()) as {
    job?: ReportExportJob;
    error?: string;
  };
  if (!response.ok || !payload.job) {
    throw new Error(payload.error ?? "Ekspor belum dapat diulang.");
  }
  return payload.job;
}

export async function createReportExportDownloadUrl(
  client: ReportClient,
  job: ReportExportJob
) {
  if (job.status !== "completed" || !job.storage_path) {
    throw new Error("File ekspor belum tersedia.");
  }
  const { data, error } = await client.storage
    .from("exports")
    .createSignedUrl(job.storage_path, 60);
  if (error || !data?.signedUrl) {
    throw new Error("Tautan unduhan belum dapat dibuat.");
  }
  return data.signedUrl;
}
