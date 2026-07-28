import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type AttendanceClient = SupabaseClient<Database>;
export type AccessRole = "employee" | "supervisor" | "management";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
  mocked?: boolean;
}

export interface AttendanceOutlet {
  id: string;
  name: string;
  address: string;
  geofence_radius_m: number;
}

export interface GeofencePreview {
  outlet_id: string;
  outlet_name: string;
  distance_m: number;
  radius_m: number;
  within_geofence: boolean;
  accuracy_m: number;
  max_accuracy_m: number;
  accuracy_ok: boolean;
  location_age_seconds: number;
  location_fresh: boolean;
}

export type ClockInPhase = "uploading" | "saving";

export interface AttendanceSession {
  id: string;
  outlet_id: string;
  outlet_name: string;
  schedule_assignment_id: string | null;
  clock_in_at: string;
  clock_in_state: "on_time" | "late" | "flexible";
  clock_in_distance_m: number;
  notes: string | null;
}

export interface AttendanceHistory {
  id: string;
  work_date: string;
  outlet_name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  worked_duration_min: number | null;
  clock_in_state: "on_time" | "late" | "flexible";
  clock_out_state:
    | "on_time"
    | "early"
    | "potential_overtime"
    | "short_hours"
    | "complete"
    | null;
  validation_status: "pending" | "approved" | "rejected" | "needs_correction";
  clock_in_distance_m: number;
  clock_out_distance_m: number | null;
}

export interface TodayAssignment {
  id: string;
  outlet_id: string;
  outlet_name: string;
  outlet_address: string;
  work_date: string;
  planned_start: string;
  planned_end: string;
  planned_duration_min: number;
}

export interface AttendanceWorkspace {
  role: AccessRole;
  current_employee_id: string;
  server_time: string;
  requires_selfie: boolean;
  policy: {
    gps_max_accuracy_m?: number;
    clock_in_early_minutes?: number;
  };
  open_session: AttendanceSession | null;
  today_assignment: TodayAssignment | null;
  available_outlets: AttendanceOutlet[];
  history: AttendanceHistory[];
}

export interface AttendanceValidationItem {
  id: string;
  employee_id: string;
  employee_name: string;
  outlet_name: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  worked_duration_min: number | null;
  clock_in_state: string;
  clock_out_state: string | null;
  record_version: number;
  evidence: {
    id: string;
    storage_path: string;
    uploaded_at: string;
    retention_status: string;
    deleted_at: string | null;
  } | null;
}

export interface AttendanceRetentionHealth {
  scheduledJobs: number;
  retryingJobs: number;
  overdueJobs: number;
  staleProcessingJobs: number;
  exhaustedJobs: number;
}

export interface ClockInInput {
  currentEmployeeId: string;
  clientEventId: string;
  outletId: string;
  location: DeviceLocation;
  selfie: Blob | null;
  notes: string;
  onPhase?: (phase: ClockInPhase) => void;
}

function attendanceError(prefix: string, error: { message: string }) {
  return new Error(`${prefix}: ${error.message}`);
}

function parseWorkspace(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons workspace presensi tidak valid.");
  }
  return value as unknown as AttendanceWorkspace;
}

function jakartaDatePath() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}/${value("month")}/${value("day")}`;
}

function isDuplicateUpload(error: { message: string }) {
  const candidate = error as {
    message: string;
    statusCode?: number | string;
  };
  const message = candidate.message.toLocaleLowerCase("en-US");
  return (
    String(candidate.statusCode ?? "") === "409" ||
    message.includes("already exists") ||
    message.includes("duplicate")
  );
}

export async function getAttendanceWorkspace(client: AttendanceClient) {
  const { data, error } = await client.rpc("get_attendance_workspace");
  if (error) throw attendanceError("Data presensi belum dapat dimuat", error);
  return parseWorkspace(data);
}

export async function previewAttendanceGeofence(
  client: AttendanceClient,
  outletId: string,
  location: DeviceLocation
) {
  const args = {
    p_outlet_id: outletId,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_accuracy_m: location.accuracy,
    p_captured_at: location.capturedAt,
  } as unknown as Database["public"]["Functions"]["preview_attendance_geofence"]["Args"];
  const { data, error } = await client.rpc(
    "preview_attendance_geofence",
    args
  );
  if (error) {
    throw attendanceError("Geofence belum dapat diverifikasi", error);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respons preview geofence tidak valid.");
  }
  return data as unknown as GeofencePreview;
}

export async function clockInAttendance(
  client: AttendanceClient,
  input: ClockInInput
) {
  let storagePath: string | null = null;
  let evidence: Json = null;

  if (input.selfie) {
    input.onPhase?.("uploading");
    storagePath = `${input.currentEmployeeId}/${jakartaDatePath()}/${input.clientEventId}.jpg`;
    const upload = await client.storage
      .from("attendance-selfies")
      .upload(storagePath, input.selfie, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (upload.error && !isDuplicateUpload(upload.error)) {
      throw attendanceError("Selfie belum dapat diunggah", upload.error);
    }
    evidence = {
      storage_path: storagePath,
      mime_type: "image/jpeg",
      size_bytes: input.selfie.size,
    };
  }

  input.onPhase?.("saving");
  const args = {
    p_client_event_id: input.clientEventId,
    p_outlet_id: input.outletId,
    p_latitude: input.location.latitude,
    p_longitude: input.location.longitude,
    p_accuracy_m: input.location.accuracy,
    p_captured_at: input.location.capturedAt,
    p_location_mocked: input.location.mocked ?? false,
    p_evidence: evidence,
    p_notes: input.notes || null,
  } as unknown as Database["public"]["Functions"]["clock_in_attendance"]["Args"];
  const { data, error } = await client.rpc("clock_in_attendance", args);

  if (error) {
    if (storagePath) {
      await client.storage.from("attendance-selfies").remove([storagePath]);
    }
    throw attendanceError("Clock-in belum berhasil", error);
  }
  return data;
}

export async function clockOutAttendance(
  client: AttendanceClient,
  attendanceId: string,
  location: DeviceLocation
) {
  const args = {
    p_attendance_id: attendanceId,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_accuracy_m: location.accuracy,
    p_captured_at: location.capturedAt,
    p_location_mocked: location.mocked ?? false,
  } as unknown as Database["public"]["Functions"]["clock_out_attendance"]["Args"];
  const { data, error } = await client.rpc("clock_out_attendance", args);
  if (error) throw attendanceError("Clock-out belum berhasil", error);
  return data;
}

export async function listPendingAttendanceValidations(
  client: AttendanceClient
) {
  const { data, error } = await client
    .from("attendance_records")
    .select(
      `
        id,
        employee_id,
        work_date,
        clock_in_at,
        clock_out_at,
        worked_duration_min,
        clock_in_state,
        clock_out_state,
        record_version,
        employee:employees!attendance_records_employee_id_fkey (full_name),
        outlet:outlets!attendance_records_outlet_id_fkey (name),
        evidence:attendance_evidence (
          id,
          storage_path,
          uploaded_at,
          retention_status,
          deleted_at
        )
      `
    )
    .eq("validation_status", "pending")
    .order("validation_due_at")
    .limit(50);

  if (error) {
    throw attendanceError("Antrean validasi belum dapat dimuat", error);
  }

  return (data ?? []).map((record) => ({
    id: record.id,
    employee_id: record.employee_id,
    employee_name: record.employee?.full_name ?? "Karyawan",
    outlet_name: record.outlet?.name ?? "Outlet",
    work_date: record.work_date,
    clock_in_at: record.clock_in_at,
    clock_out_at: record.clock_out_at,
    worked_duration_min: record.worked_duration_min,
    clock_in_state: record.clock_in_state,
    clock_out_state: record.clock_out_state,
    record_version: record.record_version,
    evidence: record.evidence[0] ?? null,
  })) satisfies AttendanceValidationItem[];
}

export async function decideAttendanceValidation(
  client: AttendanceClient,
  input: {
    attendanceId: string;
    decision: "approved" | "rejected" | "needs_correction";
    note: string;
    expectedVersion: number;
  }
) {
  const { data, error } = await client.rpc("validate_attendance", {
    attendance_id: input.attendanceId,
    decision: input.decision,
    note: input.note,
    expected_version: input.expectedVersion,
  });
  if (error) {
    throw attendanceError("Keputusan presensi belum dapat disimpan", error);
  }
  return data;
}

export async function createAttendanceSelfieSignedUrl(
  client: AttendanceClient,
  path: string
) {
  const { data, error } = await client.storage
    .from("attendance-selfies")
    .createSignedUrl(path, 120);
  if (error) {
    throw attendanceError("Selfie presensi belum dapat dibuka", error);
  }
  return data.signedUrl;
}

export async function getAttendanceRetentionHealth(client: AttendanceClient) {
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const evidenceJobs = () =>
    client
      .from("file_deletion_jobs")
      .select("id", { count: "exact", head: true })
      .not("evidence_id", "is", null);

  const [scheduled, retrying, overdue, staleProcessing, exhausted] =
    await Promise.all([
      evidenceJobs().eq("status", "scheduled"),
      evidenceJobs().eq("status", "failed").lt("attempt_count", 6),
      evidenceJobs()
        .in("status", ["scheduled", "failed"])
        .lte("scheduled_for", now)
        .lt("attempt_count", 6),
      evidenceJobs()
        .eq("status", "processing")
        .lt("updated_at", staleBefore),
      evidenceJobs().eq("status", "failed").gte("attempt_count", 6),
    ]);

  const failedQuery = [
    scheduled,
    retrying,
    overdue,
    staleProcessing,
    exhausted,
  ].find((result) => result.error);
  if (failedQuery?.error) {
    throw attendanceError(
      "Status retensi belum dapat dimuat",
      failedQuery.error
    );
  }

  return {
    scheduledJobs: scheduled.count ?? 0,
    retryingJobs: retrying.count ?? 0,
    overdueJobs: overdue.count ?? 0,
    staleProcessingJobs: staleProcessing.count ?? 0,
    exhaustedJobs: exhausted.count ?? 0,
  } satisfies AttendanceRetentionHealth;
}
