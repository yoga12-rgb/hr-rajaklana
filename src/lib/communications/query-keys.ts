export const communicationKeys = {
  all: ["communications"] as const,
  workspace: () => [...communicationKeys.all, "workspace"] as const,
};
