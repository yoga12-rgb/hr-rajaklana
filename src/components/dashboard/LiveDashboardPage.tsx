"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  QrCode,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { LiveAnnouncementBoard } from "@/components/communications/LiveAnnouncementBoard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import {
  useAttendanceWorkspace,
  usePendingAttendanceValidations,
} from "@/lib/attendance/queries";
import { useLiveEmployees } from "@/lib/master-data/queries";
import { useLeaveWorkspace } from "@/lib/workforce-requests/queries";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatWorkDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

/**
 * Dashboard live yang hanya membaca DAL Supabase.
 *
 * Ringkasan menyesuaikan scope RLS pengguna: supervisor/management melihat
 * cakupan operasional yang diizinkan, sementara employee hanya melihat data
 * pribadi. Tidak ada fallback ke HRContext pada mode live.
 */
export function LiveDashboardPage() {
  const attendance = useAttendanceWorkspace();
  const employees = useLiveEmployees();
  const leaves = useLeaveWorkspace();
  const role = attendance.data?.role;
  const validations = usePendingAttendanceValidations(role === "supervisor");

  if (attendance.isLoading || employees.isLoading || leaves.isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const firstError = attendance.error ?? employees.error ?? leaves.error;
  if (firstError || !attendance.data || !employees.data || !leaves.data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
        <h2 className="mt-3 text-sm font-bold text-slate-100">
          Dashboard live belum dapat dimuat
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {firstError instanceof Error
            ? firstError.message
            : "Periksa koneksi lalu coba kembali."}
        </p>
        <button
          type="button"
          onClick={() => {
            void Promise.all([
              attendance.refetch(),
              employees.refetch(),
              leaves.refetch(),
            ]);
          }}
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const workspace = attendance.data;
  const currentEmployee = employees.data.find(
    (employee) => employee.id === workspace.current_employee_id
  );
  const pendingLeaves = leaves.data.requests.filter(
    (request) => request.status === "pending"
  );
  const recentAttendance = workspace.history.slice(0, 4);
  const scopeLabel =
    role === "employee" ? "Data pribadi sesuai akun" : "Karyawan aktif";

  return (
    <div className="space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-5 shadow-xl">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/20 text-lg font-bold text-amber-400">
              {(currentEmployee?.full_name ?? "HR")
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-100">
                Halo, {currentEmployee?.full_name ?? "Pengguna"}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
                {workspace.today_assignment?.outlet_name ??
                  workspace.open_session?.outlet_name ??
                  "Area operasional"}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Live
          </span>
        </div>

        <div className="relative z-10 mt-4 flex items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400">
              Status presensi Anda
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-200">
              {workspace.open_session
                ? `Masuk ${formatTime(workspace.open_session.clock_in_at)}`
                : workspace.today_assignment
                  ? `${workspace.today_assignment.planned_start.slice(0, 5)}–${workspace.today_assignment.planned_end.slice(0, 5)}`
                  : role === "supervisor"
                    ? "Presensi fleksibel · target 8 jam"
                    : "Belum ada sesi aktif"}
            </p>
          </div>
          <Link
            href="/attendance"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20"
          >
            <QrCode className="h-4 w-4" />
            {workspace.open_session ? "Buka Sesi" : "Presensi"}
          </Link>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-8 translate-x-8 rounded-full bg-amber-500/10 blur-2xl" />
      </section>

      <nav className="grid grid-cols-4 gap-3" aria-label="Aksi cepat">
        {[
          { href: "/employees", label: "Data Staf", icon: UserPlus },
          { href: "/attendance", label: "Presensi", icon: Clock },
          { href: "/leaves", label: "Cuti & Izin", icon: CalendarDays },
          { href: "/profile", label: "Profil Saya", icon: Users },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 p-3 text-center transition-colors hover:border-amber-500/40"
          >
            <span className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 transition-transform group-hover:scale-105">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-medium text-slate-300">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title={role === "employee" ? "Profil Aktif" : "Total Karyawan"}
          value={
            <>
              {employees.data.length}{" "}
              <span className="text-xs font-normal text-slate-400">orang</span>
            </>
          }
          subtext={scopeLabel}
          icon={Users}
        />
        <StatCard
          title={role === "supervisor" ? "Perlu Ditinjau" : "Pengajuan Aktif"}
          value={
            role === "supervisor"
              ? pendingLeaves.length + (validations.data?.length ?? 0)
              : pendingLeaves.length
          }
          subtext={
            role === "supervisor"
              ? `${pendingLeaves.length} pengajuan · ${validations.data?.length ?? 0} presensi`
              : "Menunggu keputusan supervisor"
          }
          icon={UserCheck}
          iconColor="text-amber-400"
        />
      </div>

      <LiveAnnouncementBoard />

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Presensi Terbaru Anda
            </h3>
          </div>
          <Link
            href="/attendance"
            className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-400"
          >
            Semua
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {recentAttendance.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 py-6 text-center text-xs text-slate-400">
            Belum ada riwayat presensi.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentAttendance.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {item.outlet_name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatWorkDate(item.work_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] text-slate-300">
                    {formatTime(item.clock_in_at)}
                    {item.clock_out_at
                      ? `–${formatTime(item.clock_out_at)}`
                      : "–aktif"}
                  </p>
                  <span className="text-[9px] font-semibold text-amber-400">
                    {item.validation_status === "approved"
                      ? "Tervalidasi"
                      : item.validation_status === "pending"
                        ? "Menunggu validasi"
                        : "Perlu ditinjau"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
