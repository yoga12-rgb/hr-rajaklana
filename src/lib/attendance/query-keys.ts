export const attendanceKeys = {
  all: ["attendance"] as const,
  workspace: () => [...attendanceKeys.all, "workspace"] as const,
};
