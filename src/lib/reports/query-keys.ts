export interface ReportFilters {
  periodStart: string;
  periodEnd: string;
  outletId: string;
  employeeId: string;
}

export const reportKeys = {
  all: ["reports"] as const,
  workspace: (filters: ReportFilters) =>
    [...reportKeys.all, "workspace", filters] as const,
  exports: () => [...reportKeys.all, "exports"] as const,
};
