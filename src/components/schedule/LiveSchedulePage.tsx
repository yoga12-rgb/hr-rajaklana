"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ClipboardCheck,
  Edit3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useHR } from "@/context/HRContext";
import {
  useActiveShiftTemplates,
  useCurrentAccessRole,
  useLiveOutlets,
} from "@/lib/master-data/queries";
import {
  useAcknowledgeMonthlyRoster,
  useBulkFillManualRoster,
  useDecideShiftSwapColleague,
  useDecideShiftSwapSupervisor,
  useGenerateAutomaticRoster,
  useMonthlyRoster,
  usePublishManualRoster,
  useRequestShiftSwap,
  useSaveManualRosterAssignment,
  useShiftSwapOptions,
} from "@/lib/roster/queries";
import type {
  AutomaticRosterGenerationResult,
  BulkRosterFillMode,
  RosterAssignment,
  RosterAssignmentType,
  RosterScheduleStatus,
  RosterShiftType,
  ShiftSwapRequest,
} from "@/lib/roster/repository";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Modal } from "@/components/ui/Modal";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

const monthStartFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

const dateFromInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const monthEndFromStart = (monthStart: string) => {
  const start = dateFromInput(monthStart);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(end.getDate()).padStart(2, "0")}`;
};

const addDaysToInput = (value: string, days: number) => {
  const date = dateFromInput(value);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const crossMonthOffLimit = (monthStart: string) => {
  const monthEnd = monthEndFromStart(monthStart);
  const endDate = dateFromInput(monthEnd);
  const daysUntilSunday = (7 - endDate.getDay()) % 7;
  return addDaysToInput(monthEnd, daysUntilSunday);
};

const monthDays = (monthStart: string) => {
  const start = dateFromInput(monthStart);
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), index + 1);
    return {
      value: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(index + 1).padStart(2, "0")}`,
      day: index + 1,
      weekday: new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
      }).format(date),
    };
  });
};

const shiftLabels: Record<RosterShiftType, string> = {
  morning: "Pagi",
  middle: "Middle",
  night: "Malam",
  off: "Off",
  leave: "Cuti",
};

const shiftStyles: Record<RosterShiftType, string> = {
  morning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  middle: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  night: "border-slate-600 bg-slate-800 text-slate-200",
  off: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  leave: "border-sky-500/25 bg-sky-500/10 text-sky-300",
};

type DecisionTarget = {
  request: ShiftSwapRequest;
  actor: "colleague" | "supervisor";
  decision: "accept" | "reject" | "approve";
};

/**
 * Halaman roster Supabase untuk M3 dan generator deterministik M7.
 *
 * Menampilkan matriks bulanan role-aware, menyimpan perubahan melalui RPC
 * versioned, mendukung off day/backup, publikasi, acknowledgement, dan
 * pertukaran shift, serta preview konflik/fairness roster otomatis tanpa
 * menulis langsung ke tabel historis.
 */
export function LiveSchedulePage() {
  const { showToast } = useHR();
  const [monthStart, setMonthStart] = useState(() =>
    monthStartFromDate(new Date())
  );
  const [showEdit, setShowEdit] = useState(false);
  const [showBulkFill, setShowBulkFill] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [decisionTarget, setDecisionTarget] =
    useState<DecisionTarget | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState(monthStart);
  const [scheduleStatus, setScheduleStatus] =
    useState<RosterScheduleStatus>("scheduled");
  const [shiftType, setShiftType] =
    useState<Exclude<RosterShiftType, "off" | "leave">>("morning");
  const [assignmentType, setAssignmentType] =
    useState<RosterAssignmentType>("primary");
  const [outletId, setOutletId] = useState("");
  const [borrowedOff, setBorrowedOff] = useState(false);
  const [sourceWeekStart, setSourceWeekStart] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [bulkEmployeeId, setBulkEmployeeId] = useState("all");
  const [bulkStartDate, setBulkStartDate] = useState(monthStart);
  const [bulkEndDate, setBulkEndDate] = useState(() =>
    monthEndFromStart(monthStart)
  );
  const [bulkShiftType, setBulkShiftType] =
    useState<Exclude<RosterShiftType, "off" | "leave">>("morning");
  const [bulkFillMode, setBulkFillMode] =
    useState<BulkRosterFillMode>("empty_only");
  const [bulkReason, setBulkReason] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [requesterScheduleId, setRequesterScheduleId] = useState("");
  const [colleagueScheduleId, setColleagueScheduleId] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [generationPreview, setGenerationPreview] =
    useState<AutomaticRosterGenerationResult | null>(null);

  const roleQuery = useCurrentAccessRole();
  const rosterQuery = useMonthlyRoster(monthStart);
  const outletsQuery = useLiveOutlets();
  const templatesQuery = useActiveShiftTemplates();
  const saveMutation = useSaveManualRosterAssignment();
  const bulkFillMutation = useBulkFillManualRoster(monthStart);
  const generateMutation = useGenerateAutomaticRoster(monthStart);
  const publishMutation = usePublishManualRoster(monthStart);
  const acknowledgeMutation = useAcknowledgeMonthlyRoster(monthStart);
  const requestSwapMutation = useRequestShiftSwap(monthStart);
  const colleagueDecisionMutation =
    useDecideShiftSwapColleague(monthStart);
  const supervisorDecisionMutation =
    useDecideShiftSwapSupervisor(monthStart);
  const swapOptionsQuery = useShiftSwapOptions(
    requesterScheduleId,
    showSwap && Boolean(requesterScheduleId)
  );

  const days = useMemo(() => monthDays(monthStart), [monthStart]);
  const monthEnd = useMemo(() => monthEndFromStart(monthStart), [monthStart]);
  const offDateLimit = useMemo(
    () => crossMonthOffLimit(monthStart),
    [monthStart]
  );
  const lastOwnerWeekDates = useMemo(() => {
    if (offDateLimit <= monthEnd) return [];
    const weekStart = addDaysToInput(offDateLimit, -6);
    return Array.from({ length: 7 }, (_, index) =>
      addDaysToInput(weekStart, index)
    );
  }, [monthEnd, offDateLimit]);
  const isCrossMonthOff =
    scheduleStatus === "off" && workDate > monthEnd;
  const roster = rosterQuery.data;
  const canManage = roleQuery.data === "supervisor";
  const isManagement = roleQuery.data === "management";
  const isPending =
    roleQuery.isPending ||
    rosterQuery.isPending ||
    outletsQuery.isPending ||
    templatesQuery.isPending;
  const queryError =
    roleQuery.error ??
    rosterQuery.error ??
    outletsQuery.error ??
    templatesQuery.error;

  const rows = useMemo(() => {
    if (roster?.employees.length) {
      return roster.employees.map((employee) => ({
        key: employee.id,
        id: employee.id,
        name: employee.name,
        detail: `${employee.position} · ${employee.primary_outlet_name}`,
        primaryOutletId: employee.primary_outlet_id,
      }));
    }

    return Array.from(
      new Map(
        (roster?.assignments ?? []).map((assignment) => [
          assignment.employee_name,
          {
            key: assignment.employee_name,
            id: null,
            name: assignment.employee_name,
            detail: assignment.outlet_name,
            primaryOutletId: null,
          },
        ])
      ).values()
    );
  }, [roster]);

  const assignmentsByCell = useMemo(
    () =>
      new Map(
        (roster?.assignments ?? []).map((assignment) => [
          `${assignment.employee_id ?? assignment.employee_name}:${assignment.work_date}`,
          assignment,
        ])
      ),
    [roster]
  );
  const availableShiftTemplates = useMemo(
    () =>
      (templatesQuery.data ?? []).filter(
        (template) => template.outlet_id === outletId
      ),
    [outletId, templatesQuery.data]
  );
  const hasSelectedShiftTemplate = availableShiftTemplates.some(
    (template) => template.shift_type === shiftType
  );

  const selectAvailableShift = (
    nextOutletId: string,
    preferredShift: Exclude<RosterShiftType, "off" | "leave"> = shiftType
  ) => {
    const outletTemplates = (templatesQuery.data ?? []).filter(
      (template) => template.outlet_id === nextOutletId
    );
    const nextShift = outletTemplates.some(
      (template) => template.shift_type === preferredShift
    )
      ? preferredShift
      : outletTemplates[0]?.shift_type;

    if (nextShift) {
      setShiftType(
        nextShift as Exclude<RosterShiftType, "off" | "leave">
      );
    }
  };

  const ownAssignments = (roster?.assignments ?? []).filter(
    (assignment) => assignment.is_own && assignment.id
  );
  const hasUnreadOwnSchedule = ownAssignments.some(
    (assignment) => !assignment.acknowledged
  );

  const openAssignment = (
    employeeId: string,
    date: string,
    primaryOutletId: string,
    assignment?: RosterAssignment
  ) => {
    playClickSound();
    setSelectedEmployeeId(employeeId);
    setWorkDate(date);
    setScheduleStatus(assignment?.status === "off" ? "off" : "scheduled");
    const preferredShift =
      assignment?.shift_type &&
      assignment.shift_type !== "off" &&
      assignment.shift_type !== "leave"
        ? assignment.shift_type
        : "morning";
    selectAvailableShift(
      assignment?.outlet_id ?? primaryOutletId,
      preferredShift
    );
    setAssignmentType(assignment?.assignment_type ?? "primary");
    setOutletId(assignment?.outlet_id ?? primaryOutletId);
    setBorrowedOff(false);
    setSourceWeekStart("");
    setChangeReason("");
    setShowEdit(true);
  };

  const handleMonthChange = (value: string) => {
    if (!value) return;
    const nextMonthStart = `${value}-01`;
    setMonthStart(nextMonthStart);
    setWorkDate(nextMonthStart);
    setBulkStartDate(nextMonthStart);
    setBulkEndDate(monthEndFromStart(nextMonthStart));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId) {
      showToast("Pilih karyawan yang akan dijadwalkan.", "warning");
      return;
    }
    if (changeReason.trim().length < 3) {
      showToast("Alasan perubahan minimal 3 karakter.", "warning");
      return;
    }
    if (scheduleStatus === "scheduled" && !outletId) {
      showToast("Pilih outlet untuk jadwal kerja.", "warning");
      return;
    }
    if (
      workDate < monthStart ||
      (scheduleStatus === "scheduled" && workDate > monthEnd) ||
      (scheduleStatus === "off" && workDate > offDateLimit)
    ) {
      showToast(
        scheduleStatus === "off"
          ? `Tanggal off untuk roster ini hanya dapat dipilih sampai ${offDateLimit}.`
          : "Tanggal kerja harus berada dalam bulan roster yang sedang dibuka.",
        "warning"
      );
      return;
    }
    if (scheduleStatus === "off" && borrowedOff && !sourceWeekStart) {
      showToast("Pilih hari Senin untuk pekan sumber off.", "warning");
      return;
    }
    if (
      scheduleStatus === "off" &&
      borrowedOff &&
      (dateFromInput(sourceWeekStart).getDay() !== 1 ||
        sourceWeekStart.slice(0, 7) !== monthStart.slice(0, 7))
    ) {
      showToast(
        "Pekan sumber harus hari Senin dan dimiliki bulan roster ini.",
        "warning"
      );
      return;
    }
    if (scheduleStatus === "scheduled" && !hasSelectedShiftTemplate) {
      showToast(
        "Buat template shift aktif untuk outlet ini melalui Pengaturan.",
        "warning"
      );
      return;
    }

    try {
      const result = await saveMutation.mutateAsync({
        monthStart,
        employeeId: selectedEmployeeId,
        workDate,
        outletId: scheduleStatus === "off" ? null : outletId,
        shiftType: scheduleStatus === "off" ? null : shiftType,
        status: scheduleStatus,
        assignmentType:
          scheduleStatus === "off" ? "primary" : assignmentType,
        reason: changeReason.trim(),
        sourceWeekStart:
          scheduleStatus === "off" && borrowedOff
            ? sourceWeekStart
            : null,
        borrowedFromAdjacentWeek:
          scheduleStatus === "off" && borrowedOff,
      });
      playSuccessHaptic();
      setShowEdit(false);
      const warning = result.warnings[0]?.message;
      showToast(
        result.carry_over
          ? warning ??
              "Off lintas bulan tersimpan dan akan dibaca roster bulan berikutnya."
          : warning
            ? `Jadwal tersimpan. ${warning}`
            : "Jadwal draft tersimpan.",
        warning ? "warning" : "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Jadwal belum dapat disimpan.",
        "warning"
      );
    }
  };

  const handleFixOffConflict = (
    conflict: AutomaticRosterGenerationResult["conflicts"][number]
  ) => {
    if (!conflict.employeeId || !conflict.date) return;
    const employee = rows.find((row) => row.id === conflict.employeeId);
    setSelectedEmployeeId(conflict.employeeId);
    setWorkDate(conflict.date);
    setScheduleStatus("off");
    setAssignmentType("primary");
    setOutletId(employee?.primaryOutletId ?? "");
    setBorrowedOff(false);
    setSourceWeekStart("");
    setChangeReason(`Atur jatah off pekan ${conflict.date}`);
    setShowGenerate(false);
    setShowEdit(true);
  };

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roster?.version?.id || !publishReason.trim()) return;

    try {
      const result = await publishMutation.mutateAsync({
        rosterVersionId: roster.version.id,
        reason: publishReason.trim(),
      });
      playSuccessHaptic();
      setShowPublish(false);
      setPublishReason("");
      showToast(
        `Roster versi ${result.version_number} berhasil dipublikasikan.`,
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Roster belum dapat dipublikasikan.",
        "warning"
      );
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const result = await generateMutation.mutateAsync();
      setGenerationPreview(result);
      if (result.resultStatus === "valid") {
        playSuccessHaptic();
        showToast(
          `Draft otomatis tersimpan: ${result.assignmentCount} penugasan.`,
          "success"
        );
      } else {
        showToast(
          `Roster belum diterapkan karena ada ${result.conflicts.length} konflik.`,
          "warning"
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Roster otomatis belum dapat dibuat.",
        "warning"
      );
    }
  };

  const openBulkFill = () => {
    playClickSound();
    setBulkEmployeeId("all");
    setBulkStartDate(monthStart);
    setBulkEndDate(monthEndFromStart(monthStart));
    setBulkShiftType("morning");
    setBulkFillMode("empty_only");
    setBulkReason("");
    setShowBulkFill(true);
  };

  const handleBulkFill = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      bulkStartDate < monthStart ||
      bulkEndDate > monthEndFromStart(monthStart) ||
      bulkStartDate > bulkEndDate
    ) {
      showToast("Rentang tanggal harus berada dalam bulan roster.", "warning");
      return;
    }
    if (bulkReason.trim().length < 3) {
      showToast("Alasan isi massal minimal 3 karakter.", "warning");
      return;
    }

    try {
      const result = await bulkFillMutation.mutateAsync({
        monthStart,
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        shiftType: bulkShiftType,
        fillMode: bulkFillMode,
        reason: bulkReason.trim(),
        employeeIds:
          bulkEmployeeId === "all" ? null : [bulkEmployeeId],
      });
      playSuccessHaptic();
      setShowBulkFill(false);
      showToast(
        `Isi massal selesai: ${result.created_count} dibuat, ${result.updated_count} diganti, ${result.skipped_count} dilewati.`,
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Jadwal massal belum dapat disimpan.",
        "warning"
      );
    }
  };

  const handleAcknowledge = async () => {
    try {
      await acknowledgeMutation.mutateAsync();
      playSuccessHaptic();
      showToast("Seluruh jadwal bulan ini ditandai sudah dibaca.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Status baca belum dapat disimpan.",
        "warning"
      );
    }
  };

  const handleRequestSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !requesterScheduleId ||
      !colleagueScheduleId ||
      !swapReason.trim()
    ) {
      showToast("Pilih dua jadwal dan isi alasan pertukaran.", "warning");
      return;
    }

    try {
      await requestSwapMutation.mutateAsync({
        requesterScheduleId,
        colleagueScheduleId,
        reason: swapReason.trim(),
      });
      playSuccessHaptic();
      setShowSwap(false);
      setColleagueScheduleId("");
      setSwapReason("");
      showToast("Permintaan dikirim kepada rekan kerja.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Permintaan belum dapat dikirim.",
        "warning"
      );
    }
  };

  const handleDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decisionTarget) return;

    try {
      if (decisionTarget.actor === "colleague") {
        await colleagueDecisionMutation.mutateAsync({
          requestId: decisionTarget.request.id,
          decision:
            decisionTarget.decision === "accept" ? "accept" : "reject",
          note: decisionNote.trim(),
        });
      } else {
        await supervisorDecisionMutation.mutateAsync({
          requestId: decisionTarget.request.id,
          decision:
            decisionTarget.decision === "approve" ? "approve" : "reject",
          note: decisionNote.trim(),
        });
      }
      playSuccessHaptic();
      setDecisionTarget(null);
      setDecisionNote("");
      showToast("Keputusan pertukaran shift berhasil disimpan.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Keputusan belum dapat disimpan.",
        "warning"
      );
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
        <LoaderCircle className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
      >
        {queryError.message}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Jadwal Kerja & Roster
          </h1>
          <p className="text-xs text-slate-400">
            Draft bulanan, off day, backup outlet, dan versi publikasi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            <span className="sr-only">Pilih bulan roster</span>
            <input
              type="month"
              value={monthStart.slice(0, 7)}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="bg-transparent font-semibold text-slate-100 outline-none"
            />
          </label>
          <span className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase text-amber-300">
            {roster?.version
              ? `v${roster.version.version_number} · ${roster.version.status}`
              : "Belum ada draft"}
          </span>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setGenerationPreview(null);
                  setShowGenerate(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
              >
                <Sparkles className="h-4 w-4" />
                Buat Otomatis
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = rows[0];
                  if (!first?.id || !first.primaryOutletId) {
                    showToast(
                      "Belum ada karyawan dengan penempatan aktif.",
                      "warning"
                    );
                    return;
                  }
                  openAssignment(
                    first.id,
                    monthStart,
                    first.primaryOutletId
                  );
                }}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
              >
                <Edit3 className="h-4 w-4" />
                Atur Jadwal
              </button>
              <button
                type="button"
                onClick={openBulkFill}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
              >
                <CalendarRange className="h-4 w-4" />
                Isi Massal
              </button>
              {roster?.version?.status === "draft" && (
                <button
                  type="button"
                  onClick={() => setShowPublish(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
                >
                  <Send className="h-4 w-4" />
                  Publikasikan
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isManagement && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
          Manajemen memiliki akses baca. Seluruh mutasi tetap dibatasi untuk
          supervisor.
        </div>
      )}

      {!canManage && hasUnreadOwnSchedule && (
        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={acknowledgeMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-200 disabled:opacity-50"
        >
          {acknowledgeMutation.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          Tandai Jadwal Saya Sudah Dibaca
        </button>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-100">
              Matriks Bulanan
            </h2>
          </div>
          <span className="text-[10px] text-slate-400">
            {rows.length} karyawan · {days.length} hari
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            {roster?.period
              ? "Belum ada jadwal pada versi yang dapat dilihat."
              : "Belum ada periode roster untuk bulan ini."}
          </div>
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="min-w-max border-collapse text-left text-xs">
              <thead className="sticky top-0 z-30">
                <tr className="bg-slate-900">
                  <th className="sticky left-0 z-40 min-w-40 border-b border-r border-slate-800 bg-slate-900 p-3 text-[10px] uppercase text-slate-400">
                    Karyawan
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.value}
                      className="min-w-12 border-b border-slate-800 p-2 text-center"
                    >
                      <span className="block text-[9px] text-slate-500">
                        {day.weekday}
                      </span>
                      <span className="font-bold text-slate-200">{day.day}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.key}>
                    <tr className="border-b border-slate-800/70">
                      <td className="sticky left-0 z-20 max-w-48 border-r border-slate-800 bg-slate-950 p-3">
                        <p className="truncate font-bold text-slate-100">
                          {row.name}
                        </p>
                        <p className="truncate text-[9px] text-slate-500">
                          {row.detail}
                        </p>
                      </td>
                      {days.map((day) => {
                        const assignment = assignmentsByCell.get(
                          `${row.id ?? row.name}:${day.value}`
                        );
                        const displayShift: RosterShiftType =
                          assignment?.status === "leave"
                            ? "leave"
                            : assignment?.shift_type ?? "off";
                        return (
                          <td key={day.value} className="p-1 text-center">
                            <button
                              type="button"
                              disabled={
                                !canManage ||
                                !row.id ||
                                !row.primaryOutletId ||
                                assignment?.status === "leave"
                              }
                              onClick={() =>
                                row.id &&
                                row.primaryOutletId &&
                                openAssignment(
                                  row.id,
                                  day.value,
                                  row.primaryOutletId,
                                  assignment
                                )
                              }
                              title={
                                assignment?.status === "leave"
                                  ? `${row.name}, ${day.value}: cuti disetujui`
                                  : `${row.name}, ${day.value}`
                              }
                              className={`w-full rounded-md border px-1 py-1.5 text-[9px] font-bold disabled:cursor-default ${
                                assignment
                                  ? shiftStyles[displayShift]
                                  : "border-slate-800 bg-slate-950 text-slate-600"
                              }`}
                            >
                              {assignment ? shiftLabels[displayShift] : "—"}
                              {assignment?.assignment_type === "backup" && (
                                <MapPin className="mx-auto mt-0.5 h-2.5 w-2.5" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!canManage && ownAssignments.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100">
                Pertukaran Shift
              </h2>
              <p className="text-[10px] text-slate-400">
                Hanya antarkasir dalam outlet yang sama.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRequesterScheduleId(ownAssignments[0]?.id ?? "");
                setShowSwap(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
            >
              <RefreshCw className="h-4 w-4" />
              Ajukan
            </button>
          </div>
        </div>
      )}

      {(roster?.swap_requests ?? []).length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-xs font-bold text-slate-100">
            Status Pertukaran Shift
          </h2>
          {roster?.swap_requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {request.requester_name} ↔ {request.colleague_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {request.reason} · {request.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  {request.status === "pending_colleague" &&
                    request.is_colleague && (
                      <>
                        <DecisionButton
                          label="Tolak"
                          onClick={() => {
                            setDecisionNote("Tidak dapat bertukar shift");
                            setDecisionTarget({
                              request,
                              actor: "colleague",
                              decision: "reject",
                            });
                          }}
                        />
                        <DecisionButton
                          label="Setujui"
                          primary
                          onClick={() => {
                            setDecisionNote("Saya menyetujui pertukaran shift");
                            setDecisionTarget({
                              request,
                              actor: "colleague",
                              decision: "accept",
                            });
                          }}
                        />
                      </>
                    )}
                  {canManage && request.status === "pending_supervisor" && (
                    <>
                      <DecisionButton
                        label="Tolak"
                        onClick={() => {
                          setDecisionNote("Pertukaran belum dapat disetujui");
                          setDecisionTarget({
                            request,
                            actor: "supervisor",
                            decision: "reject",
                          });
                        }}
                      />
                      <DecisionButton
                        label="Setujui"
                        primary
                        onClick={() => {
                          setDecisionNote(
                            "Pertukaran valid dan kebutuhan operasional terpenuhi"
                          );
                          setDecisionTarget({
                            request,
                            actor: "supervisor",
                            decision: "approve",
                          });
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showGenerate}
        onClose={() =>
          !generateMutation.isPending && setShowGenerate(false)
        }
        title="Buat Roster Otomatis"
        icon={Sparkles}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
            Sistem membaca penempatan efektif, off day, cuti disetujui,
            kebutuhan staf, dan template shift aktif. Perubahan manual pada
            draft dipertahankan sebagai jadwal terkunci; perpindahan outlet
            tetap dilakukan manual sebagai backup.
          </div>

          {generationPreview && (
            <div className="space-y-4" aria-live="polite">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <GenerationMetric
                  label="Hasil"
                  value={
                    generationPreview.resultStatus === "valid"
                      ? "Draft tersimpan"
                      : "Perlu diperbaiki"
                  }
                />
                <GenerationMetric
                  label="Penugasan"
                  value={String(generationPreview.assignmentCount)}
                />
                <GenerationMetric
                  label="Skor fairness"
                  value={generationPreview.fairnessScore.toFixed(1)}
                />
                <GenerationMetric
                  label="Durasi"
                  value={`${generationPreview.elapsedMs} ms`}
                />
              </div>

              {generationPreview.resultStatus === "valid" ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  Draft berhasil diterapkan. Periksa matriks, lakukan koreksi
                  manual bila perlu, lalu publikasikan roster.
                </div>
              ) : (
                <div
                  role="alert"
                  className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-200">
                    <TriangleAlert className="h-4 w-4" />
                    {generationPreview.conflicts.length} konflik ditemukan;
                    jadwal lama tidak diubah.
                  </div>
                  <div className="max-h-52 space-y-2 overflow-y-auto">
                    {generationPreview.conflicts
                      .slice(0, 12)
                      .map((conflict, index) => (
                        <div
                          key={`${conflict.code}:${conflict.date ?? "all"}:${index}`}
                          className="rounded-lg border border-rose-500/20 bg-slate-950/60 p-2.5"
                        >
                          <p className="text-xs font-semibold text-slate-100">
                            {conflict.description}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {conflict.code}
                            {conflict.date ? ` · ${conflict.date}` : ""}
                          </p>
                          {conflict.suggestions[0] && (
                            <p className="mt-1 text-[10px] text-rose-200">
                              Saran: {conflict.suggestions[0]}
                            </p>
                          )}
                          {conflict.code === "off_entitlement_mismatch" &&
                            conflict.employeeId &&
                            conflict.date && (
                              <button
                                type="button"
                                onClick={() => handleFixOffConflict(conflict)}
                                className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
                              >
                                Atur off pekan ini
                              </button>
                            )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {generationPreview.resultStatus === "valid" &&
                generationPreview.conflicts.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                      <TriangleAlert className="h-4 w-4" />
                      Peringatan operasional
                    </div>
                    {generationPreview.conflicts.map((conflict, index) => (
                      <div
                        key={`${conflict.code}:${conflict.date ?? "all"}:${index}`}
                        className="rounded-lg border border-amber-500/15 bg-slate-950/50 p-2.5"
                      >
                        <p className="text-xs font-semibold text-slate-100">
                          {conflict.description}
                        </p>
                        {conflict.suggestions[0] && (
                          <p className="mt-1 text-[10px] text-amber-200">
                            Saran: {conflict.suggestions[0]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {generationPreview.fairnessDetails.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Scale className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-slate-100">
                      Ringkasan pemerataan
                    </h3>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {generationPreview.fairnessDetails.map((detail) => (
                      <div
                        key={detail.employeeId}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2"
                      >
                        <div>
                          <p className="text-[11px] font-semibold text-slate-200">
                            {rows.find((row) => row.id === detail.employeeId)
                              ?.name ?? detail.employeeId}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            Pagi {detail.morningCount} · Middle{" "}
                            {detail.middleCount} · Malam {detail.nightCount} ·
                            Off dalam bulan {detail.offCount}
                          </p>
                        </div>
                        <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
                          {detail.fairnessScore.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SubmitActions
            pending={generateMutation.isPending}
            onCancel={() => setShowGenerate(false)}
            submitLabel={
              generationPreview ? "Jalankan Ulang" : "Buat Draft Otomatis"
            }
          />
        </form>
      </Modal>

      <Modal
        isOpen={showEdit}
        onClose={() => !saveMutation.isPending && setShowEdit(false)}
        title="Atur Jadwal Manual"
        icon={Edit3}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Combobox
            label="Karyawan"
            options={rows
              .filter((row): row is typeof row & { id: string } =>
                Boolean(row.id)
              )
              .map((row) => ({
                value: row.id,
                label: row.name,
                subtext: row.detail,
              }))}
            value={selectedEmployeeId}
            onChange={(value) => {
              setSelectedEmployeeId(value);
              const employee = rows.find((row) => row.id === value);
              if (employee?.primaryOutletId) {
                setOutletId(employee.primaryOutletId);
                selectAvailableShift(employee.primaryOutletId);
              }
            }}
          />
          <DatePicker
            label={scheduleStatus === "off" ? "Tanggal off" : "Tanggal jadwal"}
            value={workDate}
            onChange={setWorkDate}
          />
          <Combobox
            label="Status hari"
            options={[
              {
                value: "scheduled",
                label: "Jadwal Kerja",
                subtext: "Gunakan template shift outlet",
              },
              {
                value: "off",
                label: "Off / Libur",
                subtext: "Dicatat pada ledger jatah off",
              },
            ]}
            value={scheduleStatus}
            onChange={(value) => {
              const nextStatus = value as RosterScheduleStatus;
              setScheduleStatus(nextStatus);
              if (nextStatus === "scheduled") {
                selectAvailableShift(outletId);
              }
            }}
          />

          {scheduleStatus === "scheduled" ? (
            <>
              <Combobox
                label="Jenis penugasan"
                options={[
                  {
                    value: "primary",
                    label: "Outlet Utama",
                    subtext: "Mengikuti penempatan aktif",
                  },
                  {
                    value: "backup",
                    label: "Backup Outlet",
                    subtext: "Geofence sementara pada tanggal ini",
                  },
                ]}
                value={assignmentType}
                onChange={(value) =>
                  setAssignmentType(value as RosterAssignmentType)
                }
              />
              <Combobox
                label="Outlet"
                options={(outletsQuery.data ?? []).map((outlet) => ({
                  value: outlet.id,
                  label: outlet.name,
                  subtext: outlet.code,
                }))}
                value={outletId}
                onChange={(value) => {
                  setOutletId(value);
                  selectAvailableShift(value);
                }}
              />
              {availableShiftTemplates.length > 0 ? (
                <Combobox
                  label="Template shift"
                  options={availableShiftTemplates.map((template) => ({
                    value: template.shift_type,
                    label: shiftLabels[template.shift_type],
                    subtext: `${template.starts_at.slice(
                      0,
                      5
                    )}–${template.ends_at.slice(0, 5)}`,
                  }))}
                  value={shiftType}
                  onChange={(value) =>
                    setShiftType(
                      value as Exclude<RosterShiftType, "off" | "leave">
                    )
                  }
                />
              ) : (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"
                >
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div className="space-y-1.5">
                      <p className="font-bold">
                        Outlet ini belum memiliki template shift aktif.
                      </p>
                      <p className="leading-relaxed text-amber-100/80">
                        Buat template Pagi, Middle, dan Malam melalui Pengaturan
                        → Jam Kerja & Presensi.
                      </p>
                      <Link
                        href="/settings"
                        className="inline-flex font-bold text-amber-300 underline underline-offset-2"
                      >
                        Buka Pengaturan
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-100">
                Pekan dimiliki bulan tempat hari Seninnya berada. Untuk roster
                ini, off pekan terakhir boleh dipilih sampai{" "}
                <span className="font-bold">{offDateLimit}</span>.
                {isCrossMonthOff &&
                  " Tanggal ini tetap memakai jatah bulan yang sedang dibuka dan akan muncul otomatis saat roster bulan berikutnya dibuat."}
              </div>
              {lastOwnerWeekDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Pilih cepat off pekan terakhir
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {lastOwnerWeekDates.map((date) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setWorkDate(date)}
                        aria-pressed={workDate === date}
                        className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                          workDate === date
                            ? "border-amber-500 bg-amber-500 text-slate-950"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-500/40"
                        }`}
                      >
                        <span className="block text-[9px] font-medium">
                          {new Intl.DateTimeFormat("id-ID", {
                            weekday: "short",
                          }).format(dateFromInput(date))}
                        </span>
                        <span className="block text-[10px] font-bold">
                          {new Intl.DateTimeFormat("id-ID", {
                            day: "numeric",
                            month: "short",
                          }).format(dateFromInput(date))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={borrowedOff}
                  onChange={(event) => setBorrowedOff(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Ambil jatah off dari pekan bersebelahan
              </label>
              {borrowedOff && (
                <DatePicker
                  label="Tanggal Senin pekan sumber"
                  value={sourceWeekStart}
                  onChange={setSourceWeekStart}
                />
              )}
            </div>
          )}

          <label className="block space-y-1 text-xs text-slate-300">
            <span>Alasan perubahan</span>
            <textarea
              rows={3}
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </label>
          <SubmitActions
            pending={saveMutation.isPending}
            disabled={
              scheduleStatus === "scheduled" && !hasSelectedShiftTemplate
            }
            onCancel={() => setShowEdit(false)}
            submitLabel="Simpan Draft"
          />
        </form>
      </Modal>

      <Modal
        isOpen={showPublish}
        onClose={() => !publishMutation.isPending && setShowPublish(false)}
        title="Publikasikan Roster"
        icon={CalendarCheck2}
      >
        <form onSubmit={handlePublish} className="space-y-4">
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
            Database akan memeriksa kelengkapan satu bulan, jatah off, batas
            Middle, serta pola Pagi sebelum off dan Malam setelah off.
          </p>
          <textarea
            rows={3}
            value={publishReason}
            onChange={(event) => setPublishReason(event.target.value)}
            placeholder="Ringkasan dan alasan publikasi"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
          <SubmitActions
            pending={publishMutation.isPending}
            onCancel={() => setShowPublish(false)}
            submitLabel="Publikasikan"
          />
        </form>
      </Modal>

      <Modal
        isOpen={showBulkFill}
        onClose={() =>
          !bulkFillMutation.isPending && setShowBulkFill(false)
        }
        title="Isi Jadwal Massal"
        icon={CalendarRange}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleBulkFill} className="space-y-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
            Isi massal membuat jadwal kerja dasar di outlet utama. Off day,
            backup outlet, serta pola Pagi sebelum off dan Malam setelah off
            tetap diatur melalui matriks.
          </div>

          <Combobox
            label="Cakupan karyawan"
            options={[
              {
                value: "all",
                label: "Semua kasir & supervisor aktif",
                subtext: "Hanya akun yang memenuhi syarat roster",
              },
              ...rows
                .filter((row): row is typeof row & { id: string } =>
                  Boolean(row.id)
                )
                .map((row) => ({
                  value: row.id,
                  label: row.name,
                  subtext: row.detail,
                })),
            ]}
            value={bulkEmployeeId}
            onChange={setBulkEmployeeId}
          />

          <DateRangePicker
            label="Rentang tanggal"
            startDate={bulkStartDate}
            endDate={bulkEndDate}
            onChange={(startDate, endDate) => {
              setBulkStartDate(startDate);
              setBulkEndDate(endDate);
            }}
          />

          <Combobox
            label="Shift dasar"
            options={[
              {
                value: "morning",
                label: "Pagi",
                subtext: "Template Pagi outlet utama",
              },
              {
                value: "middle",
                label: "Middle",
                subtext: "Template Middle outlet utama",
              },
              {
                value: "night",
                label: "Malam",
                subtext: "Template Malam outlet utama",
              },
            ]}
            value={bulkShiftType}
            onChange={(value) =>
              setBulkShiftType(
                value as Exclude<RosterShiftType, "off" | "leave">
              )
            }
          />

          <Combobox
            label="Perlakuan jadwal lama"
            options={[
              {
                value: "empty_only",
                label: "Hanya isi sel kosong",
                subtext: "Pilihan aman; jadwal yang sudah ada dipertahankan",
              },
              {
                value: "replace",
                label: "Ganti seluruh rentang",
                subtext: "Menimpa jadwal kerja yang sudah ada",
              },
            ]}
            value={bulkFillMode}
            onChange={(value) =>
              setBulkFillMode(value as BulkRosterFillMode)
            }
          />

          {bulkFillMode === "replace" && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Jadwal pada rentang ini akan diganti secara atomik. Off day yang
              sudah ada juga akan berubah menjadi jadwal kerja.
            </div>
          )}

          <label className="block space-y-1 text-xs text-slate-300">
            <span>Alasan isi massal</span>
            <textarea
              rows={3}
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              placeholder="Contoh: Mengisi jadwal dasar bulan ini"
              minLength={3}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            />
          </label>

          <SubmitActions
            pending={bulkFillMutation.isPending}
            onCancel={() => setShowBulkFill(false)}
            submitLabel={
              bulkFillMode === "replace"
                ? "Ganti Jadwal"
                : "Isi Sel Kosong"
            }
          />
        </form>
      </Modal>

      <Modal
        isOpen={showSwap}
        onClose={() => !requestSwapMutation.isPending && setShowSwap(false)}
        title="Ajukan Tukar Shift"
        icon={RefreshCw}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleRequestSwap} className="space-y-4">
          <Combobox
            label="Jadwal saya"
            options={ownAssignments
              .filter(
                (
                  assignment
                ): assignment is RosterAssignment & {
                  id: string;
                  shift_type: Exclude<RosterShiftType, "off" | "leave">;
                } =>
                  Boolean(assignment.id) &&
                  assignment.status === "scheduled" &&
                  assignment.shift_type !== null &&
                  assignment.shift_type !== "off" &&
                  assignment.shift_type !== "leave"
              )
              .map((assignment) => ({
                value: assignment.id,
                label: new Intl.DateTimeFormat("id-ID", {
                  day: "numeric",
                  month: "short",
                }).format(dateFromInput(assignment.work_date)),
                subtext: `${shiftLabels[assignment.shift_type]} · ${assignment.outlet_name}`,
              }))}
            value={requesterScheduleId}
            onChange={(value) => {
              setRequesterScheduleId(value);
              setColleagueScheduleId("");
            }}
          />
          <Combobox
            label="Jadwal rekan"
            options={(swapOptionsQuery.data ?? []).map((option) => ({
              value: option.schedule_id,
              label: option.employee_name,
              subtext: `${option.work_date} · ${shiftLabels[option.shift_type]}`,
            }))}
            value={colleagueScheduleId}
            onChange={setColleagueScheduleId}
            placeholder={
              swapOptionsQuery.isPending
                ? "Memuat jadwal rekan…"
                : "Pilih jadwal rekan"
            }
          />
          <textarea
            rows={3}
            value={swapReason}
            onChange={(event) => setSwapReason(event.target.value)}
            placeholder="Alasan pertukaran shift"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
          <SubmitActions
            pending={requestSwapMutation.isPending}
            onCancel={() => setShowSwap(false)}
            submitLabel="Kirim Permintaan"
          />
        </form>
      </Modal>

      <Modal
        isOpen={decisionTarget !== null}
        onClose={() => {
          if (
            !colleagueDecisionMutation.isPending &&
            !supervisorDecisionMutation.isPending
          ) {
            setDecisionTarget(null);
          }
        }}
        title="Keputusan Tukar Shift"
        icon={ClipboardCheck}
      >
        <form onSubmit={handleDecision} className="space-y-4">
          <p className="text-xs text-slate-300">
            {decisionTarget?.request.requester_name} ↔{" "}
            {decisionTarget?.request.colleague_name}
          </p>
          <textarea
            rows={3}
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required={decisionTarget?.actor === "supervisor"}
          />
          <SubmitActions
            pending={
              colleagueDecisionMutation.isPending ||
              supervisorDecisionMutation.isPending
            }
            onCancel={() => setDecisionTarget(null)}
            submitLabel="Simpan Keputusan"
          />
        </form>
      </Modal>
    </div>
  );
}

function DecisionButton({
  label,
  primary = false,
  onClick,
}: {
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-bold text-slate-950"
          : "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-300"
      }
    >
      {label}
    </button>
  );
}

function GenerationMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-100">{value}</p>
    </div>
  );
}

function SubmitActions({
  pending,
  disabled = false,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  disabled?: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
