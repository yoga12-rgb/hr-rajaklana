"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export type MasterDataClient = SupabaseClient<Database>;

export interface EmployeeMasterInput {
  nik: string;
  fullName: string;
  phone: string;
  joinedAt: string;
  employmentStatusId: string;
  jobPositionId: string;
  outletId: string;
  changeReason: string;
}

export interface UpdateEmployeeMasterInput extends EmployeeMasterInput {
  employeeId: string;
  effectiveDate: string;
}

export interface OutletMasterInput {
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
  reason: string;
}

export interface UpdateOutletMasterInput extends OutletMasterInput {
  outletId: string;
}

export interface PolicyVersionInput {
  policyType: "attendance" | "leave" | "overtime" | "roster";
  configuration: Json;
  reason: string;
}

export interface WorkPolicyInput {
  attendanceConfiguration: Json;
  overtimeConfiguration: Json;
  reason: string;
}

export interface ShiftTemplateInput {
  outletId: string;
  shiftType: Database["public"]["Enums"]["shift_type"];
  startsAt: string;
  endsAt: string;
  lateToleranceMin: number;
  earlyCheckoutToleranceMin: number;
  reason: string;
}

export interface EmployeeImportRow {
  nik: string;
  full_name: string;
  phone: string;
  joined_at: string;
  employment_status_code: string;
  job_position_code: string;
  outlet_code: string;
  change_reason: string;
}

export interface EmployeeImportValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface EmployeeImportRowError {
  row_number: number;
  errors: EmployeeImportValidationIssue[];
}

export interface EmployeeImportDryRunResult {
  job_id: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  validation_errors: EmployeeImportRowError[];
  payload_checksum: string;
}

export interface EmployeeImportCommitResult {
  job_id: string;
  dry_run_job_id: string;
  imported_rows: number;
}

export interface EmployeeImportDryRunInput {
  sourceFileName: string;
  rows: EmployeeImportRow[];
}

export interface EmployeeImportCommitInput {
  dryRunJobId: string;
  rows: EmployeeImportRow[];
  reason: string;
}

function toMasterDataError(
  action: string,
  error: { code?: string; message: string }
) {
  if (error.code === "23505") {
    return new Error(
      action.toLocaleLowerCase("id-ID").includes("outlet")
        ? "Kode outlet tersebut sudah digunakan."
        : "NIK tersebut sudah digunakan karyawan lain."
    );
  }

  if (error.code === "42501") {
    return new Error("Aksi ini hanya dapat dilakukan supervisor.");
  }

  if (error.code === "23503") {
    return new Error(error.message);
  }

  return new Error(`${action}: ${error.message}`);
}

/**
 * Repository baca data master. Seluruh query memakai client pengguna aktif,
 * sehingga hasilnya tetap dibatasi oleh RLS Supabase.
 */
export async function listActiveEmployees(client: MasterDataClient) {
  const { data, error } = await client
    .from("employees")
    .select(
      `
        id,
        nik,
        full_name,
        phone,
        joined_at,
        archived_at,
        job_position:job_positions!employees_job_position_id_fkey (
          id,
          code,
          name
        ),
        employment_status:employment_statuses!employees_employment_status_id_fkey (
          id,
          code,
          name
        ),
        placements:employee_placements (
          id,
          is_primary,
          start_date,
          end_date,
          outlet:outlets (
            id,
            code,
            name
          )
        ),
        user_account:user_accounts (
          user_id,
          access_role,
          account_status
        )
      `
    )
    .is("archived_at", null)
    .order("full_name");

  if (error) {
    throw new Error(`Gagal memuat data karyawan: ${error.message}`);
  }

  return data;
}

export async function listActiveOutlets(
  client: MasterDataClient,
  includeInactive = false
) {
  let query = client
    .from("outlets")
    .select(
      "id, code, name, address, latitude, longitude, geofence_radius_m, is_active"
    )
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal memuat data outlet: ${error.message}`);
  }

  return data;
}

export async function listActiveJobPositions(client: MasterDataClient) {
  const { data, error } = await client
    .from("job_positions")
    .select("id, code, name, auto_roster_eligible")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(`Gagal memuat data jabatan: ${error.message}`);
  }

  return data;
}

export async function listActiveEmploymentStatuses(client: MasterDataClient) {
  const { data, error } = await client
    .from("employment_statuses")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(`Gagal memuat status kerja: ${error.message}`);
  }

  return data;
}

export async function listCurrentPolicies(client: MasterDataClient) {
  const { data, error } = await client
    .from("policy_versions")
    .select(
      "id, policy_type, version_number, configuration, effective_from, created_at"
    )
    .is("effective_until", null)
    .order("policy_type");

  if (error) {
    throw new Error(`Gagal memuat kebijakan aktif: ${error.message}`);
  }

  return data;
}

export async function listActiveShiftTemplates(client: MasterDataClient) {
  const { data, error } = await client
    .from("outlet_shift_templates")
    .select(
      `
        id,
        outlet_id,
        shift_type,
        starts_at,
        ends_at,
        late_tolerance_min,
        early_checkout_tolerance_min,
        outlet:outlets!outlet_shift_templates_outlet_id_fkey (
          id,
          code,
          name
        )
      `
    )
    .eq("is_active", true)
    .order("shift_type");

  if (error) {
    throw new Error(`Gagal memuat template shift: ${error.message}`);
  }

  return data;
}

export async function getCurrentAccessRole(client: MasterDataClient) {
  const { data, error } = await client.rpc("current_access_role");

  if (error) {
    throw new Error(`Gagal memeriksa hak akses: ${error.message}`);
  }

  return data;
}

export async function createEmployeeMaster(
  client: MasterDataClient,
  input: EmployeeMasterInput
) {
  const { data, error } = await client.rpc("create_employee_master", {
    p_nik: input.nik,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_joined_at: input.joinedAt,
    p_employment_status_id: input.employmentStatusId,
    p_job_position_id: input.jobPositionId,
    p_outlet_id: input.outletId,
    p_change_reason: input.changeReason,
  });

  if (error) {
    throw toMasterDataError("Gagal menambahkan karyawan", error);
  }

  return data;
}

export async function updateEmployeeMaster(
  client: MasterDataClient,
  input: UpdateEmployeeMasterInput
) {
  const { error } = await client.rpc("update_employee_master", {
    p_employee_id: input.employeeId,
    p_nik: input.nik,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_joined_at: input.joinedAt,
    p_employment_status_id: input.employmentStatusId,
    p_job_position_id: input.jobPositionId,
    p_outlet_id: input.outletId,
    p_effective_date: input.effectiveDate,
    p_change_reason: input.changeReason,
  });

  if (error) {
    throw toMasterDataError("Gagal memperbarui karyawan", error);
  }
}

export async function archiveEmployeeMaster(
  client: MasterDataClient,
  employeeId: string,
  reason: string
) {
  const { data, error } = await client.rpc("archive_employee_master", {
    p_employee_id: employeeId,
    p_reason: reason,
  });

  if (error) {
    throw toMasterDataError("Gagal mengarsipkan karyawan", error);
  }

  if (!data) {
    throw new Error("Karyawan sudah diarsipkan atau tidak ditemukan.");
  }
}

export async function createOutletMaster(
  client: MasterDataClient,
  input: OutletMasterInput
) {
  const { data, error } = await client.rpc("create_outlet_master", {
    p_code: input.code,
    p_name: input.name,
    p_address: input.address,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_geofence_radius_m: input.geofenceRadiusM,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal menambahkan outlet", error);
  }

  return data;
}

export async function updateOutletMaster(
  client: MasterDataClient,
  input: UpdateOutletMasterInput
) {
  const { error } = await client.rpc("update_outlet_master", {
    p_outlet_id: input.outletId,
    p_code: input.code,
    p_name: input.name,
    p_address: input.address,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_geofence_radius_m: input.geofenceRadiusM,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal memperbarui outlet", error);
  }
}

export async function setOutletActive(
  client: MasterDataClient,
  outletId: string,
  isActive: boolean,
  reason: string
) {
  const { error } = await client.rpc("set_outlet_active", {
    p_outlet_id: outletId,
    p_is_active: isActive,
    p_reason: reason,
  });

  if (error) {
    throw toMasterDataError("Gagal mengubah status outlet", error);
  }
}

export async function publishPolicyVersion(
  client: MasterDataClient,
  input: PolicyVersionInput
) {
  const { data, error } = await client.rpc("publish_policy_version", {
    p_policy_type: input.policyType,
    p_configuration: input.configuration,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal menerbitkan kebijakan", error);
  }

  return data;
}

export async function publishWorkPolicy(
  client: MasterDataClient,
  input: WorkPolicyInput
) {
  const { data, error } = await client.rpc("publish_work_policy", {
    p_attendance_configuration: input.attendanceConfiguration,
    p_overtime_configuration: input.overtimeConfiguration,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal menerbitkan kebijakan kerja", error);
  }

  return data;
}

export async function replaceOutletShiftTemplate(
  client: MasterDataClient,
  input: ShiftTemplateInput
) {
  const { data, error } = await client.rpc("replace_outlet_shift_template", {
    p_outlet_id: input.outletId,
    p_shift_type: input.shiftType,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_late_tolerance_min: input.lateToleranceMin,
    p_early_checkout_tolerance_min: input.earlyCheckoutToleranceMin,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal menyimpan template shift", error);
  }

  return data;
}

function parseEmployeeImportDryRun(
  value: Json
): EmployeeImportDryRunResult {
  const result = value as unknown as EmployeeImportDryRunResult;

  if (
    !result ||
    typeof result.job_id !== "string" ||
    typeof result.total_rows !== "number" ||
    typeof result.success_rows !== "number" ||
    typeof result.failed_rows !== "number" ||
    !Array.isArray(result.validation_errors) ||
    typeof result.payload_checksum !== "string"
  ) {
    throw new Error("Respons validasi impor dari server tidak valid.");
  }

  return result;
}

function parseEmployeeImportCommit(
  value: Json
): EmployeeImportCommitResult {
  const result = value as unknown as EmployeeImportCommitResult;

  if (
    !result ||
    typeof result.job_id !== "string" ||
    typeof result.dry_run_job_id !== "string" ||
    typeof result.imported_rows !== "number"
  ) {
    throw new Error("Respons commit impor dari server tidak valid.");
  }

  return result;
}

export async function dryRunEmployeeImport(
  client: MasterDataClient,
  input: EmployeeImportDryRunInput
) {
  const { data, error } = await client.rpc("dry_run_employee_import", {
    p_source_file_name: input.sourceFileName,
    p_rows: input.rows as unknown as Json,
  });

  if (error) {
    throw toMasterDataError("Gagal memvalidasi file impor", error);
  }

  return parseEmployeeImportDryRun(data);
}

export async function commitEmployeeImport(
  client: MasterDataClient,
  input: EmployeeImportCommitInput
) {
  const { data, error } = await client.rpc("commit_employee_import", {
    p_dry_run_job_id: input.dryRunJobId,
    p_rows: input.rows as unknown as Json,
    p_reason: input.reason,
  });

  if (error) {
    throw toMasterDataError("Gagal mengimpor data karyawan", error);
  }

  return parseEmployeeImportCommit(data);
}

export type LiveEmployee = Awaited<
  ReturnType<typeof listActiveEmployees>
>[number];
export type LiveOutlet = Awaited<ReturnType<typeof listActiveOutlets>>[number];
export type LiveJobPosition = Awaited<
  ReturnType<typeof listActiveJobPositions>
>[number];
export type LiveEmploymentStatus = Awaited<
  ReturnType<typeof listActiveEmploymentStatuses>
>[number];
export type LivePolicyVersion = Awaited<
  ReturnType<typeof listCurrentPolicies>
>[number];
export type LiveShiftTemplate = Awaited<
  ReturnType<typeof listActiveShiftTemplates>
>[number];
