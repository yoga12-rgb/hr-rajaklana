"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { operationalHealthKeys } from "./query-keys";
import { getOperationalHealthWorkspace } from "./repository";

export function useOperationalHealthWorkspace() {
  return useQuery({
    queryKey: operationalHealthKeys.workspace(),
    queryFn: () => getOperationalHealthWorkspace(createClient()),
    refetchInterval: 60_000,
  });
}
