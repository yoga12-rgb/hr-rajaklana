export const rosterKeys = {
  all: ["roster"] as const,
  month: (monthStart: string) =>
    [...rosterKeys.all, "month", monthStart] as const,
  swapOptions: (scheduleId: string) =>
    [...rosterKeys.all, "swap-options", scheduleId] as const,
};
