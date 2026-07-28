"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { attendanceKeys } from "./query-keys";
import { runAttendanceRetentionAfterDecision } from "./actions";
import {
  clockInAttendance,
  clockOutAttendance,
  createAttendanceSelfieSignedUrl,
  decideAttendanceValidation,
  getAttendanceRetentionHealth,
  getAttendanceWorkspace,
  listPendingAttendanceValidations,
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

export function usePendingAttendanceValidations(enabled: boolean) {
  return useQuery({
    queryKey: attendanceKeys.validations(),
    queryFn: () => listPendingAttendanceValidations(createClient()),
    enabled,
  });
}

export function useAttendanceRetentionHealth(enabled: boolean) {
  return useQuery({
    queryKey: attendanceKeys.retentionHealth(),
    queryFn: () => getAttendanceRetentionHealth(createClient()),
    enabled,
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

export function useDecideAttendanceValidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attendanceId: string;
      decision: "approved" | "rejected" | "needs_correction";
      note: string;
      expectedVersion: number;
    }) => {
      const result = await decideAttendanceValidation(createClient(), input);
      if (input.decision === "approved") {
        try {
          await runAttendanceRetentionAfterDecision();
        } catch {
          // Keputusan sudah atomik; cron akan mencoba ulang deletion job.
        }
      }
      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.workspace() }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.validations() }),
        queryClient.invalidateQueries({
          queryKey: attendanceKeys.retentionHealth(),
        }),
      ]);
    },
  });
}

export function useAttendanceSelfieUrl() {
  return useMutation({
    mutationFn: (path: string) =>
      createAttendanceSelfieSignedUrl(createClient(), path),
  });
}
