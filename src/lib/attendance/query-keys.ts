export const attendanceKeys = {
  all: ["attendance"] as const,
  workspace: () => [...attendanceKeys.all, "workspace"] as const,
  validations: () => [...attendanceKeys.all, "validations"] as const,
  retentionHealth: () => [...attendanceKeys.all, "retention-health"] as const,
};
