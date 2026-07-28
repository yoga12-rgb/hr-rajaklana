"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createUserAccount,
  resetUserPassword,
} from "@/lib/auth/actions";
import type { CreateAccountInput } from "@/lib/auth/actions";
import { masterDataKeys } from "./query-keys";
import {
  listActiveEmployees,
  listActiveEmploymentStatuses,
  listActiveJobPositions,
  listActiveOutlets,
  archiveEmployeeMaster,
  createEmployeeMaster,
  getCurrentAccessRole,
  updateEmployeeMaster,
  createOutletMaster,
  setOutletActive,
  updateOutletMaster,
  listCurrentPolicies,
  listActiveShiftTemplates,
  publishPolicyVersion,
  publishWorkPolicy,
  replaceOutletShiftTemplate,
  dryRunEmployeeImport,
  commitEmployeeImport,
} from "./repository";
import type {
  EmployeeImportCommitInput,
  EmployeeImportDryRunInput,
  EmployeeMasterInput,
  OutletMasterInput,
  PolicyVersionInput,
  ShiftTemplateInput,
  WorkPolicyInput,
  UpdateEmployeeMasterInput,
  UpdateOutletMasterInput,
} from "./repository";

export function useCurrentAccessRole(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.currentRole(),
    queryFn: () => getCurrentAccessRole(createClient()),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useLiveEmployees(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.employees(),
    queryFn: () => listActiveEmployees(createClient()),
    enabled,
  });
}

export function useLiveOutlets(enabled = true, includeInactive = false) {
  return useQuery({
    queryKey: masterDataKeys.outlets(includeInactive),
    queryFn: () => listActiveOutlets(createClient(), includeInactive),
    enabled,
  });
}

export function useLiveJobPositions(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.jobPositions(),
    queryFn: () => listActiveJobPositions(createClient()),
    enabled,
  });
}

export function useLiveEmploymentStatuses(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.employmentStatuses(),
    queryFn: () => listActiveEmploymentStatuses(createClient()),
    enabled,
  });
}

export function useCurrentPolicies(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.policies(),
    queryFn: () => listCurrentPolicies(createClient()),
    enabled,
  });
}

export function useActiveShiftTemplates(enabled = true) {
  return useQuery({
    queryKey: masterDataKeys.shiftTemplates(),
    queryFn: () => listActiveShiftTemplates(createClient()),
    enabled,
  });
}

export function useCreateEmployeeMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EmployeeMasterInput) =>
      createEmployeeMaster(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}

export function useUpdateEmployeeMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEmployeeMasterInput) =>
      updateEmployeeMaster(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}

export function useArchiveEmployeeMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      reason,
    }: {
      employeeId: string;
      reason: string;
    }) => archiveEmployeeMaster(createClient(), employeeId, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}

export function useCreateOutletMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OutletMasterInput) =>
      createOutletMaster(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.outletRoot() }),
  });
}

export function useUpdateOutletMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOutletMasterInput) =>
      updateOutletMaster(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.outletRoot() }),
  });
}

export function useSetOutletActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      outletId,
      isActive,
      reason,
    }: {
      outletId: string;
      isActive: boolean;
      reason: string;
    }) => setOutletActive(createClient(), outletId, isActive, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.outletRoot() }),
  });
}

export function usePublishPolicyVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PolicyVersionInput) =>
      publishPolicyVersion(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.policies() }),
  });
}

export function usePublishWorkPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WorkPolicyInput) =>
      publishWorkPolicy(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.policies() }),
  });
}

export function useReplaceOutletShiftTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ShiftTemplateInput) =>
      replaceOutletShiftTemplate(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: masterDataKeys.shiftTemplates(),
      }),
  });
}

export function useDryRunEmployeeImport() {
  return useMutation({
    mutationFn: (input: EmployeeImportDryRunInput) =>
      dryRunEmployeeImport(createClient(), input),
  });
}

export function useCommitEmployeeImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EmployeeImportCommitInput) =>
      commitEmployeeImport(createClient(), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}

export function useCreateUserAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => createUserAccount(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      resetUserPassword(userId, password),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: masterDataKeys.employees() }),
  });
}
