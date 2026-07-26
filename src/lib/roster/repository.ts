import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type RosterClient = SupabaseClient<Database>;

export type RosterShiftType = "morning" | "middle" | "night" | "off";
export type RosterScheduleStatus = "scheduled" | "off";
export type RosterAssignmentType = "primary" | "backup";

export interface RosterPeriodSummary {
  id: string;
  month_start: string;
  status: "preparing" | "draft" | "published" | "closed";
  publish_deadline: string;
  active_version_id: string | null;
}

export interface RosterVersionSummary {
  id: string;
  version_number: number;
  status: "draft" | "published" | "superseded";
  change_summary: string | null;
  published_at: string | null;
}

export interface RosterEmployee {
  id: string;
  name: string;
  position: string;
  primary_outlet_id: string;
  primary_outlet_name: string;
}

export interface RosterAssignment {
  id: string | null;
  employee_id: string | null;
  employee_name: string;
  outlet_id: string | null;
  outlet_name: string;
  work_date: string;
  shift_type: RosterShiftType;
  planned_start: string | null;
  planned_end: string | null;
  status: "scheduled" | "off" | "cancelled";
  assignment_type: RosterAssignmentType;
  is_own: boolean;
  acknowledged: boolean;
}

export interface RosterOffDay {
  id: string;
  employee_id: string;
  off_date: string;
  source_week_start: string;
  borrowed_from_adjacent_week: boolean;
  override_reason: string | null;
}

export interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_schedule_id: string;
  colleague_id: string;
  colleague_name: string;
  colleague_schedule_id: string;
  reason: string;
  status:
    | "pending_colleague"
    | "pending_supervisor"
    | "approved"
    | "rejected"
    | "cancelled";
  decision_note: string | null;
  is_requester: boolean;
  is_colleague: boolean;
}

export interface MonthlyRoster {
  period: RosterPeriodSummary | null;
  version: RosterVersionSummary | null;
  employees: RosterEmployee[];
  assignments: RosterAssignment[];
  off_days: RosterOffDay[];
  swap_requests: ShiftSwapRequest[];
}

export interface SaveRosterAssignmentInput {
  monthStart: string;
  employeeId: string;
  workDate: string;
  outletId: string | null;
  shiftType: Exclude<RosterShiftType, "off"> | null;
  status: RosterScheduleStatus;
  assignmentType: RosterAssignmentType;
  reason: string;
  sourceWeekStart?: string | null;
  borrowedFromAdjacentWeek?: boolean;
}

export interface SaveRosterAssignmentResult {
  roster_version_id: string;
  assignment_id: string;
  warnings: Array<{ code: string; message: string }>;
}

export interface PublishRosterResult {
  roster_version_id: string;
  version_number: number;
  published_assignments: number;
}

export interface ShiftSwapOption {
  schedule_id: string;
  employee_name: string;
  work_date: string;
  shift_type: Exclude<RosterShiftType, "off">;
  planned_start: string;
  planned_end: string;
}

function rosterError(prefix: string, error: { message: string }) {
  return new Error(`${prefix}: ${error.message}`);
}

function parseObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons roster dari server tidak valid.");
  }
  return value as Record<string, unknown>;
}

export async function getMonthlyRoster(
  client: RosterClient,
  monthStart: string
) {
  const { data, error } = await client.rpc("get_monthly_roster", {
    p_month_start: monthStart,
  });

  if (error) throw rosterError("Gagal memuat roster", error);
  return parseObject(data) as unknown as MonthlyRoster;
}

export async function saveManualRosterAssignment(
  client: RosterClient,
  input: SaveRosterAssignmentInput
) {
  const args = {
    p_month_start: input.monthStart,
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_outlet_id: input.outletId,
    p_shift_type: input.shiftType,
    p_status: input.status,
    p_assignment_type: input.assignmentType,
    p_reason: input.reason,
    p_source_week_start: input.sourceWeekStart ?? undefined,
    p_borrowed_from_adjacent_week:
      input.borrowedFromAdjacentWeek ?? false,
  } as unknown as Database["public"]["Functions"]["save_manual_roster_assignment"]["Args"];
  const { data, error } = await client.rpc(
    "save_manual_roster_assignment",
    args
  );

  if (error) throw rosterError("Jadwal belum dapat disimpan", error);
  return parseObject(data) as unknown as SaveRosterAssignmentResult;
}

export async function publishManualRoster(
  client: RosterClient,
  rosterVersionId: string,
  reason: string
) {
  const { data, error } = await client.rpc("publish_manual_roster", {
    p_roster_version_id: rosterVersionId,
    p_reason: reason,
  });

  if (error) throw rosterError("Roster belum dapat dipublikasikan", error);
  return parseObject(data) as unknown as PublishRosterResult;
}

export async function acknowledgeMonthlyRoster(
  client: RosterClient,
  monthStart: string
) {
  const { data, error } = await client.rpc("acknowledge_monthly_roster", {
    p_month_start: monthStart,
  });

  if (error) throw rosterError("Jadwal belum dapat ditandai dibaca", error);
  return parseObject(data);
}

export async function getShiftSwapOptions(
  client: RosterClient,
  requesterScheduleId: string
) {
  const { data, error } = await client.rpc("get_shift_swap_options", {
    p_requester_schedule_id: requesterScheduleId,
  });

  if (error) throw rosterError("Pilihan tukar shift belum dapat dimuat", error);
  return (data ?? []) as unknown as ShiftSwapOption[];
}

export async function requestShiftSwap(
  client: RosterClient,
  requesterScheduleId: string,
  colleagueScheduleId: string,
  reason: string
) {
  const { data, error } = await client.rpc("request_shift_swap", {
    p_requester_schedule_id: requesterScheduleId,
    p_colleague_schedule_id: colleagueScheduleId,
    p_reason: reason,
  });

  if (error) throw rosterError("Permintaan tukar shift belum dapat dikirim", error);
  return parseObject(data);
}

export async function decideShiftSwapColleague(
  client: RosterClient,
  requestId: string,
  decision: "accept" | "reject",
  note: string
) {
  const { data, error } = await client.rpc("decide_shift_swap_colleague", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note || undefined,
  });

  if (error) throw rosterError("Keputusan rekan belum dapat disimpan", error);
  return parseObject(data);
}

export async function decideShiftSwapSupervisor(
  client: RosterClient,
  requestId: string,
  decision: "approve" | "reject",
  note: string
) {
  const { data, error } = await client.rpc("decide_shift_swap_supervisor", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  });

  if (error) {
    throw rosterError("Keputusan supervisor belum dapat disimpan", error);
  }
  return parseObject(data);
}
