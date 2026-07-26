"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  Edit3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Send,
} from "lucide-react";
import { useHR } from "@/context/HRContext";
import {
  useActiveShiftTemplates,
  useCurrentAccessRole,
  useLiveOutlets,
} from "@/lib/master-data/queries";
import {
  useAcknowledgeMonthlyRoster,
  useDecideShiftSwapColleague,
  useDecideShiftSwapSupervisor,
  useMonthlyRoster,
  usePublishManualRoster,
  useRequestShiftSwap,
  useSaveManualRosterAssignment,
  useShiftSwapOptions,
} from "@/lib/roster/queries";
import type {
  RosterAssignment,
  RosterAssignmentType,
  RosterScheduleStatus,
  RosterShiftType,
  ShiftSwapRequest,
} from "@/lib/roster/repository";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

const monthStartFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

const dateFromInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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
};

const shiftStyles: Record<RosterShiftType, string> = {
  morning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  middle: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  night: "border-slate-600 bg-slate-800 text-slate-200",
  off: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

type DecisionTarget = {
  request: ShiftSwapRequest;
  actor: "colleague" | "supervisor";
  decision: "accept" | "reject" | "approve";
};

/**
 * Halaman roster Supabase untuk M3.
 *
 * Menampilkan matriks bulanan role-aware, menyimpan perubahan melalui RPC
 * versioned, mendukung off day/backup, publikasi, acknowledgement, dan
 * pertukaran shift tanpa menulis langsung ke tabel historis.
 */
export function LiveSchedulePage() {
  const { showToast } = useHR();
  const [monthStart, setMonthStart] = useState(() =>
    monthStartFromDate(new Date())
  );
  const [showEdit, setShowEdit] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [decisionTarget, setDecisionTarget] =
    useState<DecisionTarget | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState(monthStart);
  const [scheduleStatus, setScheduleStatus] =
    useState<RosterScheduleStatus>("scheduled");
  const [shiftType, setShiftType] =
    useState<Exclude<RosterShiftType, "off">>("morning");
  const [assignmentType, setAssignmentType] =
    useState<RosterAssignmentType>("primary");
  const [outletId, setOutletId] = useState("");
  const [borrowedOff, setBorrowedOff] = useState(false);
  const [sourceWeekStart, setSourceWeekStart] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [requesterScheduleId, setRequesterScheduleId] = useState("");
  const [colleagueScheduleId, setColleagueScheduleId] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const roleQuery = useCurrentAccessRole();
  const rosterQuery = useMonthlyRoster(monthStart);
  const outletsQuery = useLiveOutlets();
  const templatesQuery = useActiveShiftTemplates();
  const saveMutation = useSaveManualRosterAssignment(monthStart);
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
    setShiftType(
      assignment?.shift_type && assignment.shift_type !== "off"
        ? assignment.shift_type
        : "morning"
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
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId || !changeReason.trim()) {
      showToast("Pilih karyawan dan isi alasan perubahan.", "warning");
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
        warning ? `Jadwal tersimpan. ${warning}` : "Jadwal draft tersimpan.",
        warning ? "warning" : "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Jadwal belum dapat disimpan.",
        "warning"
      );
    }
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
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
              >
                <Edit3 className="h-4 w-4" />
                Atur Jadwal
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
                        const displayShift =
                          assignment?.shift_type ?? ("off" as const);
                        return (
                          <td key={day.value} className="p-1 text-center">
                            <button
                              type="button"
                              disabled={
                                !canManage ||
                                !row.id ||
                                !row.primaryOutletId
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
                              title={`${row.name}, ${day.value}`}
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
              }
            }}
          />
          <DatePicker
            label="Tanggal jadwal"
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
            onChange={(value) =>
              setScheduleStatus(value as RosterScheduleStatus)
            }
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
                onChange={setOutletId}
              />
              <Combobox
                label="Template shift"
                options={(templatesQuery.data ?? [])
                  .filter((template) => template.outlet_id === outletId)
                  .map((template) => ({
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
                    value as Exclude<RosterShiftType, "off">
                  )
                }
              />
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
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
                (assignment): assignment is RosterAssignment & { id: string } =>
                  Boolean(assignment.id) && assignment.status === "scheduled"
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

function SubmitActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
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
        disabled={pending}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
