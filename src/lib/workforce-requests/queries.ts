"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { communicationKeys } from "@/lib/communications/query-keys";
import { rosterKeys } from "@/lib/roster/query-keys";
import { createClient } from "@/lib/supabase/client";
import { workforceRequestKeys } from "./query-keys";
import {
  amendPendingLeaveRequest,
  cancelLeaveChangeRequest,
  cancelLeaveRequest,
  cancelOvertimeRequest,
  decideLeaveChangeRequest,
  decideLeaveRequest,
  decideOvertimeRequest,
  getLeaveWorkspace,
  getOvertimeWorkspace,
  refreshOvertimeActual,
  saveLeaveType,
  submitLeaveChangeRequest,
  submitLeaveRequest,
  submitOrAssignOvertime,
  type AmendPendingLeaveInput,
  type LiveLeaveChangeRequest,
  type LiveLeaveRequest,
  type SaveLeaveTypeInput,
  type LeaveWorkspace,
  type SubmitLeaveChangeInput,
  type SubmitLeaveInput,
  type SubmitOvertimeInput,
  type OvertimeWorkspace,
} from "./repository";
import { projectApprovedLeaveChange } from "./leave-balance";

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
                    can_amend: false,
                    can_cancel: false,
                    can_request_change: false,
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
    onSettled: () => invalidateLeaveEffects(queryClient),
  });
}

function inclusiveDays(startsOn: string, endsOn: string) {
  return (
    Math.floor(
      (new Date(`${endsOn}T12:00:00`).getTime() -
        new Date(`${startsOn}T12:00:00`).getTime()) /
        86_400_000
    ) + 1
  );
}

function invalidateLeaveEffects(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: workforceRequestKeys.leave() }),
    queryClient.invalidateQueries({ queryKey: rosterKeys.all }),
    queryClient.invalidateQueries({ queryKey: communicationKeys.all }),
  ]);
}

type AmendPendingLeaveMutationInput = AmendPendingLeaveInput & {
  request: LiveLeaveRequest;
};

export function useAmendPendingLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AmendPendingLeaveMutationInput) =>
      amendPendingLeaveRequest(createClient(), input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.leave(),
      });
      const previous = queryClient.getQueryData<LeaveWorkspace>(
        workforceRequestKeys.leave()
      );
      if (previous) {
        const proposedDays = inclusiveDays(input.startsOn, input.endsOn);
        const leaveType = previous.leave_types.find(
          (item) => item.id === input.request.leave_type_id
        );
        const sameYear =
          input.request.starts_on.slice(0, 4) === input.startsOn.slice(0, 4);
        const delta = proposedDays - input.request.requested_days;

        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            requests: previous.requests.map((item) =>
              item.id === input.request.id
                ? {
                    ...item,
                    starts_on: input.startsOn,
                    ends_on: input.endsOn,
                    requested_days: proposedDays,
                    request_version: item.request_version + 1,
                  }
                : item
            ),
            balances:
              leaveType?.deducts_annual_balance && sameYear
                ? previous.balances.map((balance) =>
                    balance.employee_id === input.request.employee_id &&
                    balance.leave_type_id === input.request.leave_type_id &&
                    balance.year === Number(input.request.starts_on.slice(0, 4))
                      ? {
                          ...balance,
                          reserved_days: Math.max(
                            0,
                            balance.reserved_days + delta
                          ),
                          available_days: balance.available_days - delta,
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
    onSettled: () => invalidateLeaveEffects(queryClient),
  });
}

type SubmitLeaveChangeMutationInput = SubmitLeaveChangeInput & {
  request: LiveLeaveRequest;
};

export function useSubmitLeaveChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitLeaveChangeMutationInput) =>
      submitLeaveChangeRequest(createClient(), input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: workforceRequestKeys.leave(),
      });
      const previous = queryClient.getQueryData<LeaveWorkspace>(
        workforceRequestKeys.leave()
      );
      if (previous) {
        const leaveType = previous.leave_types.find(
          (item) => item.id === input.request.leave_type_id
        );
        const proposedDays =
          input.changeType === "reschedule" &&
          input.proposedStartsOn &&
          input.proposedEndsOn
            ? inclusiveDays(input.proposedStartsOn, input.proposedEndsOn)
            : null;
        const reservedDeltaDays =
          leaveType?.deducts_annual_balance && proposedDays != null
            ? Math.max(0, proposedDays - input.request.requested_days)
            : 0;
        const optimisticChange: LiveLeaveChangeRequest = {
          id: `optimistic:${input.request.id}`,
          leave_request_id: input.request.id,
          employee_id: input.request.employee_id,
          employee_name: input.request.employee_name,
          leave_type_id: input.request.leave_type_id,
          leave_type_name:
            leaveType?.name ?? input.request.leave_type_name,
          change_type: input.changeType,
          old_starts_on: input.request.starts_on,
          old_ends_on: input.request.ends_on,
          old_requested_days: input.request.requested_days,
          proposed_starts_on: input.proposedStartsOn ?? null,
          proposed_ends_on: input.proposedEndsOn ?? null,
          proposed_days: proposedDays,
          reason: input.reason,
          status: "pending",
          request_version: 1,
          source_leave_version: input.sourceLeaveVersion,
          reserved_delta_days: reservedDeltaDays,
          reserved_year:
            reservedDeltaDays > 0
              ? Number(input.request.starts_on.slice(0, 4))
              : null,
          decision_note: null,
          created_at: new Date().toISOString(),
          decided_at: null,
          can_cancel: true,
          can_decide: false,
          is_stale: false,
        };
        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            change_requests: [
              optimisticChange,
              ...(previous.change_requests ?? []).filter(
                (item) =>
                  item.leave_request_id !== input.request.id ||
                  item.status !== "pending"
              ),
            ],
            balances:
              reservedDeltaDays > 0
                ? previous.balances.map((balance) =>
                    balance.employee_id === input.request.employee_id &&
                    balance.leave_type_id === input.request.leave_type_id &&
                    balance.year === Number(input.request.starts_on.slice(0, 4))
                      ? {
                          ...balance,
                          available_days:
                            balance.available_days - reservedDeltaDays,
                          reserved_days:
                            balance.reserved_days + reservedDeltaDays,
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
    onSettled: () => invalidateLeaveEffects(queryClient),
  });
}

export function useCancelLeaveChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      changeRequest: LiveLeaveChangeRequest;
      reason: string;
    }) =>
      cancelLeaveChangeRequest(
        createClient(),
        input.changeRequest.id,
        input.changeRequest.request_version,
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
        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            change_requests: (previous.change_requests ?? []).map((item) =>
              item.id === input.changeRequest.id
                ? {
                    ...item,
                    status: "cancelled",
                    request_version: item.request_version + 1,
                    decision_note: input.reason,
                    can_cancel: false,
                    can_decide: false,
                  }
                : item
            ),
            balances:
              input.changeRequest.reserved_delta_days > 0
                ? previous.balances.map((balance) =>
                    balance.employee_id === input.changeRequest.employee_id &&
                    balance.leave_type_id ===
                      input.changeRequest.leave_type_id &&
                    balance.year === input.changeRequest.reserved_year
                      ? {
                          ...balance,
                          available_days:
                            balance.available_days +
                            input.changeRequest.reserved_delta_days,
                          reserved_days: Math.max(
                            0,
                            balance.reserved_days -
                              input.changeRequest.reserved_delta_days
                          ),
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
    onSettled: () => invalidateLeaveEffects(queryClient),
  });
}

export function useDecideLeaveChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      changeRequest: LiveLeaveChangeRequest;
      decision: "approved" | "rejected";
      note: string;
    }) =>
      decideLeaveChangeRequest(
        createClient(),
        input.changeRequest.id,
        input.changeRequest.request_version,
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
        const change = input.changeRequest;
        const leaveType = previous.leave_types.find(
          (item) => item.id === change.leave_type_id
        );
        queryClient.setQueryData<LeaveWorkspace>(
          workforceRequestKeys.leave(),
          {
            ...previous,
            change_requests: (previous.change_requests ?? []).map((item) =>
              item.id === change.id
                ? {
                    ...item,
                    status: input.decision,
                    request_version: item.request_version + 1,
                    decision_note: input.note || null,
                    can_cancel: false,
                    can_decide: false,
                  }
                : item
            ),
            requests:
              input.decision === "approved"
                ? previous.requests.map((request) =>
                    request.id === change.leave_request_id
                      ? change.change_type === "cancel"
                        ? {
                            ...request,
                            status: "cancelled",
                            request_version: request.request_version + 1,
                            can_amend: false,
                            can_cancel: false,
                            can_request_change: false,
                          }
                        : {
                            ...request,
                            starts_on:
                              change.proposed_starts_on ?? request.starts_on,
                            ends_on: change.proposed_ends_on ?? request.ends_on,
                            requested_days:
                              change.proposed_days ?? request.requested_days,
                            request_version: request.request_version + 1,
                            can_amend: false,
                            can_cancel: false,
                          }
                      : request
                  )
                : previous.requests,
            balances:
              leaveType?.deducts_annual_balance
                ? previous.balances.map((balance) => {
                    if (
                      balance.employee_id !== change.employee_id ||
                      balance.leave_type_id !== change.leave_type_id ||
                      balance.year !==
                        (change.reserved_year ??
                          Number(change.old_starts_on.slice(0, 4)))
                    ) {
                      return balance;
                    }
                    if (input.decision === "rejected") {
                      return {
                        ...balance,
                        available_days:
                          balance.available_days + change.reserved_delta_days,
                        reserved_days: Math.max(
                          0,
                          balance.reserved_days - change.reserved_delta_days
                        ),
                      };
                    }
                    const projection = projectApprovedLeaveChange(
                      balance,
                      change.old_requested_days,
                      change.change_type,
                      change.proposed_days ?? 0,
                      change.reserved_delta_days
                    );
                    return {
                      ...balance,
                      available_days: projection.availableAfter,
                      reserved_days: projection.reservedAfter,
                      used_days: projection.usedAfter,
                    };
                  })
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
    onSettled: () => invalidateLeaveEffects(queryClient),
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
