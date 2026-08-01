/**
 * Query key factory tunggal untuk data master agar invalidation konsisten.
 */
export const masterDataKeys = {
  all: ["master-data"] as const,
  currentRole: () => [...masterDataKeys.all, "current-role"] as const,
  employees: () => [...masterDataKeys.all, "employees"] as const,
  outletRoot: () => [...masterDataKeys.all, "outlets"] as const,
  outlets: (includeInactive = false) =>
    [...masterDataKeys.outletRoot(), { includeInactive }] as const,
  jobPositions: () => [...masterDataKeys.all, "job-positions"] as const,
  employmentStatuses: () =>
    [...masterDataKeys.all, "employment-statuses"] as const,
  policies: () => [...masterDataKeys.all, "policies"] as const,
  shiftTemplates: () => [...masterDataKeys.all, "shift-templates"] as const,
  staffingRequirements: () =>
    [...masterDataKeys.all, "staffing-requirements"] as const,
};
