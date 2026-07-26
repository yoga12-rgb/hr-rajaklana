"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DataSourceProvider } from "@/context/DataSourceContext";
import { HRProvider } from "@/context/HRContext";
import type { DataSourceConfig } from "@/lib/data-source";

/**
 * Menggabungkan provider global aplikasi. QueryClient dibuat satu kali per
 * sesi browser agar cache tidak terbuat ulang ketika React merender ulang.
 */
export function AppProviders({
  children,
  dataSource,
}: {
  children: React.ReactNode;
  dataSource: DataSourceConfig;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider value={dataSource}>
        <HRProvider>{children}</HRProvider>
      </DataSourceProvider>
    </QueryClientProvider>
  );
}
