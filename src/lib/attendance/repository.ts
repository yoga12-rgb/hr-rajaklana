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

export interface ClockInInput {
  currentEmployeeId: string;
  clientEventId: string;
  outletId: string;
  location: DeviceLocation;
  selfie: Blob | null;
  notes: string;
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

export async function getAttendanceWorkspace(client: AttendanceClient) {
  const { data, error } = await client.rpc("get_attendance_workspace");
  if (error) throw attendanceError("Data presensi belum dapat dimuat", error);
  return parseWorkspace(data);
}

export async function clockInAttendance(
  client: AttendanceClient,
  input: ClockInInput
) {
  let storagePath: string | null = null;
  let evidence: Json = null;

  if (input.selfie) {
    storagePath = `${input.currentEmployeeId}/${jakartaDatePath()}/${input.clientEventId}.jpg`;
    const upload = await client.storage
      .from("attendance-selfies")
      .upload(storagePath, input.selfie, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (upload.error) {
      throw attendanceError("Selfie belum dapat diunggah", upload.error);
    }
    evidence = {
      storage_path: storagePath,
      mime_type: "image/jpeg",
      size_bytes: input.selfie.size,
    };
  }

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
