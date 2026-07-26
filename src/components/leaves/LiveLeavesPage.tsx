"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Settings2,
  XCircle,
} from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Modal } from "@/components/ui/Modal";
import { useHR } from "@/context/HRContext";
import { createClient } from "@/lib/supabase/client";
import {
  useCancelLeaveRequest,
  useDecideLeaveRequest,
  useLeaveWorkspace,
  useSaveLeaveType,
  useSubmitLeaveRequest,
} from "@/lib/workforce-requests/queries";
import {
  createLeaveDocumentSignedUrl,
  type LeaveType,
  type LiveLeaveRequest,
} from "@/lib/workforce-requests/repository";
import { playClickSound } from "@/utils/clickSound";

type LeaveTab = "mine" | "approval" | "types";
type DecisionState = {
  request: LiveLeaveRequest;
  decision: "approved" | "rejected" | "cancelled";
} | null;

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function statusLabel(status: LiveLeaveRequest["status"]) {
  return {
    draft: "Draft",
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  }[status];
}

function statusClass(status: LiveLeaveRequest["status"]) {
  if (status === "approved") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (status === "rejected" || status === "cancelled") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-300";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

/**
 * Workspace cuti live berbasis Supabase untuk saldo, dokumen privat,
 * pengajuan, pembatalan, keputusan supervisor, dan konfigurasi jenis cuti.
 */
export function LiveLeavesPage() {
  const { showToast } = useHR();
  const workspace = useLeaveWorkspace();
  const submitMutation = useSubmitLeaveRequest();
  const cancelMutation = useCancelLeaveRequest();
  const decisionMutation = useDecideLeaveRequest();
  const typeMutation = useSaveLeaveType();
  const [tab, setTab] = useState<LeaveTab>("mine");
  const [requestOpen, setRequestOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [decisionState, setDecisionState] = useState<DecisionState>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startsOn, setStartsOn] = useState(localDate(3));
  const [endsOn, setEndsOn] = useState(localDate(3));
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [typeForm, setTypeForm] = useState({
    id: null as string | null,
    code: "",
    name: "",
    minimumNoticeDays: 0,
    sameDayAllowed: false,
    requiresDocument: false,
    documentRequiredAfterDays: "" as string,
    isActive: true,
  });

  const data = workspace.data;
  const role = data?.role;
  const isSupervisor = role === "supervisor";
  const isManagement = role === "management";
  const ownRequests = useMemo(
    () =>
      data?.requests.filter(
        (request) => request.employee_id === data.current_employee_id
      ) ?? [],
    [data]
  );
  const approvalRequests = useMemo(
    () => data?.requests.filter((request) => request.status === "pending") ?? [],
    [data]
  );
  const annualBalance = data?.balances.find(
    (balance) =>
      balance.employee_id === data.current_employee_id &&
      data.leave_types.find((type) => type.id === balance.leave_type_id)?.code ===
        "annual"
  );
  const selectedType = data?.leave_types.find(
    (leaveType) => leaveType.id === leaveTypeId
  );
  const requestedDays =
    Math.floor(
      (new Date(`${endsOn}T12:00:00`).getTime() -
        new Date(`${startsOn}T12:00:00`).getTime()) /
        86_400_000
    ) + 1;
  const attachmentRequired =
    selectedType?.requires_document ||
    (selectedType?.document_required_after_days != null &&
      requestedDays > selectedType.document_required_after_days);

  const closeRequest = () => {
    setRequestOpen(false);
    setReason("");
    setAttachment(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !leaveTypeId || reason.trim().length < 3) {
      showToast("Lengkapi jenis cuti dan alasan pengajuan.", "warning");
      return;
    }
    if (attachmentRequired && !attachment) {
      showToast("Dokumen pendukung wajib dilampirkan.", "warning");
      return;
    }
    if (attachment && attachment.size > 10 * 1024 * 1024) {
      showToast("Ukuran dokumen maksimal 10 MB.", "warning");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        currentEmployeeId: data.current_employee_id,
        leaveTypeId,
        startsOn,
        endsOn,
        reason: reason.trim(),
        attachment,
      });
      playClickSound();
      showToast("Pengajuan cuti berhasil dikirim.", "success");
      closeRequest();
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const handleDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decisionState) return;
    if (
      decisionState.decision !== "approved" &&
      decisionNote.trim().length < 3
    ) {
      showToast("Alasan wajib diisi minimal 3 karakter.", "warning");
      return;
    }

    try {
      if (decisionState.decision === "cancelled") {
        await cancelMutation.mutateAsync({
          requestId: decisionState.request.id,
          expectedVersion: decisionState.request.request_version,
          reason: decisionNote.trim(),
        });
        showToast("Pengajuan berhasil dibatalkan.", "success");
      } else {
        await decisionMutation.mutateAsync({
          requestId: decisionState.request.id,
          expectedVersion: decisionState.request.request_version,
          decision: decisionState.decision,
          note: decisionNote.trim(),
        });
        showToast("Keputusan cuti berhasil disimpan.", "success");
      }
      playClickSound();
      setDecisionState(null);
      setDecisionNote("");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const handleOpenDocument = async (path: string) => {
    try {
      const url = await createLeaveDocumentSignedUrl(createClient(), path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const editType = (leaveType?: LeaveType) => {
    setTypeForm({
      id: leaveType?.id ?? null,
      code: leaveType?.code ?? "",
      name: leaveType?.name ?? "",
      minimumNoticeDays: leaveType?.minimum_notice_days ?? 0,
      sameDayAllowed: leaveType?.same_day_allowed ?? false,
      requiresDocument: leaveType?.requires_document ?? false,
      documentRequiredAfterDays:
        leaveType?.document_required_after_days?.toString() ?? "",
      isActive: leaveType?.is_active ?? true,
    });
    setTypeOpen(true);
  };

  const handleSaveType = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await typeMutation.mutateAsync({
        id: typeForm.id,
        code: typeForm.code,
        name: typeForm.name,
        deductsAnnualBalance:
          data?.leave_types.find((item) => item.id === typeForm.id)
            ?.deducts_annual_balance ?? false,
        minimumNoticeDays: typeForm.minimumNoticeDays,
        sameDayAllowed: typeForm.sameDayAllowed,
        requiresDocument: typeForm.requiresDocument,
        documentRequiredAfterDays: typeForm.documentRequiredAfterDays
          ? Number(typeForm.documentRequiredAfterDays)
          : null,
        isActive: typeForm.isActive,
        reason: "Pembaruan konfigurasi jenis cuti",
      });
      showToast("Jenis cuti berhasil disimpan.", "success");
      setTypeOpen(false);
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  if (workspace.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center text-amber-400">
        <Loader2 className="h-7 w-7 animate-spin" aria-label="Memuat data cuti" />
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

  const visibleRequests = tab === "mine" ? ownRequests : approvalRequests;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Cuti & Izin</h1>
          <p className="mt-1 text-xs text-slate-400">
            Saldo, dokumen privat, dan keputusan tercatat secara real-time.
          </p>
        </div>
        {!isManagement && (
          <button
            type="button"
            onClick={() => {
              setLeaveTypeId(
                data.leave_types.find((leaveType) => leaveType.is_active)?.id ??
                  ""
              );
              setRequestOpen(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Ajukan
          </button>
        )}
      </div>

      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
        {[
          ["Tersedia", annualBalance?.available_days ?? 0],
          ["Terpakai", annualBalance?.used_days ?? 0],
          ["Direservasi", annualBalance?.reserved_days ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-xl font-black text-amber-400">
              {value}
              <span className="ml-1 text-[10px] font-medium text-slate-400">
                hari
              </span>
            </p>
          </div>
        ))}
      </section>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
        {[
          { id: "mine" as const, label: "Pengajuan Saya", show: true },
          {
            id: "approval" as const,
            label: `Persetujuan (${approvalRequests.length})`,
            show: isSupervisor || isManagement,
          },
          { id: "types" as const, label: "Jenis Cuti", show: isSupervisor },
        ]
          .filter((item) => item.show)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                tab === item.id
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-400"
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>

      {tab === "types" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => editType()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-xs font-bold text-amber-300"
          >
            <Settings2 className="h-4 w-4" />
            Tambah Jenis Cuti
          </button>
          {data.leave_types.map((leaveType) => (
            <button
              key={leaveType.id}
              type="button"
              onClick={() => editType(leaveType)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-100">
                    {leaveType.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Notice {leaveType.minimum_notice_days} hari
                    {leaveType.requires_document ? " · Dokumen wajib" : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    leaveType.is_active
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {leaveType.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRequests.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
              Belum ada pengajuan pada bagian ini.
            </div>
          )}
          {visibleRequests.map((request) => (
            <article
              key={request.id}
              className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {tab === "approval" && (
                    <p className="truncate text-sm font-bold text-slate-100">
                      {request.employee_name}
                    </p>
                  )}
                  <p className="text-xs font-semibold text-amber-300">
                    {request.leave_type_name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {request.starts_on} – {request.ends_on} ·{" "}
                    {request.requested_days} hari
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(
                    request.status
                  )}`}
                >
                  {statusLabel(request.status)}
                </span>
              </div>
              <p className="rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                {request.reason}
              </p>
              {request.decision_note && (
                <p className="text-[11px] text-slate-400">
                  Catatan: {request.decision_note}
                </p>
              )}
              {request.attachments
                .filter((item) => !item.deleted_at)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenDocument(item.storage_path)}
                    className="flex items-center gap-2 text-xs font-semibold text-sky-300"
                  >
                    <FileText className="h-4 w-4" />
                    Buka dokumen ({Math.ceil(item.size_bytes / 1024)} KB)
                  </button>
                ))}
              {request.status === "pending" &&
                request.employee_id === data.current_employee_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setDecisionState({ request, decision: "cancelled" })
                    }
                    className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-300"
                  >
                    Batalkan Pengajuan
                  </button>
                )}
              {request.can_decide && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDecisionState({ request, decision: "approved" })
                    }
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDecisionState({ request, decision: "rejected" })
                    }
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 py-2 text-xs font-bold text-rose-300"
                  >
                    <XCircle className="h-4 w-4" />
                    Tolak
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={requestOpen}
        onClose={closeRequest}
        title="Pengajuan Cuti & Izin"
        icon={CalendarDays}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Combobox
            label="Jenis cuti / izin"
            options={data.leave_types
              .filter((leaveType) => leaveType.is_active)
              .map((leaveType) => ({
                value: leaveType.id,
                label: leaveType.name,
                subtext: `Minimal ${leaveType.minimum_notice_days} hari sebelumnya`,
              }))}
            value={leaveTypeId}
            onChange={setLeaveTypeId}
          />
          <DateRangePicker
            label="Periode"
            startDate={startsOn}
            endDate={endsOn}
            onChange={(start, end) => {
              setStartsOn(start);
              setEndsOn(end);
            }}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Alasan</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Dokumen pendukung {attachmentRequired ? "(wajib)" : "(opsional)"}
            </label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setAttachment(event.target.files?.[0] ?? null)
              }
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-bold file:text-slate-950"
            />
            <p className="text-[10px] text-slate-500">
              PDF/JPG/PNG/WebP, maksimal 10 MB. File disimpan privat.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            {submitMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Kirim Pengajuan
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(decisionState)}
        onClose={() => setDecisionState(null)}
        title={
          decisionState?.decision === "approved"
            ? "Setujui Cuti"
            : decisionState?.decision === "rejected"
              ? "Tolak Cuti"
              : "Batalkan Pengajuan"
        }
        icon={decisionState?.decision === "approved" ? CheckCircle2 : XCircle}
      >
        <form onSubmit={handleDecision} className="space-y-4">
          <p className="text-sm text-slate-300">
            {decisionState?.request.employee_name} ·{" "}
            {decisionState?.request.leave_type_name}
          </p>
          <textarea
            rows={3}
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder={
              decisionState?.decision === "approved"
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

      <Modal
        isOpen={typeOpen}
        onClose={() => setTypeOpen(false)}
        title={typeForm.id ? "Ubah Jenis Cuti" : "Tambah Jenis Cuti"}
        icon={Settings2}
      >
        <form onSubmit={handleSaveType} className="space-y-4">
          {[
            {
              label: "Kode",
              value: typeForm.code,
              update: (value: string) =>
                setTypeForm((current) => ({ ...current, code: value })),
            },
            {
              label: "Nama",
              value: typeForm.name,
              update: (value: string) =>
                setTypeForm((current) => ({ ...current, name: value })),
            },
          ].map((field) => (
            <label key={field.label} className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">
                {field.label}
              </span>
              <input
                value={field.value}
                onChange={(event) => field.update(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 sm:text-sm"
              />
            </label>
          ))}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">
              Minimal pemberitahuan (hari)
            </span>
            <input
              type="number"
              min={0}
              max={90}
              value={typeForm.minimumNoticeDays}
              onChange={(event) =>
                setTypeForm((current) => ({
                  ...current,
                  minimumNoticeDays: Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 sm:text-sm"
            />
          </label>
          {([
            ["Boleh diajukan hari yang sama", "sameDayAllowed" as const],
            ["Dokumen selalu wajib", "requiresDocument" as const],
            ["Jenis cuti aktif", "isActive" as const],
          ] as const).map(([label, key]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300"
            >
              {label}
              <input
                type="checkbox"
                checked={typeForm[key] as boolean}
                onChange={(event) =>
                  setTypeForm((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-amber-500"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={typeMutation.isPending}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            Simpan Jenis Cuti
          </button>
        </form>
      </Modal>
    </div>
  );
}
