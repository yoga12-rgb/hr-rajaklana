"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { DataSourceProvider } from "@/context/DataSourceContext";
import { HRProvider } from "@/context/HRContext";
import type { DataSourceConfig } from "@/lib/data-source";
import { OfflineReadProvider } from "./OfflineReadProvider";

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
        mutationCache: new MutationCache({
          onMutate: () => {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              throw new Error(
                "Anda sedang offline. Hubungkan perangkat sebelum menyimpan perubahan."
              );
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
            networkMode: "always",
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineReadProvider queryClient={queryClient} dataSource={dataSource}>
        <DataSourceProvider value={dataSource}>
          <HRProvider>{children}</HRProvider>
        </DataSourceProvider>
      </OfflineReadProvider>
    </QueryClientProvider>
  );
}
