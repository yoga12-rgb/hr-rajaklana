import "server-only";

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  generateDeterministicRoster,
  type OptimizerEmployee,
  type OptimizerOutlet,
  type OptimizerShift,
  type RosterOptimizerInput,
} from "./optimizer";

type RosterServerClient = SupabaseClient<Database>;

const SHIFT_VALUES = new Set<OptimizerShift>([
  "morning",
  "middle",
  "night",
]);

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} dari database tidak valid.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} dari database tidak valid.`);
  }
  return value;
}

function asString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} dari database tidak valid.`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function asInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} dari database tidak valid.`);
  }
  return value;
}

function asShift(value: unknown) {
  const shift = asString(value, "Jenis shift") as OptimizerShift;
  if (!SHIFT_VALUES.has(shift)) {
    throw new Error("Jenis shift dari database tidak didukung optimizer.");
  }
  return shift;
}

function parseEmployee(value: unknown): OptimizerEmployee {
  const employee = asRecord(value, "Karyawan");
  return {
    id: asString(employee.id, "ID karyawan"),
    name: asString(employee.name, "Nama karyawan"),
    primaryOutletId: asString(
      employee.primaryOutletId,
      "Outlet utama karyawan"
    ),
    activeFrom: optionalString(employee.activeFrom),
    activeUntil: optionalString(employee.activeUntil),
    placements: asArray(employee.placements ?? [], "Riwayat penempatan").map(
      (item) => {
        const placement = asRecord(item, "Penempatan");
        return {
          outletId: asString(placement.outletId, "Outlet penempatan"),
          startDate: asString(placement.startDate, "Awal penempatan"),
          endDate: optionalString(placement.endDate),
        };
      }
    ),
    offDays: asArray(employee.offDays ?? [], "Off day").map((item) => {
      const offDay = asRecord(item, "Off day");
      return {
        date: asString(offDay.date, "Tanggal off"),
        sourceWeekStart: optionalString(offDay.sourceWeekStart),
      };
    }),
    leaveDates: asArray(employee.leaveDates ?? [], "Tanggal cuti").map((date) =>
      asString(date, "Tanggal cuti")
    ),
    lockedAssignments: asArray(
      employee.lockedAssignments ?? [],
      "Shift terkunci"
    ).map((item) => {
      const assignment = asRecord(item, "Shift terkunci");
      return {
        date: asString(assignment.date, "Tanggal shift terkunci"),
        outletId: asString(assignment.outletId, "Outlet shift terkunci"),
        shift: asShift(assignment.shift),
        isBackup: assignment.isBackup === true,
        backupReason: optionalString(assignment.backupReason),
      };
    }),
  };
}

function parseOutlet(value: unknown): OptimizerOutlet {
  const outlet = asRecord(value, "Outlet");
  return {
    id: asString(outlet.id, "ID outlet"),
    name: asString(outlet.name, "Nama outlet"),
    availableShifts: asArray(
      outlet.availableShifts ?? [],
      "Template shift"
    ).map(asShift),
    staffingRequirements: asArray(
      outlet.staffingRequirements ?? [],
      "Kebutuhan staf"
    ).map((item) => {
      const requirement = asRecord(item, "Kebutuhan staf");
      return {
        cashierCount: asInteger(
          requirement.cashierCount,
          "Jumlah kasir kebutuhan staf"
        ),
        shift: asShift(requirement.shift),
        minimumStaff: asInteger(
          requirement.minimumStaff,
          "Minimum kebutuhan staf"
        ),
        effectiveFrom: optionalString(requirement.effectiveFrom),
        effectiveUntil: optionalString(requirement.effectiveUntil),
      };
    }),
  };
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * Mengambil snapshot input role-aware, menjalankan optimizer hanya di server,
 * lalu menyimpan generation run melalui satu transaksi RPC yang idempoten.
 */
export async function generateAndPersistRoster(
  client: RosterServerClient,
  monthStart: string,
  seed: string
) {
  const { data, error } = await client.rpc("get_roster_generation_input", {
    p_month_start: monthStart,
  });
  if (error) {
    throw new Error(`Input roster otomatis belum dapat dimuat: ${error.message}`);
  }

  const snapshot = asRecord(data, "Snapshot roster");
  const input: RosterOptimizerInput = {
    monthStart: asString(snapshot.monthStart, "Bulan roster"),
    seed,
    employees: asArray(snapshot.employees, "Daftar karyawan").map(
      parseEmployee
    ),
    outlets: asArray(snapshot.outlets, "Daftar outlet").map(parseOutlet),
  };
  const policyVersion = snapshot.policyVersion ?? null;
  const startedAt = performance.now();
  const result = generateDeterministicRoster(input);
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  const ruleSnapshot = {
    ...result.ruleSnapshot,
    policyVersion,
    input,
    fairnessScore: result.fairnessScore,
  };
  const idempotencyKey = createHash("sha256")
    .update(
      JSON.stringify({
        algorithmVersion: result.algorithmVersion,
        ruleSnapshot,
      })
    )
    .digest("hex");

  const { data: commitData, error: commitError } = await client.rpc(
    "commit_generated_roster",
    {
      p_month_start: monthStart,
      p_idempotency_key: idempotencyKey,
      p_algorithm_version: result.algorithmVersion,
      p_rule_snapshot: jsonValue(ruleSnapshot),
      p_result_status: result.status,
      p_assignments: jsonValue(result.assignments),
      p_conflicts: jsonValue(result.conflicts),
      p_fairness_details: jsonValue(result.fairnessDetails),
    }
  );
  if (commitError) {
    throw new Error(
      `Hasil roster otomatis belum dapat disimpan: ${commitError.message}`
    );
  }

  return {
    persistence: asRecord(commitData, "Hasil commit roster"),
    resultStatus: result.status,
    algorithmVersion: result.algorithmVersion,
    assignmentCount: result.assignments.length,
    conflicts: result.conflicts,
    fairnessScore: result.fairnessScore,
    fairnessDetails: result.fairnessDetails,
    elapsedMs,
  };
}
