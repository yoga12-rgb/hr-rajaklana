"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createReportExportDownloadUrl,
  getReportExportJobs,
  getReportWorkspace,
  requestReportExport,
  retryReportExport,
  type ReportExportJob,
} from "./repository";
import { reportKeys, type ReportFilters } from "./query-keys";

export function useReportWorkspace(filters: ReportFilters) {
  return useQuery({
    queryKey: reportKeys.workspace(filters),
    queryFn: () => getReportWorkspace(createClient(), filters),
    placeholderData: (previous) => previous,
  });
}

export function useReportExportJobs() {
  return useQuery({
    queryKey: reportKeys.exports(),
    queryFn: () => getReportExportJobs(createClient()),
    refetchInterval: (query) =>
      query.state.data?.some((job) =>
        ["scheduled", "processing"].includes(job.status)
      )
        ? 3_000
        : false,
  });
}

export function useRequestReportExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestReportExport,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reportKeys.exports() }),
  });
}

export function useRetryReportExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryReportExport,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reportKeys.exports() }),
  });
}

export function useReportExportDownload() {
  return useMutation({
    mutationFn: (job: ReportExportJob) =>
      createReportExportDownloadUrl(createClient(), job),
    onSuccess: (signedUrl) => {
      window.location.assign(signedUrl);
    },
  });
}
