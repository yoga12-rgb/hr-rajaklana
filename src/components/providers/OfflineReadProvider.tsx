"use client";

import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import type { DataSourceConfig } from "@/lib/data-source";
import {
  isOfflineRosterQuery,
  sanitizeRosterForOffline,
} from "@/lib/offline/roster-cache";
import type { MonthlyRoster } from "@/lib/roster/repository";
import { createClient } from "@/lib/supabase/client";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const OWNER_KEY = "hr-rajaklana-offline-owner-v1";

interface StoredRosterCache {
  version: number;
  owner: string;
  savedAt: number;
  queries: Array<{
    queryKey: readonly unknown[];
    updatedAt: number;
    data: MonthlyRoster;
  }>;
}

function cacheKey(userId: string) {
  return `hr-rajaklana-roster-cache-v1:${userId}`;
}

/**
 * Menyimpan maksimal tiga snapshot roster yang sudah disanitasi per pengguna.
 * Bukti, dokumen, notifikasi, alasan perubahan, dan signed URL tidak disimpan.
 */
export function OfflineReadProvider({
  children,
  queryClient,
  dataSource,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
  dataSource: DataSourceConfig;
}) {
  // Selalu mulai dengan true di server; di-sync ulang setelah mount agar
  // tidak terjadi hydration mismatch yang menyebabkan banner Offline palsu.
  const [isOnline, setIsOnline] = useState(true);
  const [hasCachedRoster, setHasCachedRoster] = useState(false);

  // Sinkronisasi status online segera setelah mount dan pasang listener
  // agar perubahan koneksi selalu ter-update, terlepas dari mode data.
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (dataSource.mode !== "supabase") return;

    let unsubscribe = () => {};
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        const userId = data.session?.user.id;
        if (!userId || disposed) return;

        const previousOwner = localStorage.getItem(OWNER_KEY);
        if (previousOwner && previousOwner !== userId) {
          localStorage.removeItem(cacheKey(previousOwner));
        }
        localStorage.setItem(OWNER_KEY, userId);

        try {
          const raw = localStorage.getItem(cacheKey(userId));
          const stored = raw ? (JSON.parse(raw) as StoredRosterCache) : null;
          if (
            stored?.version === CACHE_VERSION &&
            stored.owner === userId &&
            Date.now() - stored.savedAt <= CACHE_TTL_MS
          ) {
            for (const query of stored.queries) {
              const current = queryClient.getQueryState(query.queryKey);
              if (!current?.dataUpdatedAt || current.dataUpdatedAt < query.updatedAt) {
                queryClient.setQueryData(query.queryKey, query.data, {
                  updatedAt: query.updatedAt,
                });
              }
            }
            setHasCachedRoster(stored.queries.length > 0);
          } else if (raw) {
            localStorage.removeItem(cacheKey(userId));
          }
        } catch {
          localStorage.removeItem(cacheKey(userId));
        }

        const persist = () => {
          const queries = queryClient
            .getQueryCache()
            .getAll()
            .filter(
              (query) =>
                query.state.status === "success" &&
                isOfflineRosterQuery(query.queryKey)
            )
            .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
            .slice(0, 3)
            .flatMap((query) => {
              const sanitized = sanitizeRosterForOffline(query.state.data);
              return sanitized
                ? [
                    {
                      queryKey: query.queryKey,
                      updatedAt: query.state.dataUpdatedAt,
                      data: sanitized,
                    },
                  ]
                : [];
            });
          try {
            localStorage.setItem(
              cacheKey(userId),
              JSON.stringify({
                version: CACHE_VERSION,
                owner: userId,
                savedAt: Date.now(),
                queries,
              } satisfies StoredRosterCache)
            );
            setHasCachedRoster(queries.length > 0);
          } catch {
            localStorage.removeItem(cacheKey(userId));
            setHasCachedRoster(false);
          }
        };

        unsubscribe = queryClient.getQueryCache().subscribe(() => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(persist, 250);
        });
        persist();
      });

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          registration.active?.postMessage({
            type: "CACHE_ROUTES",
            routes: ["/", "/schedule"],
          });
        });
    }

    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      unsubscribe();
    };
  }, [dataSource.mode, queryClient]);

  return (
    <>
      {dataSource.mode === "supabase" && !isOnline && (
        <div
          role="status"
          className="fixed inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-2 text-[10px] font-semibold text-amber-200 shadow-xl backdrop-blur-xl"
        >
          <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
          {hasCachedRoster
            ? "Offline · jadwal terakhir berasal dari cache; semua perubahan dinonaktifkan."
            : "Offline · jadwal yang belum pernah dibuka tidak tersedia."}
        </div>
      )}
      {children}
    </>
  );
}
