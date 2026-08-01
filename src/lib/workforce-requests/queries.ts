"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { communicationKeys } from "@/lib/communications/query-keys";
import { rosterKeys } from "@/lib/roster/query-keys";
import { createClient } from "@/lib/supabase/client";
import { workforceRequestKeys } from "./query-keys";
import {
  cancelLeaveRequest,
  cancelOvertimeRequest,
  decideLeaveRequest,
  decideOvertimeRequest,
  getLeaveWorkspace,
  getOvertimeWorkspace,
  refreshOvertimeActual,
  saveLeaveType,
  submitLeaveRequest,
  submitOrAssignOvertime,
  type SaveLeaveTypeInput,
  type LeaveWorkspace,
  type SubmitLeaveInput,
  type SubmitOvertimeInput,
  type OvertimeWorkspace,
} from "./repository";

export function useLeaveWorkspace() {
  return useQuery({
    queryKey: workforceRequestKeys.leave(),
    queryFn: () => getLeaveWorkspace(createClient()),
  });
}

function useInvalidateLeaveMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: workforceRequestKeys.leave(),
      }),
  });
}

export function useSaveLeaveType() {
  return useInvalidateLeaveMutation((input: SaveLeaveTypeInput) =>
    saveLeaveType(createClient(), input)
  );
}

export function useSubmitLeaveRequest() {
  return useInvalidateLeaveMutation((input: SubmitLeaveInput) =>
    submitLeaveRequest(createClient(), input)
  );
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: { requestId: string; expectedVersion: number; reason: string }
    ) =>
      cancelLeaveRequest(
        createClient(),
        input.requestId,
        input.expectedVersion,
        input.reason
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.leave(),
      });
      const previous = queryClient.getQueryData<LeaveWorkspace>(
        workforceRequestKeys.leave()
      );
      if (previous) {
        const request = previous.requests.find(
          (item) => item.id === input.requestId
        );
        const leaveType = previous.leave_types.find(
          (item) => item.id === request?.leave_type_id
        );
        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            requests: previous.requests.map((item) =>
              item.id === input.requestId
                ? {
                    ...item,
                    status: "cancelled",
                    request_version: item.request_version + 1,
                    decision_note: input.reason,
                  }
                : item
            ),
            balances:
              request && leaveType?.deducts_annual_balance
                ? previous.balances.map((balance) =>
                    balance.employee_id === request.employee_id &&
                    balance.leave_type_id === request.leave_type_id &&
                    balance.year === Number(request.starts_on.slice(0, 4))
                      ? {
                          ...balance,
                          reserved_days: Math.max(
                            0,
                            balance.reserved_days - request.requested_days
                          ),
                          available_days:
                            balance.available_days + request.requested_days,
                        }
                      : balance
                  )
                : previous.balances,
          }
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          workforceRequestKeys.leave(),
          context.previous
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: workforceRequestKeys.leave(),
      }),
  });
}

export function useDecideLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      expectedVersion: number;
      decision: "approved" | "rejected";
      note: string;
    }) =>
      decideLeaveRequest(
        createClient(),
        input.requestId,
        input.expectedVersion,
        input.decision,
        input.note
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.leave(),
      });
      const previous = queryClient.getQueryData<LeaveWorkspace>(
        workforceRequestKeys.leave()
      );
      if (previous) {
        const request = previous.requests.find(
          (item) => item.id === input.requestId
        );
        const leaveType = previous.leave_types.find(
          (item) => item.id === request?.leave_type_id
        );
        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            requests: previous.requests.map((item) =>
              item.id === input.requestId
                ? {
                    ...item,
                    status: input.decision,
                    request_version: item.request_version + 1,
                    decision_note: input.note || null,
                    can_decide: false,
                  }
                : item
            ),
            balances:
              request && leaveType?.deducts_annual_balance
                ? previous.balances.map((balance) =>
                    balance.employee_id === request.employee_id &&
                    balance.leave_type_id === request.leave_type_id &&
                    balance.year === Number(request.starts_on.slice(0, 4))
                      ? {
                          ...balance,
                          reserved_days: Math.max(
                            0,
                            balance.reserved_days - request.requested_days
                          ),
                          used_days:
                            balance.used_days +
                            (input.decision === "approved"
                              ? request.requested_days
                              : 0),
                          available_days:
                            balance.available_days +
                            (input.decision === "rejected"
                              ? request.requested_days
                              : 0),
                        }
                      : balance
                  )
                : previous.balances,
          }
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          workforceRequestKeys.leave(),
          context.previous
        );
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: workforceRequestKeys.leave(),
        }),
        queryClient.invalidateQueries({ queryKey: rosterKeys.all }),
        queryClient.invalidateQueries({ queryKey: communicationKeys.all }),
      ]),
  });
}

export function useOvertimeWorkspace() {
  return useQuery({
    queryKey: workforceRequestKeys.overtime(),
    queryFn: () => getOvertimeWorkspace(createClient()),
  });
}

function useInvalidateOvertimeMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: workforceRequestKeys.overtime(),
      }),
  });
}

export function useSubmitOrAssignOvertime() {
  return useInvalidateOvertimeMutation((input: SubmitOvertimeInput) =>
    submitOrAssignOvertime(createClient(), input)
  );
}

export function useCancelOvertimeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: { requestId: string; expectedVersion: number; reason: string }
    ) =>
      cancelOvertimeRequest(
        createClient(),
        input.requestId,
        input.expectedVersion,
        input.reason
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.overtime(),
      });
      const previous = queryClient.getQueryData<OvertimeWorkspace>(
        workforceRequestKeys.overtime()
      );
      if (previous) {
        queryClient.setQueryData<OvertimeWorkspace>(
          workforceRequestKeys.overtime(),
          {
            ...previous,
            requests: previous.requests.map((request) =>
              request.id === input.requestId
                ? {
                    ...request,
                    status: "cancelled",
                    request_version: request.request_version + 1,
                    decision_note: input.reason,
                  }
                : request
            ),
          }
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          workforceRequestKeys.overtime(),
          context.previous
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: workforceRequestKeys.overtime(),
      }),
  });
}

export function useRefreshOvertimeActual() {
  return useInvalidateOvertimeMutation((requestId: string) =>
    refreshOvertimeActual(createClient(), requestId)
  );
}

export function useDecideOvertimeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      expectedVersion: number;
      decision: "approved" | "rejected";
      approvedMinutes: number;
      note: string;
    }) =>
      decideOvertimeRequest(
        createClient(),
        input.requestId,
        input.expectedVersion,
        input.decision,
        input.approvedMinutes,
        input.note
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.overtime(),
      });
      const previous = queryClient.getQueryData<OvertimeWorkspace>(
        workforceRequestKeys.overtime()
      );
      if (previous) {
        queryClient.setQueryData<OvertimeWorkspace>(
          workforceRequestKeys.overtime(),
          {
            ...previous,
            requests: previous.requests.map((request) =>
              request.id === input.requestId
                ? {
                    ...request,
                    status: input.decision,
                    request_version: request.request_version + 1,
                    decision_note: input.note || null,
                    approved_duration_min:
                      input.decision === "approved"
                        ? input.approvedMinutes
                        : 0,
                    can_decide: false,
                  }
                : request
            ),
          }
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          workforceRequestKeys.overtime(),
          context.previous
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: workforceRequestKeys.overtime(),
      }),
  });
}
