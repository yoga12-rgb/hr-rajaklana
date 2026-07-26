"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { TimePicker } from "@/components/ui/TimePicker";
import { useHR } from "@/context/HRContext";
import {
  useCancelOvertimeRequest,
  useDecideOvertimeRequest,
  useOvertimeWorkspace,
  useRefreshOvertimeActual,
  useSubmitOrAssignOvertime,
} from "@/lib/workforce-requests/queries";
import type { LiveOvertimeRequest } from "@/lib/workforce-requests/repository";
import { playClickSound } from "@/utils/clickSound";

type StatusFilter = "all" | LiveOvertimeRequest["status"];
type ActionState = {
  request: LiveOvertimeRequest;
  action: "approved" | "rejected" | "cancelled";
} | null;

function localDate(daysFromToday = 1) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

function statusLabel(status: LiveOvertimeRequest["status"]) {
  return {
    draft: "Draft",
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  }[status];
}

/**
 * Workspace lembur live untuk pengajuan karyawan, penugasan supervisor,
 * validasi durasi, pembatalan, dan keputusan atomik.
 */
export function LiveOvertimePage() {
  const { showToast } = useHR();
  const workspace = useOvertimeWorkspace();
  const submitMutation = useSubmitOrAssignOvertime();
  const cancelMutation = useCancelOvertimeRequest();
  const decisionMutation = useDecideOvertimeRequest();
  const refreshMutation = useRefreshOvertimeActual();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [assignment, setAssignment] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [overtimeDate, setOvertimeDate] = useState(localDate());
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionNote, setActionNote] = useState("");
  const [approvedMinutes, setApprovedMinutes] = useState(60);

  const data = workspace.data;
  const isSupervisor = data?.role === "supervisor";
  const isManagement = data?.role === "management";
  const filtered = useMemo(
    () =>
      data?.requests.filter(
        (request) => filter === "all" || request.status === filter
      ) ?? [],
    [data, filter]
  );
  const pendingCount =
    data?.requests.filter((request) => request.status === "pending").length ?? 0;
  const approvedMinutesTotal =
    data?.requests
      .filter((request) => request.status === "approved")
      .reduce(
        (total, request) => total + (request.approved_duration_min ?? 0),
        0
      ) ?? 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (assignment && !employeeId) {
      showToast("Pilih karyawan penerima penugasan.", "warning");
      return;
    }
    if (reason.trim().length < 3) {
      showToast("Alasan wajib diisi minimal 3 karakter.", "warning");
      return;
    }
    try {
      await submitMutation.mutateAsync({
        employeeId,
        overtimeDate,
        startTime,
        endTime,
        reason: reason.trim(),
        assignment,
      });
      playClickSound();
      showToast(
        assignment
          ? "Penugasan lembur berhasil dikirim."
          : "Pengajuan lembur berhasil dikirim.",
        "success"
      );
      setFormOpen(false);
      setReason("");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const openAction = (
    request: LiveOvertimeRequest,
    action: NonNullable<ActionState>["action"]
  ) => {
    setActionState({ request, action });
    setActionNote("");
    setApprovedMinutes(
      request.actual_duration_min || request.planned_duration_min || 60
    );
  };

  const handleAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!actionState) return;
    if (actionState.action !== "approved" && actionNote.trim().length < 3) {
      showToast("Alasan wajib diisi minimal 3 karakter.", "warning");
      return;
    }
    try {
      if (actionState.action === "cancelled") {
        await cancelMutation.mutateAsync({
          requestId: actionState.request.id,
          expectedVersion: actionState.request.request_version,
          reason: actionNote.trim(),
        });
        showToast("Lembur berhasil dibatalkan.", "success");
      } else {
        await decisionMutation.mutateAsync({
          requestId: actionState.request.id,
          expectedVersion: actionState.request.request_version,
          decision: actionState.action,
          approvedMinutes:
            actionState.action === "approved" ? approvedMinutes : 0,
          note: actionNote.trim(),
        });
        showToast("Keputusan lembur berhasil disimpan.", "success");
      }
      setActionState(null);
      playClickSound();
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const handleRefresh = async (requestId: string) => {
    try {
      await refreshMutation.mutateAsync(requestId);
      showToast("Durasi aktual berhasil dihitung dari presensi.", "success");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  if (workspace.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center text-amber-400">
        <Loader2
          className="h-7 w-7 animate-spin"
          aria-label="Memuat data lembur"
        />
      </div>
    );
  }

  if (workspace.isError || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
        {errorMessage(workspace.error)}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Lembur</h1>
          <p className="mt-1 text-xs text-slate-400">
            Rencana, durasi aktual, dan persetujuan tanpa perhitungan gaji.
          </p>
        </div>
        {!isManagement && (
          <button
            type="button"
            onClick={() => {
              setAssignment(false);
              setFormOpen(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Ajukan
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Menunggu"
          value={pendingCount}
          icon={Clock3}
          subtext="Keputusan pertama mengunci"
        />
        <StatCard
          title="Disetujui"
          value={`${(approvedMinutesTotal / 60).toFixed(1)}j`}
          icon={CheckCircle2}
          subtext="Total data yang terlihat"
        />
      </div>

      {isSupervisor && (
        <button
          type="button"
          onClick={() => {
            setAssignment(true);
            setEmployeeId(
              data.employees.find(
                (employee) => employee.id !== data.current_employee_id
              )?.id ?? ""
            );
            setFormOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-xs font-bold text-amber-300"
        >
          <Plus className="h-4 w-4" />
          Buat Penugasan Lembur
        </button>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ["all", "Semua"],
          ["pending", "Menunggu"],
          ["approved", "Disetujui"],
          ["rejected", "Ditolak"],
          ["cancelled", "Dibatalkan"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as StatusFilter)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              filter === value
                ? "border-amber-500 bg-amber-500 text-slate-950"
                : "border-slate-700 bg-slate-900 text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
            Belum ada data lembur pada filter ini.
          </div>
        )}
        {filtered.map((request) => {
          const canCancel = request.can_cancel;
          return (
            <article
              key={request.id}
              className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-100">
                    {request.employee_name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {request.overtime_date} ·{" "}
                    {request.source_type === "supervisor_assignment"
                      ? "Penugasan supervisor"
                      : request.source_type === "attendance"
                        ? "Potensi dari presensi"
                        : "Pengajuan karyawan"}
                  </p>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                  {statusLabel(request.status)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-950 p-3 text-center">
                {[
                  ["Rencana", request.planned_duration_min],
                  ["Aktual", request.actual_duration_min],
                  ["Disetujui", request.approved_duration_min],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[9px] uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-xs font-bold text-slate-200">
                      {value == null ? "—" : `${value} mnt`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Rencana waktu: {request.planned_start_time?.slice(0, 5) ?? "—"}–
                {request.planned_end_time?.slice(0, 5) ?? "—"}
              </p>
              <p className="text-xs text-slate-300">{request.reason}</p>
              {request.decision_note && (
                <p className="text-[11px] text-slate-400">
                  Catatan: {request.decision_note}
                </p>
              )}
              {request.can_refresh_actual &&
                request.actual_duration_min == null && (
                  <button
                    type="button"
                    onClick={() => handleRefresh(request.id)}
                    disabled={refreshMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Hitung dari Presensi
                  </button>
                )}
              {request.can_decide && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openAction(request, "approved")}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction(request, "rejected")}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 py-2 text-xs font-bold text-rose-300"
                  >
                    <XCircle className="h-4 w-4" />
                    Tolak
                  </button>
                </div>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => openAction(request, "cancelled")}
                  className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-300"
                >
                  Batalkan
                </button>
              )}
            </article>
          );
        })}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={assignment ? "Penugasan Lembur" : "Pengajuan Lembur"}
        icon={Clock3}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {assignment && (
            <Combobox
              label="Karyawan"
              options={data.employees
                .filter(
                  (employee) => employee.id !== data.current_employee_id
                )
                .map((employee) => ({
                  value: employee.id,
                  label: employee.name,
                  subtext: employee.position_name,
                }))}
              value={employeeId}
              onChange={setEmployeeId}
            />
          )}
          <DatePicker
            label="Tanggal lembur"
            value={overtimeDate}
            onChange={setOvertimeDate}
          />
          <div className="grid grid-cols-2 gap-3">
            <TimePicker
              label="Mulai"
              value={startTime}
              onChange={setStartTime}
              includeSuffix={false}
            />
            <TimePicker
              label="Selesai"
              value={endTime}
              onChange={setEndTime}
              includeSuffix={false}
              align="right"
            />
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Alasan</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            {submitMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {assignment ? "Kirim Penugasan" : "Kirim Pengajuan"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(actionState)}
        onClose={() => setActionState(null)}
        title={
          actionState?.action === "approved"
            ? "Setujui Lembur"
            : actionState?.action === "rejected"
              ? "Tolak Lembur"
              : "Batalkan Lembur"
        }
        icon={actionState?.action === "approved" ? CheckCircle2 : XCircle}
      >
        <form onSubmit={handleAction} className="space-y-4">
          {actionState?.action === "approved" && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">
                Durasi disetujui (menit)
              </span>
              <input
                type="number"
                min={60}
                step={30}
                value={approvedMinutes}
                onChange={(event) =>
                  setApprovedMinutes(Number(event.target.value))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 sm:text-sm"
              />
            </label>
          )}
          <textarea
            rows={3}
            value={actionNote}
            onChange={(event) => setActionNote(event.target.value)}
            placeholder={
              actionState?.action === "approved"
                ? "Catatan opsional"
                : "Alasan wajib diisi"
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-sm"
          />
          <button
            type="submit"
            disabled={cancelMutation.isPending || decisionMutation.isPending}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            Konfirmasi
          </button>
        </form>
      </Modal>
    </div>
  );
}
