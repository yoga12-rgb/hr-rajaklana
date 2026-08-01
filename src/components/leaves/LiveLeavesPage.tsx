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
  projectApprovedLeaveChange,
  projectLeaveBalanceDecision,
  projectPendingLeaveAmendment,
} from "@/lib/workforce-requests/leave-balance";
import {
  useAmendPendingLeaveRequest,
  useCancelLeaveChangeRequest,
  useCancelLeaveRequest,
  useDecideLeaveChangeRequest,
  useDecideLeaveRequest,
  useLeaveWorkspace,
  useSaveLeaveType,
  useSubmitLeaveChangeRequest,
  useSubmitLeaveRequest,
} from "@/lib/workforce-requests/queries";
import {
  createLeaveDocumentSignedUrl,
  type LeaveType,
  type LiveLeaveChangeRequest,
  type LiveLeaveRequest,
} from "@/lib/workforce-requests/repository";
import { playClickSound } from "@/utils/clickSound";

type LeaveTab = "mine" | "approval" | "types";
type DecisionState = {
  request: LiveLeaveRequest;
  decision: "approved" | "rejected";
} | null;
type LeaveActionKind =
  | "amend_pending"
  | "cancel_pending"
  | "request_reschedule"
  | "request_cancel";
type LeaveActionState = {
  request: LiveLeaveRequest;
  kind: LeaveActionKind;
} | null;
type ChangeDecisionState = {
  changeRequest: LiveLeaveChangeRequest;
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

function inclusiveDays(startsOn: string, endsOn: string) {
  return (
    Math.floor(
      (new Date(`${endsOn}T12:00:00`).getTime() -
        new Date(`${startsOn}T12:00:00`).getTime()) /
        86_400_000
    ) + 1
  );
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
  const amendMutation = useAmendPendingLeaveRequest();
  const cancelMutation = useCancelLeaveRequest();
  const submitChangeMutation = useSubmitLeaveChangeRequest();
  const cancelChangeMutation = useCancelLeaveChangeRequest();
  const changeDecisionMutation = useDecideLeaveChangeRequest();
  const decisionMutation = useDecideLeaveRequest();
  const typeMutation = useSaveLeaveType();
  const [tab, setTab] = useState<LeaveTab>("mine");
  const [requestOpen, setRequestOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [decisionState, setDecisionState] = useState<DecisionState>(null);
  const [leaveActionState, setLeaveActionState] =
    useState<LeaveActionState>(null);
  const [changeDecisionState, setChangeDecisionState] =
    useState<ChangeDecisionState>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startsOn, setStartsOn] = useState(localDate(3));
  const [endsOn, setEndsOn] = useState(localDate(3));
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [actionStartsOn, setActionStartsOn] = useState(localDate(3));
  const [actionEndsOn, setActionEndsOn] = useState(localDate(3));
  const [actionReason, setActionReason] = useState("");
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
  const changeRequests = useMemo(
    () => data?.change_requests ?? [],
    [data?.change_requests]
  );
  const ownRequests = useMemo(
    () =>
      data?.requests.filter(
        (request) => request.employee_id === data.current_employee_id
      ) ?? [],
    [data]
  );
  const approvalRequests = useMemo(
    () =>
      data?.requests.filter(
        (request) =>
          request.employee_id !== data.current_employee_id &&
          request.status === "pending"
      ) ?? [],
    [data]
  );
  const pendingChangeRequests = useMemo(
    () =>
      changeRequests.filter(
        (request) =>
          request.status === "pending" &&
          request.employee_id !== data?.current_employee_id
      ),
    [changeRequests, data?.current_employee_id]
  );
  const openChangeByLeaveId = useMemo(
    () =>
      new Map(
        changeRequests
          .filter((request) => request.status === "pending")
          .map((request) => [request.leave_request_id, request])
      ),
    [changeRequests]
  );
  const leaveTypesById = useMemo(
    () => new Map(data?.leave_types.map((leaveType) => [leaveType.id, leaveType])),
    [data]
  );
  const balancesByEmployeeTypeYear = useMemo(
    () =>
      new Map(
        data?.balances.map((balance) => [
          `${balance.employee_id}:${balance.leave_type_id}:${balance.year}`,
          balance,
        ])
      ),
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
  const requestedDays = inclusiveDays(startsOn, endsOn);
  const attachmentRequired =
    selectedType?.requires_document ||
    (selectedType?.document_required_after_days != null &&
      requestedDays > selectedType.document_required_after_days);
  const decisionLeaveType = decisionState
    ? leaveTypesById.get(decisionState.request.leave_type_id)
    : undefined;
  const decisionBalance = decisionState
    ? balancesByEmployeeTypeYear.get(
        `${decisionState.request.employee_id}:${decisionState.request.leave_type_id}:${Number(
          decisionState.request.starts_on.slice(0, 4)
        )}`
      )
    : undefined;
  const decisionProjection =
    decisionState && decisionLeaveType?.deducts_annual_balance && decisionBalance
      ? projectLeaveBalanceDecision(
          decisionBalance,
          decisionState.request.requested_days,
          decisionState.decision
        )
      : null;
  const actionRequest = leaveActionState?.request;
  const actionLeaveType = actionRequest
    ? leaveTypesById.get(actionRequest.leave_type_id)
    : undefined;
  const actionBalance = actionRequest
    ? balancesByEmployeeTypeYear.get(
        `${actionRequest.employee_id}:${actionRequest.leave_type_id}:${Number(
          actionRequest.starts_on.slice(0, 4)
        )}`
      )
    : undefined;
  const actionProposedDays = inclusiveDays(actionStartsOn, actionEndsOn);
  const actionReservedDelta =
    actionRequest &&
    leaveActionState?.kind === "request_reschedule" &&
    actionLeaveType?.deducts_annual_balance
      ? Math.max(0, actionProposedDays - actionRequest.requested_days)
      : 0;
  const actionProjection = (() => {
    if (!leaveActionState || !actionRequest || !actionBalance) return null;
    if (!actionLeaveType?.deducts_annual_balance) return null;
    if (leaveActionState.kind === "amend_pending") {
      return projectPendingLeaveAmendment(
        actionBalance,
        actionRequest.requested_days,
        actionProposedDays
      );
    }
    if (leaveActionState.kind === "cancel_pending") {
      return projectLeaveBalanceDecision(
        actionBalance,
        actionRequest.requested_days,
        "cancelled"
      );
    }

    const balanceAfterReservation =
      actionReservedDelta > 0
        ? {
            ...actionBalance,
            available_days:
              actionBalance.available_days - actionReservedDelta,
            reserved_days:
              actionBalance.reserved_days + actionReservedDelta,
          }
        : actionBalance;
    const finalProjection = projectApprovedLeaveChange(
      balanceAfterReservation,
      actionRequest.requested_days,
      leaveActionState.kind === "request_cancel" ? "cancel" : "reschedule",
      actionProposedDays,
      actionReservedDelta
    );
    return {
      ...finalProjection,
      availableBefore: actionBalance.available_days,
      reservedBefore: actionBalance.reserved_days,
      usedBefore: actionBalance.used_days,
    };
  })();
  const changeDecision = changeDecisionState?.changeRequest;
  const changeDecisionType = changeDecision
    ? leaveTypesById.get(changeDecision.leave_type_id)
    : undefined;
  const changeDecisionBalance = changeDecision
    ? balancesByEmployeeTypeYear.get(
        `${changeDecision.employee_id}:${changeDecision.leave_type_id}:${Number(
          changeDecision.old_starts_on.slice(0, 4)
        )}`
      )
    : undefined;
  const changeDecisionProjection =
    changeDecisionState?.decision === "approved" &&
    changeDecision &&
    changeDecisionType?.deducts_annual_balance &&
    changeDecisionBalance
      ? projectApprovedLeaveChange(
          changeDecisionBalance,
          changeDecision.old_requested_days,
          changeDecision.change_type,
          changeDecision.proposed_days ?? 0,
          changeDecision.reserved_delta_days
        )
      : null;
  const actionNeedsDates =
    leaveActionState?.kind === "amend_pending" ||
    leaveActionState?.kind === "request_reschedule";
  const actionIsPending =
    amendMutation.isPending ||
    cancelMutation.isPending ||
    submitChangeMutation.isPending;

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
      await decisionMutation.mutateAsync({
        requestId: decisionState.request.id,
        expectedVersion: decisionState.request.request_version,
        decision: decisionState.decision,
        note: decisionNote.trim(),
      });
      showToast(
        decisionState.decision === "approved"
          ? "Cuti disetujui. Draft roster diperbarui; alert backup muncul bila staf kurang."
          : "Keputusan cuti berhasil disimpan.",
        "success"
      );
      playClickSound();
      setDecisionState(null);
      setDecisionNote("");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const openLeaveAction = (
    request: LiveLeaveRequest,
    kind: LeaveActionKind
  ) => {
    setActionStartsOn(request.starts_on);
    setActionEndsOn(request.ends_on);
    setActionReason("");
    setLeaveActionState({ request, kind });
  };

  const closeLeaveAction = () => {
    if (actionIsPending) return;
    setLeaveActionState(null);
    setActionReason("");
  };

  const handleLeaveAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaveActionState || !actionRequest) return;
    if (actionReason.trim().length < 3) {
      showToast("Alasan wajib diisi minimal 3 karakter.", "warning");
      return;
    }
    if (actionNeedsDates) {
      if (actionProposedDays < 1 || actionEndsOn < actionStartsOn) {
        showToast("Rentang tanggal perubahan tidak valid.", "warning");
        return;
      }
      if (
        actionStartsOn === actionRequest.starts_on &&
        actionEndsOn === actionRequest.ends_on
      ) {
        showToast("Pilih tanggal yang berbeda dari pengajuan saat ini.", "warning");
        return;
      }
      if (
        actionLeaveType?.deducts_annual_balance &&
        (actionStartsOn.slice(0, 4) !== actionRequest.starts_on.slice(0, 4) ||
          actionEndsOn.slice(0, 4) !== actionRequest.starts_on.slice(0, 4))
      ) {
        showToast(
          "Perubahan Cuti Tahunan harus tetap pada tahun yang sama.",
          "warning"
        );
        return;
      }
      if (
        actionProjection &&
        actionProjection.availableAfter < 0
      ) {
        showToast("Saldo Cuti Tahunan tidak mencukupi.", "warning");
        return;
      }
    }

    try {
      if (leaveActionState.kind === "amend_pending") {
        await amendMutation.mutateAsync({
          request: actionRequest,
          requestId: actionRequest.id,
          expectedVersion: actionRequest.request_version,
          startsOn: actionStartsOn,
          endsOn: actionEndsOn,
          reason: actionReason.trim(),
        });
        showToast("Tanggal pengajuan berhasil diubah.", "success");
      } else if (leaveActionState.kind === "cancel_pending") {
        await cancelMutation.mutateAsync({
          requestId: actionRequest.id,
          expectedVersion: actionRequest.request_version,
          reason: actionReason.trim(),
        });
        showToast("Pengajuan berhasil dibatalkan.", "success");
      } else {
        const isReschedule = leaveActionState.kind === "request_reschedule";
        await submitChangeMutation.mutateAsync({
          request: actionRequest,
          leaveRequestId: actionRequest.id,
          sourceLeaveVersion: actionRequest.request_version,
          changeType: isReschedule ? "reschedule" : "cancel",
          proposedStartsOn: isReschedule ? actionStartsOn : null,
          proposedEndsOn: isReschedule ? actionEndsOn : null,
          reason: actionReason.trim(),
        });
        showToast(
          isReschedule
            ? "Permintaan ganti tanggal dikirim untuk persetujuan."
            : "Permintaan pembatalan dikirim untuk persetujuan.",
          "success"
        );
      }
      playClickSound();
      setLeaveActionState(null);
      setActionReason("");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const handleChangeDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changeDecisionState) return;
    if (
      changeDecisionState.decision === "approved" &&
      changeDecisionState.changeRequest.is_stale
    ) {
      showToast(
        "Perubahan sudah kedaluwarsa dan tidak dapat disetujui. Tolak permintaan agar reservasi saldo dilepas.",
        "warning"
      );
      return;
    }
    if (
      changeDecisionState.decision !== "approved" &&
      decisionNote.trim().length < 3
    ) {
      showToast("Alasan wajib diisi minimal 3 karakter.", "warning");
      return;
    }

    try {
      if (changeDecisionState.decision === "cancelled") {
        await cancelChangeMutation.mutateAsync({
          changeRequest: changeDecisionState.changeRequest,
          reason: decisionNote.trim(),
        });
        showToast("Permintaan perubahan dibatalkan.", "success");
      } else {
        await changeDecisionMutation.mutateAsync({
          changeRequest: changeDecisionState.changeRequest,
          decision: changeDecisionState.decision,
          note: decisionNote.trim(),
        });
        showToast(
          changeDecisionState.decision === "approved"
            ? "Perubahan cuti disetujui dan draft roster diselaraskan."
            : "Permintaan perubahan cuti ditolak.",
          "success"
        );
      }
      playClickSound();
      setChangeDecisionState(null);
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
  const approvalQueueCount =
    approvalRequests.filter((request) => request.status === "pending").length +
    pendingChangeRequests.length;

  const renderChangeRequestCard = (change: LiveLeaveChangeRequest) => (
    <article
      key={change.id}
      className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-100">
            {change.employee_name}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-sky-300">
            {change.change_type === "cancel"
              ? "Permintaan pembatalan cuti"
              : "Permintaan ganti tanggal"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {change.leave_type_name} · {change.old_starts_on} – {change.old_ends_on}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(
            change.status
          )}`}
        >
          {statusLabel(change.status)}
        </span>
      </div>
      {change.change_type === "reschedule" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Tanggal yang diusulkan
          </p>
          <p className="mt-1 text-xs font-bold text-amber-200">
            {change.proposed_starts_on} – {change.proposed_ends_on} ·{" "}
            {change.proposed_days ?? 0} hari
          </p>
        </div>
      )}
      <p className="rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
        {change.reason}
      </p>
      {change.reserved_delta_days > 0 && (
        <p className="text-[10px] text-amber-300">
          {change.reserved_delta_days} hari tambahan sedang direservasi sampai
          keputusan diberikan.
        </p>
      )}
      {change.is_stale && (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-200">
          Periode cuti asal sudah dimulai. Permintaan ini tidak dapat disetujui;
          tolak atau batalkan agar reservasi saldo dilepas.
        </p>
      )}
      {change.decision_note && (
        <p className="text-[11px] text-slate-400">
          Catatan: {change.decision_note}
        </p>
      )}
      {change.can_decide && (
        <div
          className={`grid gap-2 ${
            change.is_stale ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {!change.is_stale && (
            <button
              type="button"
              onClick={() => {
                setDecisionNote("");
                setChangeDecisionState({
                  changeRequest: change,
                  decision: "approved",
                });
              }}
              className="min-h-11 rounded-xl bg-amber-500 px-3 text-xs font-bold text-slate-950"
            >
              Setujui Perubahan
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDecisionNote("");
              setChangeDecisionState({
                changeRequest: change,
                decision: "rejected",
              });
            }}
            className="min-h-11 rounded-xl bg-rose-500/15 px-3 text-xs font-bold text-rose-300"
          >
            Tolak
          </button>
        </div>
      )}
      {change.can_cancel && !change.id.startsWith("optimistic:") && (
        <button
          type="button"
          onClick={() => {
            setDecisionNote("");
            setChangeDecisionState({
              changeRequest: change,
              decision: "cancelled",
            });
          }}
          className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-300"
        >
          Batalkan Permintaan Perubahan
        </button>
      )}
    </article>
  );

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

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-200">
              Saldo Cuti Tahunan Saya
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Tahun {annualBalance?.year ?? new Date().getFullYear()}
            </p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
            Akun aktif
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Tersedia", annualBalance?.available_days ?? 0],
            ["Terpakai", annualBalance?.used_days ?? 0],
            ["Direservasi", annualBalance?.reserved_days ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl bg-slate-950/70 p-2">
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
        </div>
      </section>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
        {[
          { id: "mine" as const, label: "Pengajuan Saya", show: true },
          {
            id: "approval" as const,
            label: `Persetujuan (${approvalQueueCount})`,
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

      {tab === "approval" && (
        <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
          Saldo di atas adalah milik akun Anda. Saldo pemohon ditampilkan pada
          masing-masing kartu persetujuan.
        </p>
      )}

      {tab === "approval" && pendingChangeRequests.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Permintaan Perubahan Cuti
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Pembatalan dan ganti tanggal approved memerlukan keputusan
              supervisor lain.
            </p>
          </div>
          {pendingChangeRequests.map(renderChangeRequestCard)}
        </section>
      )}

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
                  <p className="mt-1 text-[10px] font-semibold text-amber-300">
                    {leaveType.deducts_annual_balance
                      ? "Mengurangi saldo tahunan"
                      : "Tidak mengurangi saldo tahunan"}
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
          {visibleRequests.length === 0 &&
            !(tab === "approval" && pendingChangeRequests.length > 0) && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
              Belum ada pengajuan pada bagian ini.
            </div>
          )}
          {visibleRequests.map((request) => {
            const requestType = leaveTypesById.get(request.leave_type_id);
            const activeChange = openChangeByLeaveId.get(request.id);
            const requestBalance = balancesByEmployeeTypeYear.get(
              `${request.employee_id}:${request.leave_type_id}:${Number(
                request.starts_on.slice(0, 4)
              )}`
            );

            return (
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
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    requestType?.deducts_annual_balance
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  {requestType?.deducts_annual_balance
                    ? "Mengurangi saldo tahunan"
                    : "Tidak mengurangi saldo tahunan"}
                </span>
                {tab === "approval" &&
                  requestType?.deducts_annual_balance && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-[11px] font-bold text-slate-200">
                        Saldo {request.employee_name}
                      </p>
                      {requestBalance ? (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                          {[
                            ["Tersedia", requestBalance.available_days],
                            ["Terpakai", requestBalance.used_days],
                            ["Direservasi", requestBalance.reserved_days],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg bg-slate-950/70 p-2"
                            >
                              <p className="text-[9px] uppercase text-slate-500">
                                {label}
                              </p>
                              <p className="mt-1 text-sm font-black text-amber-300">
                                {value} hari
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[10px] text-rose-300">
                          Ledger saldo tahun pengajuan belum tersedia. Database
                          akan menolak persetujuan sampai saldo konsisten.
                        </p>
                      )}
                    </div>
                  )}
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
              {activeChange && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                  <p className="text-[11px] font-bold text-sky-200">
                    {activeChange.change_type === "cancel"
                      ? "Pembatalan menunggu persetujuan"
                      : "Ganti tanggal menunggu persetujuan"}
                  </p>
                  {activeChange.change_type === "reschedule" && (
                    <p className="mt-1 text-[10px] text-slate-300">
                      Usulan {activeChange.proposed_starts_on} –{" "}
                      {activeChange.proposed_ends_on}
                    </p>
                  )}
                  {activeChange.can_cancel &&
                    !activeChange.id.startsWith("optimistic:") && (
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionNote("");
                          setChangeDecisionState({
                            changeRequest: activeChange,
                            decision: "cancelled",
                          });
                        }}
                        className="mt-3 min-h-11 w-full rounded-lg border border-sky-500/20 bg-slate-950 px-3 text-xs font-semibold text-sky-200"
                      >
                        Batalkan Permintaan
                      </button>
                    )}
                </div>
              )}
              {(request.can_amend || request.can_cancel) && (
                <div
                  className={`grid gap-2 ${
                    request.can_amend && request.can_cancel
                      ? "grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {request.can_amend && (
                    <button
                      type="button"
                      onClick={() => openLeaveAction(request, "amend_pending")}
                      className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-bold text-amber-300"
                    >
                      Ubah Tanggal
                    </button>
                  )}
                  {request.can_cancel && (
                    <button
                      type="button"
                      onClick={() => openLeaveAction(request, "cancel_pending")}
                      className="min-h-11 rounded-xl bg-rose-500/15 px-3 text-xs font-bold text-rose-300"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              )}
              {request.can_request_change &&
                !activeChange &&
                !isManagement && (
                  <div
                    className={`grid gap-2 ${requestType?.is_active ? "grid-cols-2" : "grid-cols-1"}`}
                  >
                    {requestType?.is_active && (
                      <button
                        type="button"
                        onClick={() =>
                          openLeaveAction(request, "request_reschedule")
                        }
                        className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-bold text-amber-300"
                      >
                        Ganti Tanggal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openLeaveAction(request, "request_cancel")}
                      className="min-h-11 rounded-xl bg-rose-500/15 px-3 text-xs font-bold text-rose-300"
                    >
                      Ajukan Batal
                    </button>
                  </div>
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
            );
          })}
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
                subtext: `${
                  leaveType.deducts_annual_balance
                    ? "Mengurangi saldo tahunan"
                    : "Tidak mengurangi saldo tahunan"
                } · Minimal ${leaveType.minimum_notice_days} hari sebelumnya`,
              }))}
            value={leaveTypeId}
            onChange={setLeaveTypeId}
          />
          <DateRangePicker
            label="Periode"
            startDate={startsOn}
            endDate={endsOn}
            minDate={localDate(
              selectedType?.same_day_allowed
                ? 0
                : selectedType?.minimum_notice_days ?? 0
            )}
            onChange={(start, end) => {
              setStartsOn(start);
              setEndsOn(end);
            }}
          />
          {selectedType && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                selectedType.deducts_annual_balance
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {selectedType.deducts_annual_balance
                ? `${requestedDays} hari akan direservasi dari saldo Cuti Tahunan saat pengajuan dikirim.`
                : "Jenis ini tidak mengurangi saldo Cuti Tahunan."}
            </div>
          )}
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
        isOpen={Boolean(leaveActionState)}
        onClose={closeLeaveAction}
        title={
          leaveActionState?.kind === "amend_pending"
            ? "Ubah Tanggal Pengajuan"
            : leaveActionState?.kind === "cancel_pending"
              ? "Batalkan Pengajuan"
              : leaveActionState?.kind === "request_reschedule"
                ? "Ajukan Ganti Tanggal"
                : "Ajukan Pembatalan Cuti"
        }
        icon={
          leaveActionState?.kind === "cancel_pending" ||
          leaveActionState?.kind === "request_cancel"
            ? XCircle
            : CalendarDays
        }
      >
        <form
          onSubmit={handleLeaveAction}
          aria-busy={actionIsPending}
          className="space-y-4"
        >
          {actionRequest && (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs font-bold text-slate-100">
                {actionRequest.leave_type_name}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Saat ini: {actionRequest.starts_on} – {actionRequest.ends_on} ·{" "}
                {actionRequest.requested_days} hari
              </p>
            </div>
          )}
          {actionNeedsDates && (
            <DateRangePicker
              key={`${actionRequest?.id ?? "none"}:${leaveActionState?.kind ?? "none"}`}
              label="Tanggal baru"
              startDate={actionStartsOn}
              endDate={actionEndsOn}
              minDate={localDate(
                leaveActionState?.kind === "request_reschedule"
                  ? Math.max(
                      1,
                      actionLeaveType?.same_day_allowed
                        ? 1
                        : actionLeaveType?.minimum_notice_days ?? 1
                    )
                  : actionLeaveType?.same_day_allowed
                    ? 0
                    : actionLeaveType?.minimum_notice_days ?? 0
              )}
              disabled={actionIsPending}
              onChange={(start, end) => {
                setActionStartsOn(start);
                setActionEndsOn(end);
              }}
            />
          )}
          {actionLeaveType?.deducts_annual_balance && actionNeedsDates && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[10px] leading-relaxed text-amber-200">
              Cuti Tahunan hanya dapat dipindahkan dalam tahun yang sama.
              Durasi baru {actionProposedDays} hari.
              {actionReservedDelta > 0
                ? ` ${actionReservedDelta} hari tambahan akan direservasi sampai supervisor memutuskan.`
                : ""}
            </p>
          )}
          {actionProjection && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-bold text-slate-100">
                {leaveActionState?.kind === "amend_pending" ||
                leaveActionState?.kind === "cancel_pending"
                  ? "Dampak saldo setelah disimpan"
                  : "Proyeksi jika perubahan disetujui"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  [
                    "Tersedia",
                    actionProjection.availableBefore,
                    actionProjection.availableAfter,
                  ],
                  [
                    "Terpakai",
                    actionProjection.usedBefore,
                    actionProjection.usedAfter,
                  ],
                  [
                    "Direservasi",
                    actionProjection.reservedBefore,
                    actionProjection.reservedAfter,
                  ],
                ].map(([label, before, after]) => (
                  <div key={label} className="rounded-lg bg-slate-950/70 p-2">
                    <p className="text-[9px] uppercase text-slate-500">
                      {label}
                    </p>
                    <p
                      className={`mt-1 text-xs font-black ${
                        typeof after === "number" && after < 0
                          ? "text-rose-300"
                          : "text-amber-300"
                      }`}
                    >
                      {before} → {after}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(leaveActionState?.kind === "request_reschedule" ||
            leaveActionState?.kind === "request_cancel") && (
            <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-[10px] leading-relaxed text-sky-200">
              Perubahan baru berlaku setelah disetujui supervisor lain. Versi
              roster published tetap utuh; sistem menyiapkan draft koreksi dan
              notifikasi kebutuhan backup bila diperlukan.
            </p>
          )}
          <div className="space-y-1.5">
            <label
              htmlFor="leave-action-reason"
              className="text-xs font-medium text-slate-300"
            >
              Alasan perubahan
            </label>
            <textarea
              id="leave-action-reason"
              rows={3}
              required
              minLength={3}
              value={actionReason}
              disabled={actionIsPending}
              onChange={(event) => setActionReason(event.target.value)}
              placeholder="Jelaskan alasan pembatalan atau perubahan tanggal"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 disabled:opacity-60 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={actionIsPending}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-60 ${
              leaveActionState?.kind === "cancel_pending" ||
              leaveActionState?.kind === "request_cancel"
                ? "bg-rose-500 text-white"
                : "bg-amber-500 text-slate-950"
            }`}
          >
            {actionIsPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {leaveActionState?.kind === "amend_pending"
              ? "Simpan Tanggal Baru"
              : leaveActionState?.kind === "cancel_pending"
                ? "Batalkan Pengajuan"
                : "Kirim untuk Persetujuan"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(decisionState)}
        onClose={() => setDecisionState(null)}
        title={
          decisionState?.decision === "approved"
            ? "Setujui Cuti"
            : "Tolak Cuti"
        }
        icon={decisionState?.decision === "approved" ? CheckCircle2 : XCircle}
      >
        <form onSubmit={handleDecision} className="space-y-4">
          <p className="text-sm text-slate-300">
            {decisionState?.request.employee_name} ·{" "}
            {decisionState?.request.leave_type_name}
          </p>
          {decisionState && (
            <div
              className={`rounded-xl border p-3 ${
                decisionLeaveType?.deducts_annual_balance
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-slate-700 bg-slate-950"
              }`}
            >
              <p className="text-xs font-bold text-slate-100">
                {decisionLeaveType?.deducts_annual_balance
                  ? "Dampak pada saldo Cuti Tahunan"
                  : "Tidak mengurangi saldo Cuti Tahunan"}
              </p>
              {decisionProjection ? (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      [
                        "Tersedia",
                        decisionProjection.availableBefore,
                        decisionProjection.availableAfter,
                      ],
                      [
                        "Terpakai",
                        decisionProjection.usedBefore,
                        decisionProjection.usedAfter,
                      ],
                      [
                        "Direservasi",
                        decisionProjection.reservedBefore,
                        decisionProjection.reservedAfter,
                      ],
                    ].map(([label, before, after]) => (
                      <div key={label} className="rounded-lg bg-slate-950/70 p-2">
                        <p className="text-[9px] uppercase text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-xs font-black text-amber-300">
                          {before} → {after}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                    {decisionState.decision === "approved"
                      ? "Saldo tersedia sudah berkurang saat pengajuan direservasi. Persetujuan memindahkan hari ke Terpakai."
                      : "Hari yang direservasi akan dikembalikan ke saldo tersedia."}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  {decisionLeaveType?.deducts_annual_balance
                    ? "Ledger saldo tahun pengajuan belum tersedia. Persetujuan akan divalidasi oleh database."
                    : "Keputusan hanya mengubah status pengajuan dan ketersediaan pada roster."}
                </p>
              )}
            </div>
          )}
          <textarea
            aria-label="Catatan keputusan cuti"
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
            disabled={decisionMutation.isPending}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
          >
            Konfirmasi
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(changeDecisionState)}
        onClose={() => {
          if (cancelChangeMutation.isPending || changeDecisionMutation.isPending) {
            return;
          }
          setChangeDecisionState(null);
          setDecisionNote("");
        }}
        title={
          changeDecisionState?.decision === "approved"
            ? "Setujui Perubahan Cuti"
            : changeDecisionState?.decision === "rejected"
              ? "Tolak Perubahan Cuti"
              : "Batalkan Permintaan Perubahan"
        }
        icon={
          changeDecisionState?.decision === "approved"
            ? CheckCircle2
            : XCircle
        }
      >
        <form
          onSubmit={handleChangeDecision}
          aria-busy={
            cancelChangeMutation.isPending || changeDecisionMutation.isPending
          }
          className="space-y-4"
        >
          {changeDecision && (
            <>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-sm font-bold text-slate-100">
                  {changeDecision.employee_name}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {changeDecision.leave_type_name} ·{" "}
                  {changeDecision.change_type === "cancel"
                    ? "Pembatalan seluruh cuti"
                    : `${changeDecision.old_starts_on} – ${changeDecision.old_ends_on} menjadi ${changeDecision.proposed_starts_on} – ${changeDecision.proposed_ends_on}`}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  Alasan: {changeDecision.reason}
                </p>
              </div>
              {changeDecisionProjection && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-bold text-slate-100">
                    Dampak saldo jika disetujui
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      [
                        "Tersedia",
                        changeDecisionProjection.availableBefore,
                        changeDecisionProjection.availableAfter,
                      ],
                      [
                        "Terpakai",
                        changeDecisionProjection.usedBefore,
                        changeDecisionProjection.usedAfter,
                      ],
                      [
                        "Direservasi",
                        changeDecisionProjection.reservedBefore,
                        changeDecisionProjection.reservedAfter,
                      ],
                    ].map(([label, before, after]) => (
                      <div key={label} className="rounded-lg bg-slate-950/70 p-2">
                        <p className="text-[9px] uppercase text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-xs font-black text-amber-300">
                          {before} → {after}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {changeDecisionState?.decision === "approved" && (
                <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-[10px] leading-relaxed text-sky-200">
                  Database akan menyesuaikan saldo dan draft roster secara
                  atomik tanpa mengubah versi roster published.
                </p>
              )}
            </>
          )}
          <div className="space-y-1.5">
            <label
              htmlFor="leave-change-decision-note"
              className="text-xs font-medium text-slate-300"
            >
              {changeDecisionState?.decision === "approved"
                ? "Catatan (opsional)"
                : "Alasan (wajib)"}
            </label>
            <textarea
              id="leave-change-decision-note"
              rows={3}
              value={decisionNote}
              required={changeDecisionState?.decision !== "approved"}
              minLength={
                changeDecisionState?.decision === "approved" ? undefined : 3
              }
              disabled={
                cancelChangeMutation.isPending ||
                changeDecisionMutation.isPending
              }
              onChange={(event) => setDecisionNote(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 disabled:opacity-60 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={
              cancelChangeMutation.isPending ||
              changeDecisionMutation.isPending
            }
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-60 ${
              changeDecisionState?.decision === "approved"
                ? "bg-amber-500 text-slate-950"
                : "bg-rose-500 text-white"
            }`}
          >
            {(cancelChangeMutation.isPending ||
              changeDecisionMutation.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
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
