export const workforceRequestKeys = {
  all: ["workforce-requests"] as const,
  leave: () => [...workforceRequestKeys.all, "leave"] as const,
  overtime: () => [...workforceRequestKeys.all, "overtime"] as const,
};
