"use client";

import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { useOperationalHealthWorkspace } from "@/lib/operations/queries";
import { playClickSound } from "@/utils/clickSound";

function formatTimestamp(value: string | null) {
  if (!value) return "Belum ada";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function readableAction(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Ringkasan observability M8 untuk supervisor dan management.
 *
 * Komponen hanya membaca RPC teragregasi. Timeline audit sengaja tidak
 * menerima actor ID, payload before/after, pesan error, atau path Storage.
 */
export function OperationalHealthPanel() {
  const health = useOperationalHealthWorkspace();

  if (health.isLoading) {
    return (
      <section className="space-y-3 print:hidden" aria-label="Kesehatan operasional">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (health.isError || !health.data) {
    return (
      <section
        role="alert"
        className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 print:hidden"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="text-xs font-bold text-rose-300">
              Status operasional belum dapat dimuat
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {health.error instanceof Error
                ? health.error.message
                : "Periksa koneksi lalu coba kembali."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            playClickSound();
            void health.refetch();
          }}
          className="shrink-0 rounded-lg border border-rose-500/30 px-2.5 py-2 text-[10px] font-bold text-rose-200"
        >
          Coba lagi
        </button>
      </section>
    );
  }

  const data = health.data;
  const retentionIssues =
    data.retention.retrying +
    data.retention.overdue +
    data.retention.stale_processing +
    data.retention.exhausted;
  const exportIssues =
    data.report_exports.stale_scheduled +
    data.report_exports.stale_processing +
    data.report_exports.retrying +
    data.report_exports.exhausted;
  const rosterIssues =
    data.roster_generation.stale + data.roster_generation.failed;
  const status =
    data.overall_status === "healthy"
      ? {
          label: "Operasional sehat",
          detail: "Tidak ada antrean bermasalah yang terdeteksi.",
          icon: CheckCircle2,
          className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        }
      : data.overall_status === "critical"
        ? {
            label: "Perlu tindakan segera",
            detail: `${data.issue_count} indikator memerlukan pemeriksaan.`,
            icon: XCircle,
            className: "border-rose-500/35 bg-rose-500/10 text-rose-200",
          }
        : {
            label: "Perlu perhatian",
            detail: `${data.issue_count} indikator perlu ditinjau.`,
            icon: AlertTriangle,
            className: "border-amber-500/35 bg-amber-500/10 text-amber-200",
          };
  const StatusIcon = status.icon;

  return (
    <section className="space-y-3 print:hidden" aria-labelledby="health-title">
      <div
        className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${status.className}`}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 id="health-title" className="text-xs font-bold uppercase tracking-wider">
              {status.label}
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed opacity-80">
              {status.detail} Snapshot {formatTimestamp(data.generated_at)}.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Perbarui status operasional"
          disabled={health.isFetching}
          onClick={() => {
            playClickSound();
            void health.refetch();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-current/20 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${health.isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Retensi Selfie"
          value={retentionIssues}
          subtext={
            data.retention.last_cron_stale
              ? "Cron belum terverifikasi/terlambat"
              : `Cron ${formatTimestamp(data.retention.last_cron_at)}`
          }
          icon={Clock3}
          iconColor={
            retentionIssues > 0 || data.retention.last_cron_stale
              ? "text-rose-400"
              : "text-amber-400"
          }
        />
        <StatCard
          title="Job Ekspor"
          value={exportIssues}
          subtext={`${data.report_exports.scheduled} menunggu · ${data.report_exports.processing} diproses`}
          icon={FileSpreadsheet}
          iconColor={exportIssues > 0 ? "text-rose-400" : "text-amber-400"}
        />
        <StatCard
          title="Generator Roster"
          value={rosterIssues}
          subtext={`${data.roster_generation.active} proses aktif`}
          icon={Sparkles}
          iconColor={rosterIssues > 0 ? "text-rose-400" : "text-amber-400"}
        />
        <StatCard
          title="Audit 24 Jam"
          value={data.audit.events_24h}
          subtext={`${data.audit.failures_24h} event perlu perhatian`}
          icon={ShieldCheck}
          iconColor={
            data.audit.failures_24h > 0 ? "text-rose-400" : "text-amber-400"
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Audit Terbaru
            </h3>
          </div>
          {data.audit.recent_events.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-800 p-4 text-center text-[10px] text-slate-500">
              Belum ada event audit.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800">
              {data.audit.recent_events.slice(0, 6).map((event, index) => (
                <li
                  key={`${event.action}-${event.created_at}-${index}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-200">
                      {readableAction(event.action)}
                    </p>
                    <p className="truncate text-[9px] text-slate-500">
                      {event.entity_type} ·{" "}
                      {event.source === "system" ? "Sistem" : "Pengguna"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[9px] ${
                      event.outcome === "attention"
                        ? "font-semibold text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    {formatTimestamp(event.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Kesiapan Pemulihan
            </h3>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-100">
            {data.application_backups.provider_backup_verified
              ? "Terverifikasi"
              : "Perlu drill"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            {data.application_backups.note}
          </p>
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">
              Artefak backup aplikasi
            </p>
            <p className="mt-1 text-xs font-bold text-slate-200">
              {data.application_backups.completed_artifacts} selesai
            </p>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Terakhir{" "}
              {formatTimestamp(data.application_backups.last_completed_at)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
