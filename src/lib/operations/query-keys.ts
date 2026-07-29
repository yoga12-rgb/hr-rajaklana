export const operationalHealthKeys = {
  all: ["operational-health"] as const,
  workspace: () => [...operationalHealthKeys.all, "workspace"] as const,
};
