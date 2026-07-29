import type { MonthlyRoster } from "@/lib/roster/repository";

/** Menghapus data roster yang tidak diperlukan untuk pembacaan jadwal offline. */
export function sanitizeRosterForOffline(value: unknown): MonthlyRoster | null {
  if (!value || typeof value !== "object") return null;
  const roster = value as MonthlyRoster;
  if (!Array.isArray(roster.assignments) || !Array.isArray(roster.employees)) {
    return null;
  }

  return {
    period: roster.period,
    version: roster.version
      ? { ...roster.version, change_summary: null }
      : null,
    employees: roster.employees.map((employee) => ({
      ...employee,
      position: "",
    })),
    assignments: roster.assignments.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employee_id,
      employee_name: assignment.employee_name,
      outlet_id: assignment.outlet_id,
      outlet_name: assignment.outlet_name,
      work_date: assignment.work_date,
      shift_type: assignment.shift_type,
      planned_start: assignment.planned_start,
      planned_end: assignment.planned_end,
      status: assignment.status,
      assignment_type: assignment.assignment_type,
      is_own: assignment.is_own,
      acknowledged: assignment.acknowledged,
    })),
    off_days: [],
    swap_requests: [],
  };
}

export function isOfflineRosterQuery(queryKey: readonly unknown[]) {
  return queryKey[0] === "roster" && queryKey[1] === "month";
}
