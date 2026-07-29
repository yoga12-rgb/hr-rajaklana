"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getReportWorkspace } from "./repository";
import { reportKeys, type ReportFilters } from "./query-keys";

export function useReportWorkspace(filters: ReportFilters) {
  return useQuery({
    queryKey: reportKeys.workspace(filters),
    queryFn: () => getReportWorkspace(createClient(), filters),
    placeholderData: (previous) => previous,
  });
}
