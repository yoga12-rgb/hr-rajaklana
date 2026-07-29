"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  RefreshCw,
  TimerReset,
  Users,
  XCircle,
} from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { OperationalHealthPanel } from "@/components/operations/OperationalHealthPanel";
import { useHR } from "@/context/HRContext";
import {
  useReportExportDownload,
  useReportExportJobs,
  useReportWorkspace,
  useRequestReportExport,
  useRetryReportExport,
} from "@/lib/reports/queries";
import { reportWorkbookSheets } from "@/lib/reports/workbook";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultPeriod() {
  const now = new Date();
  return {
    start: inputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: inputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/**
 * Laporan operasional live M8 untuk supervisor dan management.
 *
 * Seluruh data berasal dari satu RPC role-aware dengan periode maksimal 92
 * hari. XLSX dibuat di perangkat dari snapshot yang sama; PDF menggunakan
 * print stylesheet browser sehingga tidak ada data tambahan yang dikirim.
 */
export function LiveReportsPage() {
  const initial = useMemo(() => defaultPeriod(), []);
  const { showToast } = useHR();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [outletId, setOutletId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportStart, setExportStart] = useState(
    `${new Date().getFullYear()}-01-01`
  );
  const [exportEnd, setExportEnd] = useState(
    `${new Date().getFullYear()}-12-31`
  );
  const exportJobs = useReportExportJobs();
  const requestExport = useRequestReportExport();
  const retryExport = useRetryReportExport();
  const downloadExport = useReportExportDownload();
  const report = useReportWorkspace({
    periodStart,
    periodEnd,
    outletId,
    employeeId,
  });

  const outletOptions = [
    { value: "", label: "Semua outlet" },
    ...(report.data?.filters.outlets ?? []).map((outlet) => ({
      value: outlet.id,
      label: outlet.name,
      subtext: outlet.code,
    })),
  ];
  const employeeOptions = [
    { value: "", label: "Semua karyawan" },
    ...(report.data?.filters.employees ?? []).map((employee) => ({
      value: employee.id,
      label: employee.name,
      subtext: `${employee.nik ?? ""} · ${employee.position_name ?? ""}`,
    })),
  ];

  const handleExport = async () => {
    if (!report.data) return;
    playClickSound();
    setIsExporting(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      await writeXlsxFile(reportWorkbookSheets(report.data)).toFile(
        `laporan-operasional-${periodStart}-${periodEnd}.xlsx`
      );
      playSuccessHaptic();
      showToast("Laporan XLSX berhasil diunduh.", "success");
    } catch {
      showToast("Laporan XLSX belum dapat dibuat di perangkat ini.", "warning");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestExport = async () => {
    playClickSound();
    try {
      await requestExport.mutateAsync({
        periodStart: exportStart,
        periodEnd: exportEnd,
        outletId,
        employeeId,
      });
      setExportModalOpen(false);
      playSuccessHaptic();
      showToast(
        "Ekspor dijadwalkan. Status akan diperbarui otomatis.",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Ekspor belum dapat dijadwalkan.",
        "warning"
      );
    }
  };

  if (report.isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6 print:bg-white print:text-black">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 print:text-black">
            Laporan Operasional
          </h1>
          <p className="text-xs text-slate-400">
            Presensi, cuti, lembur, shift, dan perbandingan outlet
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            disabled={!report.data || isExporting}
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {isExporting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            XLSX
          </button>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              window.print();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      <OperationalHealthPanel />

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:grid-cols-3 print:hidden">
        <DateRangePicker
          label="Periode laporan (maks. 92 hari)"
          startDate={periodStart}
          endDate={periodEnd}
          onChange={(start, end) => {
            setPeriodStart(start);
            setPeriodEnd(end);
          }}
        />
        <Combobox
          label="Outlet"
          options={outletOptions}
          value={outletId}
          onChange={setOutletId}
          searchPlaceholder="Cari outlet..."
        />
        <Combobox
          label="Karyawan"
          options={employeeOptions}
          value={employeeId}
          onChange={setEmployeeId}
          searchPlaceholder="Cari karyawan..."
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4 print:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-100">
              <Archive className="h-4 w-4 text-amber-400" />
              Ekspor Periode Panjang
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              XLSX hingga 366 hari dibuat server di belakang layar dan disimpan
              privat. Filter outlet dan karyawan mengikuti pilihan di atas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setExportModalOpen(true);
            }}
            className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
          >
            Buat Ekspor
          </button>
        </div>

        {exportJobs.isError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3">
            <p className="text-[10px] text-rose-300">
              Riwayat ekspor belum dapat dimuat.
            </p>
            <button
              type="button"
              onClick={() => void exportJobs.refetch()}
              className="text-[10px] font-bold text-amber-400"
            >
              Coba lagi
            </button>
          </div>
        )}

        {exportJobs.data && exportJobs.data.length > 0 ? (
          <div className="space-y-2">
            {exportJobs.data.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">
                    {formatDate(job.period_start)}–{formatDate(job.period_end)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                    {job.status === "completed" ? (
                      <CheckCircle2 className="h-3 w-3 text-amber-400" />
                    ) : job.status === "failed" ? (
                      <XCircle className="h-3 w-3 text-rose-400" />
                    ) : (
                      <LoaderCircle className="h-3 w-3 animate-spin text-amber-400" />
                    )}
                    {job.status === "scheduled"
                      ? "Menunggu worker"
                      : job.status === "processing"
                        ? "Sedang dibuat"
                        : job.status === "completed"
                          ? `${Math.max(1, Math.round((job.file_size_bytes ?? 0) / 1024))} KB`
                          : job.last_error ?? "Ekspor gagal"}
                  </p>
                </div>
                {job.status === "completed" ? (
                  <button
                    type="button"
                    disabled={downloadExport.isPending}
                    onClick={async () => {
                      try {
                        await downloadExport.mutateAsync(job);
                      } catch (error) {
                        showToast(
                          error instanceof Error
                            ? error.message
                            : "File belum dapat diunduh.",
                          "warning"
                        );
                      }
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] font-bold text-amber-300 disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    Unduh
                  </button>
                ) : job.status === "failed" && job.attempt_count < 3 ? (
                  <button
                    type="button"
                    disabled={retryExport.isPending}
                    onClick={async () => {
                      try {
                        await retryExport.mutateAsync(job.id);
                        showToast("Ekspor dijadwalkan ulang.", "success");
                      } catch (error) {
                        showToast(
                          error instanceof Error
                            ? error.message
                            : "Ekspor belum dapat diulang.",
                          "warning"
                        );
                      }
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-slate-300 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Ulangi
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          !exportJobs.isLoading && (
            <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-[10px] text-slate-500">
              Belum ada ekspor periode panjang.
            </p>
          )
        )}
      </section>

      {report.isError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <div>
              <p className="text-xs font-bold text-rose-300">
                Laporan belum dapat dimuat
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {report.error instanceof Error
                  ? report.error.message
                  : "Periksa filter dan koneksi Anda."}
              </p>
              <button
                type="button"
                onClick={() => void report.refetch()}
                className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {report.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Log Presensi"
              value={report.data.summary.attendance_count}
              subtext={`${report.data.summary.employee_count} karyawan dalam scope`}
              icon={Users}
            />
            <StatCard
              title="Terlambat"
              value={report.data.summary.late_count}
              subtext={`${report.data.summary.early_checkout_count} pulang awal/jam kurang`}
              icon={Clock}
              valueColor="text-amber-400"
            />
            <StatCard
              title="Cuti Disetujui"
              value={`${report.data.summary.approved_leave_days} hari`}
              subtext={`${report.data.leaves.length} pengajuan dalam periode`}
              icon={Calendar}
              iconColor="text-blue-400"
            />
            <StatCard
              title="Lembur Disetujui"
              value={`${(report.data.summary.approved_overtime_minutes / 60).toFixed(1)} jam`}
              subtext={`${report.data.overtime.length} pengajuan dalam periode`}
              icon={TimerReset}
              iconColor="text-purple-400"
            />
          </div>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Perbandingan Outlet
              </h2>
              <span className="text-[10px] text-amber-400">
                {formatDate(periodStart)}–{formatDate(periodEnd)}
              </span>
            </div>
            {report.data.outlet_comparison.every(
              (outlet) => outlet.attendance_count === 0
            ) ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Belum ada presensi pada periode dan filter ini.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {report.data.outlet_comparison.map((outlet) => (
                  <div
                    key={outlet.outlet_id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-xs text-slate-200">
                        {outlet.outlet_name}
                      </strong>
                      <span className="text-xs font-bold text-amber-400">
                        {outlet.attendance_count} log
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {outlet.late_count} terlambat ·{" "}
                      {outlet.early_checkout_count} pulang awal/jam kurang
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="border-b border-slate-800 pb-3 text-xs font-bold uppercase tracking-wider text-slate-100">
              Presensi Terbaru
            </h2>
            {report.data.attendance.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Tidak ada data presensi untuk filter ini.
              </p>
            ) : (
              <div className="space-y-2">
                {report.data.attendance.slice(0, 20).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-200">
                        {row.employee_name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {row.outlet_name} · {formatDate(row.work_date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[10px] text-slate-300">
                        {formatTime(row.clock_in_at)}–{formatTime(row.clock_out_at)}
                      </p>
                      <span
                        className={`text-[9px] font-semibold ${
                          row.clock_in_state === "late"
                            ? "text-rose-400"
                            : "text-amber-400"
                        }`}
                      >
                        {row.clock_in_state === "late"
                          ? "Terlambat"
                          : row.clock_in_state === "flexible"
                            ? "Fleksibel"
                            : "Tepat waktu"}
                      </span>
                    </div>
                  </div>
                ))}
                {report.data.attendance.length > 20 && (
                  <p className="text-center text-[10px] text-slate-500">
                    Tampilan dibatasi 20 baris. Semua{" "}
                    {report.data.attendance.length} baris tersedia di XLSX.
                  </p>
                )}
              </div>
            )}
          </section>

          <div className="hidden print:block">
            <p className="text-sm">
              Dokumen dibuat dari data Supabase pada saat halaman dicetak.
            </p>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] text-slate-400 print:hidden">
        <Download className="h-4 w-4 shrink-0 text-amber-400" />
        XLSX memuat ringkasan, presensi, cuti, lembur, dan distribusi shift
        sesuai filter aktif.
      </div>

      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Buat Ekspor Periode Panjang"
        icon={Archive}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
            Pilih maksimal 366 hari. Permintaan langsung masuk antrean; halaman
            boleh ditutup setelah status muncul.
          </div>
          <DateRangePicker
            label="Periode ekspor"
            startDate={exportStart}
            endDate={exportEnd}
            onChange={(start, end) => {
              setExportStart(start);
              setExportEnd(end);
            }}
          />
          <p className="text-[10px] text-slate-400">
            Scope:{" "}
            {outletOptions.find((option) => option.value === outletId)?.label ??
              "Semua outlet"}{" "}
            ·{" "}
            {employeeOptions.find((option) => option.value === employeeId)
              ?.label ?? "Semua karyawan"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              className="rounded-xl bg-slate-800 py-3 text-sm font-bold text-slate-300"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={requestExport.isPending}
              onClick={() => void handleRequestExport()}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {requestExport.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              Jadwalkan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
