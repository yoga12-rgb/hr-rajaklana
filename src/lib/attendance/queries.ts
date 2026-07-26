"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { attendanceKeys } from "./query-keys";
import {
  clockInAttendance,
  clockOutAttendance,
  getAttendanceWorkspace,
  previewAttendanceGeofence,
  type ClockInInput,
  type DeviceLocation,
} from "./repository";

export function useAttendanceWorkspace() {
  return useQuery({
    queryKey: attendanceKeys.workspace(),
    queryFn: () => getAttendanceWorkspace(createClient()),
  });
}

export function useAttendanceGeofencePreview() {
  return useMutation({
    mutationFn: (input: { outletId: string; location: DeviceLocation }) =>
      previewAttendanceGeofence(
        createClient(),
        input.outletId,
        input.location
      ),
  });
}

function useRefreshAttendanceMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: attendanceKeys.workspace() }),
  });
}

export function useClockInAttendance() {
  return useRefreshAttendanceMutation((input: ClockInInput) =>
    clockInAttendance(createClient(), input)
  );
}

export function useClockOutAttendance() {
  return useRefreshAttendanceMutation(
    (input: { attendanceId: string; location: DeviceLocation }) =>
      clockOutAttendance(createClient(), input.attendanceId, input.location)
  );
}
