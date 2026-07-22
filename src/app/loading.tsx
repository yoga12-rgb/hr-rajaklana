import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton Loading untuk Dashboard (Halaman Utama).
 * Ditampilkan secara otomatis oleh Next.js App Router saat navigasi ke halaman ini.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>

      {/* List Items Skeleton */}
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
