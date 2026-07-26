"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { rosterKeys } from "./query-keys";
import {
  acknowledgeMonthlyRoster,
  decideShiftSwapColleague,
  decideShiftSwapSupervisor,
  getMonthlyRoster,
  getShiftSwapOptions,
  publishManualRoster,
  requestShiftSwap,
  saveManualRosterAssignment,
  type SaveRosterAssignmentInput,
} from "./repository";

export function useMonthlyRoster(monthStart: string, enabled = true) {
  return useQuery({
    queryKey: rosterKeys.month(monthStart),
    queryFn: () => getMonthlyRoster(createClient(), monthStart),
    enabled: enabled && Boolean(monthStart),
  });
}

export function useSaveManualRosterAssignment(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveRosterAssignmentInput) =>
      saveManualRosterAssignment(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}

export function usePublishManualRoster(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rosterVersionId,
      reason,
    }: {
      rosterVersionId: string;
      reason: string;
    }) => publishManualRoster(createClient(), rosterVersionId, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}

export function useAcknowledgeMonthlyRoster(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => acknowledgeMonthlyRoster(createClient(), monthStart),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}

export function useShiftSwapOptions(scheduleId: string, enabled = true) {
  return useQuery({
    queryKey: rosterKeys.swapOptions(scheduleId),
    queryFn: () => getShiftSwapOptions(createClient(), scheduleId),
    enabled: enabled && Boolean(scheduleId),
  });
}

export function useRequestShiftSwap(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requesterScheduleId,
      colleagueScheduleId,
      reason,
    }: {
      requesterScheduleId: string;
      colleagueScheduleId: string;
      reason: string;
    }) =>
      requestShiftSwap(
        createClient(),
        requesterScheduleId,
        colleagueScheduleId,
        reason
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}

export function useDecideShiftSwapColleague(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      decision,
      note,
    }: {
      requestId: string;
      decision: "accept" | "reject";
      note: string;
    }) =>
      decideShiftSwapColleague(createClient(), requestId, decision, note),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}

export function useDecideShiftSwapSupervisor(monthStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      decision,
      note,
    }: {
      requestId: string;
      decision: "approve" | "reject";
      note: string;
    }) =>
      decideShiftSwapSupervisor(createClient(), requestId, decision, note),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rosterKeys.month(monthStart) }),
  });
}
