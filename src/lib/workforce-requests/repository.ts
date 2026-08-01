import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type WorkforceClient = SupabaseClient<Database>;

export type AccessRole = "employee" | "supervisor" | "management";
export type RequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  deducts_annual_balance: boolean;
  minimum_notice_days: number;
  same_day_allowed: boolean;
  requires_document: boolean;
  document_required_after_days: number | null;
  is_active: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  year: number;
  granted_days: number;
  used_days: number;
  reserved_days: number;
  expired_days: number;
  available_days: number;
}

export interface LeaveAttachment {
  id: string;
  document_type: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  retention_until: string;
  deleted_at: string | null;
}

export interface LiveLeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  position_name: string;
  leave_type_id: string;
  leave_type_name: string;
  starts_on: string;
  ends_on: string;
  requested_days: number;
  reason: string;
  status: RequestStatus;
  request_version: number;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  can_amend: boolean;
  can_cancel: boolean;
  can_request_change: boolean;
  can_decide: boolean;
  attachments: LeaveAttachment[];
}

export type LeaveChangeType = "cancel" | "reschedule";

export interface LiveLeaveChangeRequest {
  id: string;
  leave_request_id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  change_type: LeaveChangeType;
  old_starts_on: string;
  old_ends_on: string;
  old_requested_days: number;
  proposed_starts_on: string | null;
  proposed_ends_on: string | null;
  proposed_days: number | null;
  reason: string;
  status: RequestStatus;
  request_version: number;
  source_leave_version: number;
  reserved_delta_days: number;
  reserved_year: number | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  can_cancel: boolean;
  can_decide: boolean;
  is_stale: boolean;
}

export interface LeaveWorkspace {
  role: AccessRole;
  current_employee_id: string;
  leave_types: LeaveType[];
  balances: LeaveBalance[];
  requests: LiveLeaveRequest[];
  change_requests: LiveLeaveChangeRequest[];
}

export interface SaveLeaveTypeInput {
  id?: string | null;
  code: string;
  name: string;
  deductsAnnualBalance: boolean;
  minimumNoticeDays: number;
  sameDayAllowed: boolean;
  requiresDocument: boolean;
  documentRequiredAfterDays?: number | null;
  isActive: boolean;
  reason: string;
}

export interface SubmitLeaveInput {
  currentEmployeeId: string;
  leaveTypeId: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  attachment?: File | null;
}

export interface AmendPendingLeaveInput {
  requestId: string;
  expectedVersion: number;
  startsOn: string;
  endsOn: string;
  reason: string;
}

export interface SubmitLeaveChangeInput {
  leaveRequestId: string;
  sourceLeaveVersion: number;
  changeType: LeaveChangeType;
  proposedStartsOn?: string | null;
  proposedEndsOn?: string | null;
  reason: string;
}

export interface OvertimeEmployee {
  id: string;
  name: string;
  position_name: string;
}

export interface LiveOvertimeRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  position_name: string;
  source_type:
    | "employee_request"
    | "supervisor_assignment"
    | "attendance";
  overtime_date: string;
  planned_start_time: string | null;
  planned_end_time: string | null;
  planned_duration_min: number;
  actual_duration_min: number | null;
  approved_duration_min: number | null;
  reason: string;
  status: RequestStatus;
  request_version: number;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  can_decide: boolean;
  can_refresh_actual: boolean;
  can_cancel: boolean;
}

export interface OvertimeWorkspace {
  role: AccessRole;
  current_employee_id: string;
  employees: OvertimeEmployee[];
  requests: LiveOvertimeRequest[];
}

export interface SubmitOvertimeInput {
  employeeId?: string | null;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  assignment: boolean;
}

function workforceError(prefix: string, error: { message: string }) {
  return new Error(`${prefix}: ${error.message}`);
}

function parseObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons server workforce tidak valid.");
  }
  return value as Record<string, unknown>;
}

function fileExtension(file: File) {
  const byMime: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byMime[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin";
}

export async function getLeaveWorkspace(client: WorkforceClient) {
  const { data, error } = await client.rpc("get_leave_workspace");
  if (error) throw workforceError("Data cuti belum dapat dimuat", error);
  return parseObject(data) as unknown as LeaveWorkspace;
}

export async function saveLeaveType(
  client: WorkforceClient,
  input: SaveLeaveTypeInput
) {
  const args = {
    p_leave_type_id: input.id ?? null,
    p_code: input.code,
    p_name: input.name,
    p_deducts_annual_balance: input.deductsAnnualBalance,
    p_minimum_notice_days: input.minimumNoticeDays,
    p_same_day_allowed: input.sameDayAllowed,
    p_requires_document: input.requiresDocument,
    p_document_required_after_days:
      input.documentRequiredAfterDays ?? null,
    p_is_active: input.isActive,
    p_reason: input.reason,
  } as unknown as Database["public"]["Functions"]["save_leave_type"]["Args"];
  const { data, error } = await client.rpc("save_leave_type", args);
  if (error) throw workforceError("Jenis cuti belum dapat disimpan", error);
  return data;
}

export async function submitLeaveRequest(
  client: WorkforceClient,
  input: SubmitLeaveInput
) {
  const requestId = crypto.randomUUID();
  let storagePath: string | null = null;
  let attachmentMetadata: Json = null;

  if (input.attachment) {
    storagePath = `${input.currentEmployeeId}/${input.startsOn.slice(
      0,
      4
    )}/${crypto.randomUUID()}.${fileExtension(input.attachment)}`;
    const upload = await client.storage
      .from("leave-documents")
      .upload(storagePath, input.attachment, {
        contentType: input.attachment.type,
        upsert: false,
      });

    if (upload.error) {
      throw workforceError("Dokumen belum dapat diunggah", upload.error);
    }

    attachmentMetadata = {
      storage_path: storagePath,
      document_type: "supporting_document",
      mime_type: input.attachment.type,
      size_bytes: input.attachment.size,
    };
  }

  const args = {
    p_request_id: requestId,
    p_leave_type_id: input.leaveTypeId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_reason: input.reason,
    p_attachment: attachmentMetadata,
  } as unknown as Database["public"]["Functions"]["submit_leave_request"]["Args"];
  const { data, error } = await client.rpc("submit_leave_request", args);

  if (error) {
    if (storagePath) {
      await client.storage.from("leave-documents").remove([storagePath]);
    }
    throw workforceError("Pengajuan cuti belum dapat dikirim", error);
  }

  return data;
}

export async function cancelLeaveRequest(
  client: WorkforceClient,
  requestId: string,
  expectedVersion: number,
  reason: string
) {
  const { data, error } = await client.rpc("cancel_leave_request", {
    p_request_id: requestId,
    p_expected_version: expectedVersion,
    p_reason: reason,
  });
  if (error) throw workforceError("Pengajuan cuti belum dapat dibatalkan", error);
  return data;
}

export async function amendPendingLeaveRequest(
  client: WorkforceClient,
  input: AmendPendingLeaveInput
) {
  const args = {
    p_request_id: input.requestId,
    p_expected_version: input.expectedVersion,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_reason: input.reason,
  } as Database["public"]["Functions"]["amend_pending_leave_request"]["Args"];
  const { data, error } = await client.rpc("amend_pending_leave_request", args);
  if (error) throw workforceError("Tanggal cuti belum dapat diubah", error);
  return data;
}

export async function submitLeaveChangeRequest(
  client: WorkforceClient,
  input: SubmitLeaveChangeInput
) {
  const args = {
    p_leave_request_id: input.leaveRequestId,
    p_source_leave_version: input.sourceLeaveVersion,
    p_change_type: input.changeType,
    p_proposed_starts_on: input.proposedStartsOn ?? null,
    p_proposed_ends_on: input.proposedEndsOn ?? null,
    p_reason: input.reason,
  } as Database["public"]["Functions"]["submit_leave_change_request"]["Args"];
  const { data, error } = await client.rpc("submit_leave_change_request", args);
  if (error) {
    throw workforceError("Permintaan perubahan cuti belum dapat dikirim", error);
  }
  return data;
}

export async function cancelLeaveChangeRequest(
  client: WorkforceClient,
  changeRequestId: string,
  expectedVersion: number,
  reason: string
) {
  const { data, error } = await client.rpc("cancel_leave_change_request", {
    p_change_request_id: changeRequestId,
    p_expected_version: expectedVersion,
    p_reason: reason,
  });
  if (error) {
    throw workforceError("Permintaan perubahan belum dapat dibatalkan", error);
  }
  return data;
}

export async function decideLeaveChangeRequest(
  client: WorkforceClient,
  changeRequestId: string,
  expectedVersion: number,
  decision: "approved" | "rejected",
  note: string
) {
  const { data, error } = await client.rpc("decide_leave_change_request", {
    p_change_request_id: changeRequestId,
    p_expected_version: expectedVersion,
    p_decision: decision,
    p_note: note,
  });
  if (error) {
    throw workforceError("Keputusan perubahan cuti belum dapat disimpan", error);
  }
  return data;
}

export async function decideLeaveRequest(
  client: WorkforceClient,
  requestId: string,
  expectedVersion: number,
  decision: "approved" | "rejected",
  note: string
) {
  const { data, error } = await client.rpc("decide_leave_request", {
    request_id: requestId,
    expected_version: expectedVersion,
    decision,
    note,
  });
  if (error) throw workforceError("Keputusan cuti belum dapat disimpan", error);
  return data;
}

export async function createLeaveDocumentSignedUrl(
  client: WorkforceClient,
  path: string
) {
  const { data, error } = await client.storage
    .from("leave-documents")
    .createSignedUrl(path, 300);
  if (error) throw workforceError("Dokumen belum dapat dibuka", error);
  return data.signedUrl;
}

export async function getOvertimeWorkspace(client: WorkforceClient) {
  const { data, error } = await client.rpc("get_overtime_workspace");
  if (error) throw workforceError("Data lembur belum dapat dimuat", error);
  return parseObject(data) as unknown as OvertimeWorkspace;
}

export async function submitOrAssignOvertime(
  client: WorkforceClient,
  input: SubmitOvertimeInput
) {
  if (input.assignment) {
    if (!input.employeeId) {
      throw new Error("Karyawan penerima penugasan wajib dipilih.");
    }
    const { data, error } = await client.rpc("assign_overtime_request", {
      p_employee_id: input.employeeId,
      p_overtime_date: input.overtimeDate,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_reason: input.reason,
    });
    if (error) throw workforceError("Penugasan lembur belum dapat dikirim", error);
    return data;
  }

  const { data, error } = await client.rpc("submit_overtime_request", {
    p_overtime_date: input.overtimeDate,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_reason: input.reason,
  });
  if (error) throw workforceError("Pengajuan lembur belum dapat dikirim", error);
  return data;
}

export async function cancelOvertimeRequest(
  client: WorkforceClient,
  requestId: string,
  expectedVersion: number,
  reason: string
) {
  const { data, error } = await client.rpc("cancel_overtime_request", {
    p_request_id: requestId,
    p_expected_version: expectedVersion,
    p_reason: reason,
  });
  if (error) throw workforceError("Lembur belum dapat dibatalkan", error);
  return data;
}

export async function refreshOvertimeActual(
  client: WorkforceClient,
  requestId: string
) {
  const { data, error } = await client.rpc("refresh_overtime_actual", {
    p_request_id: requestId,
  });
  if (error) throw workforceError("Durasi aktual belum dapat dihitung", error);
  return data;
}

export async function decideOvertimeRequest(
  client: WorkforceClient,
  requestId: string,
  expectedVersion: number,
  decision: "approved" | "rejected",
  approvedMinutes: number,
  note: string
) {
  const { data, error } = await client.rpc("decide_overtime_request", {
    request_id: requestId,
    expected_version: expectedVersion,
    decision,
    approved_minutes: approvedMinutes,
    note,
  });
  if (error) throw workforceError("Keputusan lembur belum dapat disimpan", error);
  return data;
}
