export type OptimizerShift = "morning" | "middle" | "night";

export interface OptimizerOffDay {
  date: string;
  sourceWeekStart?: string;
}

export interface OptimizerLockedAssignment {
  date: string;
  outletId: string;
  shift: OptimizerShift;
  isBackup?: boolean;
  backupReason?: string;
}

export interface OptimizerPlacement {
  outletId: string;
  startDate: string;
  endDate?: string;
}

export interface OptimizerEmployee {
  id: string;
  name: string;
  primaryOutletId: string;
  activeFrom?: string;
  activeUntil?: string;
  placements?: OptimizerPlacement[];
  offDays: OptimizerOffDay[];
  leaveDates?: string[];
  lockedAssignments?: OptimizerLockedAssignment[];
}

export interface OptimizerStaffingRequirement {
  cashierCount: number;
  shift: OptimizerShift;
  minimumStaff: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface OptimizerOutlet {
  id: string;
  name: string;
  availableShifts: OptimizerShift[];
  staffingRequirements?: OptimizerStaffingRequirement[];
}

export interface RosterOptimizerInput {
  monthStart: string;
  seed: string;
  employees: OptimizerEmployee[];
  outlets: OptimizerOutlet[];
}

export interface OptimizerAssignment {
  employeeId: string;
  employeeName: string;
  date: string;
  outletId: string;
  shift: OptimizerShift | "off" | "leave";
  assignmentType: "primary" | "backup";
  source: "generated" | "locked" | "off" | "leave";
  backupReason?: string;
}

export interface OptimizerConflict {
  code: string;
  severity: "blocking" | "warning";
  description: string;
  date?: string;
  outletId?: string;
  employeeId?: string;
  suggestions: string[];
}

export interface OptimizerFairnessDetail {
  employeeId: string;
  morningCount: number;
  middleCount: number;
  nightCount: number;
  offCount: number;
  pairingCounts: Record<string, number>;
  fairnessScore: number;
}

export interface RosterOptimizerResult {
  status: "valid" | "invalid";
  algorithmVersion: "deterministic-matching-v1";
  seed: string;
  assignments: OptimizerAssignment[];
  conflicts: OptimizerConflict[];
  fairnessScore: number;
  fairnessDetails: OptimizerFairnessDetail[];
  ruleSnapshot: {
    monthStart: string;
    seed: string;
    hardConstraints: string[];
    warningRules: string[];
    weights: {
      morningNightImbalance: number;
      middleDistribution: number;
      pairingSpread: number;
    };
  };
}

interface ShiftTarget {
  morning: number;
  middle: number;
  night: number;
  configured: boolean;
}

interface DayContext {
  date: string;
  outlet: OptimizerOutlet;
  employeeIds: string[];
  target: ShiftTarget;
}

const ALGORITHM_VERSION = "deterministic-matching-v1" as const;
const FAIRNESS_WEIGHTS = {
  morningNightImbalance: 4,
  middleDistribution: 4,
  pairingSpread: 2,
} as const;

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDate(date);
}

function daysBetween(left: string, right: string) {
  return Math.round(
    (parseDate(right).getTime() - parseDate(left).getTime()) / 86_400_000
  );
}

function weekStart(value: string) {
  const date = parseDate(value);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return toDate(date);
}

function monthEnd(monthStart: string) {
  const date = parseDate(monthStart);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return toDate(date);
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function activeOn(employee: OptimizerEmployee, date: string) {
  return (
    (!employee.activeFrom || employee.activeFrom <= date) &&
    (!employee.activeUntil || employee.activeUntil >= date)
  );
}

function primaryOutletsOn(employee: OptimizerEmployee, date: string) {
  if (!employee.placements?.length) return [employee.primaryOutletId];

  return employee.placements
    .filter(
      (placement) =>
        placement.startDate <= date &&
        (!placement.endDate || placement.endDate >= date)
    )
    .sort(
      (left, right) =>
        right.startDate.localeCompare(left.startDate) ||
        left.outletId.localeCompare(right.outletId)
    )
    .map((placement) => placement.outletId);
}

function primaryOutletOn(employee: OptimizerEmployee, date: string) {
  return primaryOutletsOn(employee, date)[0];
}

function seededRank(seed: string, ...parts: string[]) {
  const value = `${seed}:${parts.join(":")}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function assignmentKey(employeeId: string, date: string) {
  return `${employeeId}:${date}`;
}

function outletDateKey(outletId: string, date: string) {
  return `${outletId}:${date}`;
}

function outletWeekKey(outletId: string, date: string) {
  return `${outletId}:${weekStart(date)}`;
}

function defaultTarget(cashierCount: number): ShiftTarget {
  if (cashierCount <= 0) {
    return { morning: 0, middle: 0, night: 0, configured: false };
  }
  if (cashierCount === 1) {
    return { morning: 1, middle: 0, night: 0, configured: false };
  }
  if (cashierCount === 2) {
    return { morning: 1, middle: 0, night: 1, configured: false };
  }
  if (cashierCount === 3) {
    return { morning: 1, middle: 1, night: 1, configured: false };
  }

  const morning = Math.ceil(cashierCount / 2);
  return {
    morning,
    middle: 0,
    night: cashierCount - morning,
    configured: false,
  };
}

function targetFor(
  outlet: OptimizerOutlet,
  date: string,
  cashierCount: number
) {
  const matching = (outlet.staffingRequirements ?? []).filter(
    (requirement) =>
      requirement.cashierCount === cashierCount &&
      (!requirement.effectiveFrom || requirement.effectiveFrom <= date) &&
      (!requirement.effectiveUntil || requirement.effectiveUntil >= date)
  );
  if (matching.length === 0) return defaultTarget(cashierCount);

  return matching.reduce<ShiftTarget>(
    (target, requirement) => ({
      ...target,
      [requirement.shift]:
        target[requirement.shift] + requirement.minimumStaff,
    }),
    { morning: 0, middle: 0, night: 0, configured: true }
  );
}

function addConflict(
  conflicts: OptimizerConflict[],
  conflict: Omit<OptimizerConflict, "severity" | "suggestions"> & {
    severity?: OptimizerConflict["severity"];
    suggestions?: string[];
  }
) {
  conflicts.push({
    severity: conflict.severity ?? "blocking",
    suggestions: conflict.suggestions ?? [],
    ...conflict,
  });
}

function numericRecord() {
  return { morning: 0, middle: 0, night: 0 } satisfies Record<
    OptimizerShift,
    number
  >;
}

function validateOptimizerInput(input: RosterOptimizerInput) {
  if (
    !/^\d{4}-\d{2}-01$/.test(input.monthStart) ||
    toDate(parseDate(input.monthStart)) !== input.monthStart
  ) {
    throw new Error("monthStart harus berupa hari pertama bulan (YYYY-MM-01).");
  }
  if (!input.seed.trim()) {
    throw new Error("seed optimizer wajib diisi.");
  }

  const employeeIds = input.employees.map((employee) => employee.id);
  const outletIds = input.outlets.map((outlet) => outlet.id);
  if (new Set(employeeIds).size !== employeeIds.length) {
    throw new Error("ID karyawan pada input optimizer harus unik.");
  }
  if (new Set(outletIds).size !== outletIds.length) {
    throw new Error("ID outlet pada input optimizer harus unik.");
  }
}

/**
 * Menghasilkan draft roster deterministik tanpa I/O. Semua keputusan algoritma
 * berasal dari snapshot input dan seed sehingga hasil dapat direproduksi,
 * diuji, lalu dipersistenkan secara atomik oleh lapisan backend terpisah.
 */
export function generateDeterministicRoster(
  input: RosterOptimizerInput
): RosterOptimizerResult {
  validateOptimizerInput(input);
  const end = monthEnd(input.monthStart);
  const dates = enumerateDates(input.monthStart, end);
  const employeeById = new Map(
    input.employees.map((employee) => [employee.id, employee])
  );
  const outletById = new Map(input.outlets.map((outlet) => [outlet.id, outlet]));
  const conflicts: OptimizerConflict[] = [];
  const assignments = new Map<string, OptimizerAssignment>();
  const locked = new Map<string, OptimizerLockedAssignment>();
  const actualOffDates = new Map<string, Set<string>>();
  const leaveDates = new Map<string, Set<string>>();
  const forcedShifts = new Map<string, OptimizerShift>();
  const shiftCounts = new Map(
    input.employees.map((employee) => [employee.id, numericRecord()])
  );
  const pairingCounts = new Map(
    input.employees.map((employee) => [
      employee.id,
      new Map<string, number>(),
    ])
  );

  for (const employee of input.employees) {
    const placementOutletIds = new Set([
      employee.primaryOutletId,
      ...(employee.placements ?? []).map((placement) => placement.outletId),
    ]);
    const missingOutletId = [...placementOutletIds].find(
      (outletId) => !outletById.has(outletId)
    );
    if (missingOutletId) {
      addConflict(conflicts, {
        code: "missing_primary_outlet",
        employeeId: employee.id,
        outletId: missingOutletId,
        description: `${employee.name} memiliki penempatan utama pada outlet yang tidak valid.`,
        suggestions: ["Perbaiki penempatan utama sebelum generate roster."],
      });
    }

    for (const date of dates) {
      if (!activeOn(employee, date)) continue;
      const outletIds = primaryOutletsOn(employee, date);
      if (outletIds.length === 0) {
        addConflict(conflicts, {
          code: "missing_daily_placement",
          employeeId: employee.id,
          date,
          description: `${employee.name} tidak memiliki penempatan utama pada tanggal ini.`,
          suggestions: ["Lengkapi riwayat penempatan tanpa jeda sebelum generate."],
        });
      } else if (outletIds.length > 1) {
        addConflict(conflicts, {
          code: "overlapping_daily_placement",
          employeeId: employee.id,
          date,
          description: `${employee.name} memiliki penempatan utama yang tumpang tindih.`,
          suggestions: ["Koreksi tanggal efektif riwayat penempatan."],
        });
      }
    }

    const employeeOffDates = new Set(employee.offDays.map((offDay) => offDay.date));
    actualOffDates.set(employee.id, employeeOffDates);
    leaveDates.set(employee.id, new Set(employee.leaveDates ?? []));

    for (const item of employee.lockedAssignments ?? []) {
      const key = assignmentKey(employee.id, item.date);
      if (locked.has(key)) {
        addConflict(conflicts, {
          code: "duplicate_locked_assignment",
          employeeId: employee.id,
          date: item.date,
          description: `${employee.name} memiliki lebih dari satu shift terkunci.`,
        });
      } else {
        locked.set(key, item);
      }
    }

    const ownerWeeks = dates.filter(
      (date) => parseDate(date).getUTCDay() === 1
    );
    for (const ownerWeek of ownerWeeks) {
      if (
        !enumerateDates(ownerWeek, addDays(ownerWeek, 6)).some((date) =>
          activeOn(employee, date)
        )
      ) {
        continue;
      }

      const allocations = employee.offDays.filter(
        (offDay) => (offDay.sourceWeekStart ?? weekStart(offDay.date)) === ownerWeek
      );
      if (allocations.length !== 1) {
        addConflict(conflicts, {
          code: "off_entitlement_mismatch",
          employeeId: employee.id,
          date: ownerWeek,
          description: `${employee.name} memiliki ${allocations.length} alokasi off untuk pekan ${ownerWeek}; seharusnya tepat satu.`,
          suggestions: [
            "Atur satu off day atau pinjam jatah dari pekan bersebelahan.",
          ],
        });
      }
    }

    for (const offDay of employee.offDays) {
      const source = offDay.sourceWeekStart ?? weekStart(offDay.date);
      const actual = weekStart(offDay.date);
      const distance = Math.abs(daysBetween(source, actual));
      if (
        parseDate(source).getUTCDay() !== 1 ||
        distance > 7 ||
        source.slice(0, 7) !== actual.slice(0, 7)
      ) {
        addConflict(conflicts, {
          code: "invalid_off_borrow",
          employeeId: employee.id,
          date: offDay.date,
          description: `Sumber jatah off ${employee.name} tidak berasal dari pekan yang sama atau bersebelahan dalam bulan pemilik yang sama.`,
          suggestions: ["Pilih sumber pekan yang valid atau batalkan peminjaman."],
        });
      }

      for (const [date, shift] of [
        [addDays(offDay.date, -1), "morning"],
        [addDays(offDay.date, 1), "night"],
      ] as const) {
        if (date < input.monthStart || date > end || !activeOn(employee, date)) {
          continue;
        }
        const key = assignmentKey(employee.id, date);
        const existing = forcedShifts.get(key);
        if (existing && existing !== shift) {
          addConflict(conflicts, {
            code: "off_pattern_collision",
            employeeId: employee.id,
            date,
            description: `Pola sekitar off ${employee.name} membutuhkan dua shift berbeda pada tanggal yang sama.`,
            suggestions: ["Pindahkan salah satu off day yang berdekatan."],
          });
        } else {
          forcedShifts.set(key, shift);
        }
      }
    }
  }

  for (const employee of input.employees) {
    for (const date of dates) {
      if (!activeOn(employee, date)) continue;
      const key = assignmentKey(employee.id, date);
      const isOff = actualOffDates.get(employee.id)?.has(date) ?? false;
      const isLeave = leaveDates.get(employee.id)?.has(date) ?? false;
      const lockedAssignment = locked.get(key);

      if ([isOff, isLeave, Boolean(lockedAssignment)].filter(Boolean).length > 1) {
        addConflict(conflicts, {
          code: "daily_status_collision",
          employeeId: employee.id,
          date,
          description: `${employee.name} memiliki status off, cuti, atau shift terkunci yang bertabrakan.`,
          suggestions: ["Hapus salah satu status pada tanggal yang sama."],
        });
      }

      if (isOff || isLeave) {
        const homeOutletId =
          primaryOutletOn(employee, date) ?? employee.primaryOutletId;
        assignments.set(key, {
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          outletId: homeOutletId,
          shift: isOff ? "off" : "leave",
          assignmentType: "primary",
          source: isOff ? "off" : "leave",
        });
      }

      if (lockedAssignment && !isOff && !isLeave) {
        const targetOutlet = outletById.get(lockedAssignment.outletId);
        if (!targetOutlet) {
          addConflict(conflicts, {
            code: "missing_locked_outlet",
            employeeId: employee.id,
            date,
            description: `Outlet shift terkunci ${employee.name} tidak ditemukan.`,
          });
          continue;
        }
        const homeOutletId = primaryOutletOn(employee, date);
        if (lockedAssignment.outletId !== homeOutletId && !lockedAssignment.isBackup) {
          addConflict(conflicts, {
            code: "unauthorized_cross_outlet",
            employeeId: employee.id,
            outletId: lockedAssignment.outletId,
            date,
            description: `${employee.name} dipindahkan lintas outlet tanpa penugasan backup manual.`,
            suggestions: ["Buat penugasan backup manual dengan alasan."],
          });
        }
        if (!targetOutlet.availableShifts.includes(lockedAssignment.shift)) {
          addConflict(conflicts, {
            code: "missing_shift_template",
            employeeId: employee.id,
            outletId: targetOutlet.id,
            date,
            description: `Template ${lockedAssignment.shift} tidak aktif di ${targetOutlet.name}.`,
            suggestions: ["Aktifkan template shift outlet untuk periode ini."],
          });
        }
        const forced = forcedShifts.get(key);
        if (forced && forced !== lockedAssignment.shift) {
          addConflict(conflicts, {
            code: "locked_off_pattern_conflict",
            employeeId: employee.id,
            outletId: targetOutlet.id,
            date,
            description: `Shift terkunci ${employee.name} melanggar pola ${forced} di sekitar off day.`,
            suggestions: ["Ubah shift terkunci atau pindahkan off day."],
          });
        }
        assignments.set(key, {
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          outletId: targetOutlet.id,
          shift: lockedAssignment.shift,
          assignmentType: lockedAssignment.isBackup ? "backup" : "primary",
          source: "locked",
          backupReason: lockedAssignment.backupReason,
        });
      }
    }
  }

  const dayContexts: DayContext[] = [];
  for (const date of dates) {
    for (const outlet of input.outlets) {
      const employeeIds = input.employees
        .filter((employee) => {
          if (!activeOn(employee, date)) return false;
          const current = assignments.get(assignmentKey(employee.id, date));
          if (current?.shift === "off" || current?.shift === "leave") return false;
          return (current?.outletId ?? primaryOutletOn(employee, date)) === outlet.id;
        })
        .map((employee) => employee.id);
      if (employeeIds.length === 0) continue;

      const target = targetFor(outlet, date, employeeIds.length);
      const requiredTotal = target.morning + target.middle + target.night;
      if (requiredTotal > employeeIds.length) {
        addConflict(conflicts, {
          code: "staffing_capacity",
          outletId: outlet.id,
          date,
          description: `${outlet.name} membutuhkan ${requiredTotal} staf tetapi hanya ${employeeIds.length} kasir tersedia.`,
          suggestions: ["Ubah off day atau tambahkan backup outlet manual."],
        });
      }
      if (employeeIds.length === 1 && !target.configured) {
        addConflict(conflicts, {
          code: "insufficient_cashiers",
          outletId: outlet.id,
          date,
          description: `${outlet.name} hanya memiliki satu kasir tersedia sehingga komposisi Pagi dan Malam tidak dapat dipenuhi.`,
          suggestions: ["Pindahkan off day atau tambahkan backup outlet manual."],
        });
      }
      for (const shift of ["morning", "middle", "night"] as const) {
        if (target[shift] > 0 && !outlet.availableShifts.includes(shift)) {
          addConflict(conflicts, {
            code: "missing_shift_template",
            outletId: outlet.id,
            date,
            description: `${outlet.name} membutuhkan ${shift}, tetapi template shift tersebut tidak aktif.`,
            suggestions: ["Lengkapi template shift outlet."],
          });
        }
      }
      dayContexts.push({ date, outlet, employeeIds, target });
    }
  }

  const middlePlan = new Map<string, Set<string>>();
  const lockedMiddleWeeks = new Map<string, number>();
  for (const assignment of assignments.values()) {
    if (assignment.shift !== "middle") continue;
    const key = `${assignment.employeeId}:${weekStart(assignment.date)}`;
    lockedMiddleWeeks.set(key, (lockedMiddleWeeks.get(key) ?? 0) + 1);
  }
  for (const [key, count] of lockedMiddleWeeks) {
    if (count <= 1) continue;
    const [employeeId, ownerWeek] = key.split(":");
    addConflict(conflicts, {
      code: "weekly_middle_limit",
      employeeId,
      date: ownerWeek,
      description: `${employeeById.get(employeeId)?.name ?? "Kasir"} memperoleh ${count} Middle terkunci pada pekan yang sama.`,
      suggestions: ["Ubah shift Middle terkunci agar maksimal satu per pekan."],
    });
  }
  const contextsByOutletWeek = new Map<string, DayContext[]>();
  for (const context of dayContexts) {
    const key = outletWeekKey(context.outlet.id, context.date);
    contextsByOutletWeek.set(key, [
      ...(contextsByOutletWeek.get(key) ?? []),
      context,
    ]);
  }

  for (const [groupKey, contexts] of contextsByOutletWeek) {
    const lockedMiddleEmployees = new Set<string>();
    const slots: Array<{ id: string; context: DayContext }> = [];

    for (const context of contexts) {
      const lockedMiddle = context.employeeIds.filter(
        (employeeId) =>
          assignments.get(assignmentKey(employeeId, context.date))?.shift ===
          "middle"
      );
      for (const employeeId of lockedMiddle) {
        if (lockedMiddleEmployees.has(employeeId)) {
          addConflict(conflicts, {
            code: "weekly_middle_limit",
            employeeId,
            outletId: context.outlet.id,
            date: context.date,
            description: `${employeeById.get(employeeId)?.name ?? "Kasir"} memperoleh lebih dari satu Middle pada pekan yang sama.`,
            suggestions: ["Ubah salah satu shift Middle terkunci."],
          });
        }
        lockedMiddleEmployees.add(employeeId);
      }
      if (lockedMiddle.length > context.target.middle) {
        addConflict(conflicts, {
          code: "daily_middle_limit",
          outletId: context.outlet.id,
          date: context.date,
          description: `${context.outlet.name} memiliki lebih banyak Middle terkunci daripada kebutuhan hari tersebut.`,
          suggestions: ["Ubah shift terkunci yang berlebih."],
        });
      }

      const missing = Math.max(0, context.target.middle - lockedMiddle.length);
      for (let index = 0; index < missing; index += 1) {
        slots.push({
          id: `${context.date}:${index}`,
          context,
        });
      }
    }

    const employeeMatch = new Map<string, number>();
    const slotMatch = new Map<number, string>();
    const candidates = (slotIndex: number) => {
      const slot = slots[slotIndex];
      return slot.context.employeeIds
        .filter((employeeId) => {
          if (lockedMiddleEmployees.has(employeeId)) return false;
          if (
            (lockedMiddleWeeks.get(
              `${employeeId}:${weekStart(slot.context.date)}`
            ) ?? 0) > 0
          ) {
            return false;
          }
          const key = assignmentKey(employeeId, slot.context.date);
          if (assignments.has(key) || forcedShifts.has(key)) return false;
          return slot.context.outlet.availableShifts.includes("middle");
        })
        .sort(
          (left, right) =>
            seededRank(input.seed, groupKey, slots[slotIndex].id, left) -
              seededRank(input.seed, groupKey, slots[slotIndex].id, right) ||
            left.localeCompare(right)
        );
    };

    const matchSlot = (slotIndex: number, visited: Set<string>): boolean => {
      for (const employeeId of candidates(slotIndex)) {
        if (visited.has(employeeId)) continue;
        visited.add(employeeId);
        const previousSlot = employeeMatch.get(employeeId);
        if (
          previousSlot === undefined ||
          matchSlot(previousSlot, visited)
        ) {
          employeeMatch.set(employeeId, slotIndex);
          slotMatch.set(slotIndex, employeeId);
          return true;
        }
      }
      return false;
    };

    for (let index = 0; index < slots.length; index += 1) {
      if (!matchSlot(index, new Set())) {
        const slot = slots[index];
        addConflict(conflicts, {
          code: "middle_capacity",
          outletId: slot.context.outlet.id,
          date: slot.context.date,
          description: `Kebutuhan Middle ${slot.context.outlet.name} tidak dapat dipenuhi tanpa melewati batas satu kali per kasir per pekan.`,
          suggestions: ["Ubah off day, shift lock, atau tambahkan backup manual."],
        });
      }
    }

    for (const [slotIndex, employeeId] of slotMatch) {
      const slot = slots[slotIndex];
      const key = outletDateKey(slot.context.outlet.id, slot.context.date);
      const planned = middlePlan.get(key) ?? new Set<string>();
      planned.add(employeeId);
      middlePlan.set(key, planned);
    }
  }

  for (const context of dayContexts) {
    const scheduled = new Map<OptimizerShift, string[]>([
      ["morning", []],
      ["middle", []],
      ["night", []],
    ]);
    const unassigned = new Set(context.employeeIds);

    for (const employeeId of context.employeeIds) {
      const current = assignments.get(assignmentKey(employeeId, context.date));
      if (
        current?.shift === "morning" ||
        current?.shift === "middle" ||
        current?.shift === "night"
      ) {
        scheduled.get(current.shift)?.push(employeeId);
        unassigned.delete(employeeId);
      }
    }

    const plannedMiddle =
      middlePlan.get(outletDateKey(context.outlet.id, context.date)) ?? new Set();
    for (const employeeId of plannedMiddle) {
      if (!unassigned.has(employeeId)) continue;
      const employee = employeeById.get(employeeId);
      if (!employee) continue;
      assignments.set(assignmentKey(employeeId, context.date), {
        employeeId,
        employeeName: employee.name,
        date: context.date,
        outletId: context.outlet.id,
        shift: "middle",
        assignmentType: "primary",
        source: "generated",
      });
      scheduled.get("middle")?.push(employeeId);
      unassigned.delete(employeeId);
    }

    for (const employeeId of [...unassigned]) {
      const forced = forcedShifts.get(assignmentKey(employeeId, context.date));
      if (!forced) continue;
      const employee = employeeById.get(employeeId);
      if (!employee) continue;
      if (!context.outlet.availableShifts.includes(forced)) {
        addConflict(conflicts, {
          code: "missing_shift_template",
          employeeId,
          outletId: context.outlet.id,
          date: context.date,
          description: `Pola off ${employee.name} membutuhkan ${forced}, tetapi templatenya tidak aktif.`,
          suggestions: ["Lengkapi template atau pindahkan off day."],
        });
        continue;
      }
      assignments.set(assignmentKey(employeeId, context.date), {
        employeeId,
        employeeName: employee.name,
        date: context.date,
        outletId: context.outlet.id,
        shift: forced,
        assignmentType: "primary",
        source: "generated",
      });
      scheduled.get(forced)?.push(employeeId);
      unassigned.delete(employeeId);
    }

    const chooseCandidate = (shift: "morning" | "night") =>
      [...unassigned]
        .filter(() => context.outlet.availableShifts.includes(shift))
        .sort((left, right) => {
          const leftPairs = scheduled
            .get(shift)
            ?.reduce(
              (sum, colleagueId) =>
                sum + (pairingCounts.get(left)?.get(colleagueId) ?? 0),
              0
            );
          const rightPairs = scheduled
            .get(shift)
            ?.reduce(
              (sum, colleagueId) =>
                sum + (pairingCounts.get(right)?.get(colleagueId) ?? 0),
              0
            );
          const leftScore =
            (shiftCounts.get(left)?.[shift] ?? 0) * 100 +
            (leftPairs ?? 0) * 10;
          const rightScore =
            (shiftCounts.get(right)?.[shift] ?? 0) * 100 +
            (rightPairs ?? 0) * 10;
          return (
            leftScore - rightScore ||
            seededRank(input.seed, context.date, context.outlet.id, shift, left) -
              seededRank(
                input.seed,
                context.date,
                context.outlet.id,
                shift,
                right
              ) ||
            left.localeCompare(right)
          );
        })[0];

    for (const shift of ["morning", "night"] as const) {
      const needed = Math.max(
        0,
        context.target[shift] - (scheduled.get(shift)?.length ?? 0)
      );
      for (let count = 0; count < needed; count += 1) {
        const employeeId = chooseCandidate(shift);
        if (!employeeId) {
          addConflict(conflicts, {
            code: "shift_coverage",
            outletId: context.outlet.id,
            date: context.date,
            description: `Kebutuhan ${shift} ${context.outlet.name} belum terpenuhi.`,
            suggestions: ["Ubah off day atau tambahkan backup manual."],
          });
          continue;
        }
        const employee = employeeById.get(employeeId);
        if (!employee) continue;
        assignments.set(assignmentKey(employeeId, context.date), {
          employeeId,
          employeeName: employee.name,
          date: context.date,
          outletId: context.outlet.id,
          shift,
          assignmentType: "primary",
          source: "generated",
        });
        scheduled.get(shift)?.push(employeeId);
        unassigned.delete(employeeId);
      }
    }

    for (const employeeId of [...unassigned]) {
      const options = (["morning", "night"] as const).filter((shift) =>
        context.outlet.availableShifts.includes(shift)
      );
      const shift = options.sort(
        (left, right) =>
          (shiftCounts.get(employeeId)?.[left] ?? 0) -
            (shiftCounts.get(employeeId)?.[right] ?? 0) ||
          seededRank(input.seed, context.date, employeeId, left) -
            seededRank(input.seed, context.date, employeeId, right)
      )[0];
      const employee = employeeById.get(employeeId);
      if (!shift || !employee) {
        addConflict(conflicts, {
          code: "unassigned_employee",
          employeeId,
          outletId: context.outlet.id,
          date: context.date,
          description: `${employee?.name ?? "Kasir"} tidak memperoleh shift.`,
          suggestions: ["Lengkapi template shift outlet."],
        });
        continue;
      }
      assignments.set(assignmentKey(employeeId, context.date), {
        employeeId,
        employeeName: employee.name,
        date: context.date,
        outletId: context.outlet.id,
        shift,
        assignmentType: "primary",
        source: "generated",
      });
      scheduled.get(shift)?.push(employeeId);
      unassigned.delete(employeeId);
    }

    for (const [shift, employeeIds] of scheduled) {
      for (const employeeId of employeeIds) {
        const counts = shiftCounts.get(employeeId);
        if (counts) counts[shift] += 1;
        for (const colleagueId of employeeIds) {
          if (employeeId === colleagueId) continue;
          const pairs = pairingCounts.get(employeeId);
          pairs?.set(colleagueId, (pairs.get(colleagueId) ?? 0) + 1);
        }
      }
    }
  }

  const addFinalConflict = (
    conflict: Omit<OptimizerConflict, "severity" | "suggestions"> & {
      severity?: OptimizerConflict["severity"];
      suggestions?: string[];
    }
  ) => {
    const exists = conflicts.some(
      (candidate) =>
        candidate.code === conflict.code &&
        candidate.employeeId === conflict.employeeId &&
        candidate.outletId === conflict.outletId &&
        candidate.date === conflict.date
    );
    if (!exists) addConflict(conflicts, conflict);
  };

  const middleByEmployeeWeek = new Map<string, number>();
  for (const employee of input.employees) {
    let consecutiveWorkDays = 0;
    for (const date of dates) {
      if (!activeOn(employee, date)) continue;
      const assignment = assignments.get(assignmentKey(employee.id, date));
      if (!assignment) {
        addFinalConflict({
          code: "missing_daily_assignment",
          employeeId: employee.id,
          date,
          description: `${employee.name} belum memperoleh satu status harian.`,
          suggestions: ["Lengkapi penempatan, template, atau kapasitas outlet."],
        });
        continue;
      }

      if (
        assignment.shift === "morning" ||
        assignment.shift === "middle" ||
        assignment.shift === "night"
      ) {
        consecutiveWorkDays += 1;
        if (consecutiveWorkDays === 7) {
          addFinalConflict({
            code: "consecutive_work_days",
            severity: "warning",
            employeeId: employee.id,
            date,
            description: `${employee.name} dijadwalkan bekerja lebih dari enam hari berturut-turut.`,
            suggestions: [
              "Tinjau ulang perpindahan off day atau tambahkan hari istirahat.",
            ],
          });
        }
      } else {
        consecutiveWorkDays = 0;
      }

      const homeOutletId = primaryOutletOn(employee, date);
      if (
        assignment.assignmentType === "primary" &&
        assignment.outletId !== homeOutletId
      ) {
        addFinalConflict({
          code: "invalid_primary_outlet",
          employeeId: employee.id,
          outletId: assignment.outletId,
          date,
          description: `${employee.name} dijadwalkan sebagai primary di luar penempatan efektif.`,
          suggestions: ["Gunakan penempatan efektif atau tandai sebagai backup manual."],
        });
      }

      const expectedOff =
        actualOffDates.get(employee.id)?.has(date) ?? false;
      const expectedLeave = leaveDates.get(employee.id)?.has(date) ?? false;
      if (
        (expectedOff && assignment.shift !== "off") ||
        (expectedLeave && assignment.shift !== "leave")
      ) {
        addFinalConflict({
          code: "invalid_unavailable_assignment",
          employeeId: employee.id,
          date,
          description: `${employee.name} mendapat shift pada hari off atau cuti.`,
          suggestions: ["Hapus shift yang bertabrakan dengan ketidakhadiran."],
        });
      }

      const forced = forcedShifts.get(assignmentKey(employee.id, date));
      if (forced && assignment.shift !== forced) {
        addFinalConflict({
          code: "invalid_off_pattern",
          employeeId: employee.id,
          date,
          description: `${employee.name} wajib ${forced} karena pola off day.`,
          suggestions: ["Ubah jadwal terkunci atau pindahkan off day."],
        });
      }

      if (assignment.shift === "middle") {
        const key = `${employee.id}:${weekStart(date)}`;
        middleByEmployeeWeek.set(key, (middleByEmployeeWeek.get(key) ?? 0) + 1);
      }
    }
  }

  for (const [key, count] of middleByEmployeeWeek) {
    if (count <= 1) continue;
    const [employeeId, ownerWeek] = key.split(":");
    addFinalConflict({
      code: "weekly_middle_limit",
      employeeId,
      date: ownerWeek,
      description: `${employeeById.get(employeeId)?.name ?? "Kasir"} memperoleh ${count} Middle dalam satu pekan.`,
      suggestions: ["Kurangi Middle menjadi maksimal satu per pekan."],
    });
  }

  for (const context of dayContexts) {
    for (const shift of ["morning", "middle", "night"] as const) {
      const actual = context.employeeIds.filter(
        (employeeId) =>
          assignments.get(assignmentKey(employeeId, context.date))?.shift ===
          shift
      ).length;
      if (actual < context.target[shift]) {
        addFinalConflict({
          code: "minimum_staffing_unmet",
          outletId: context.outlet.id,
          date: context.date,
          description: `${context.outlet.name} membutuhkan ${context.target[shift]} ${shift}, tetapi hanya ${actual} terisi.`,
          suggestions: ["Ubah off day atau tambahkan backup outlet manual."],
        });
      }
    }
  }

  const middleCounts = [...shiftCounts.values()].map((counts) => counts.middle);
  const averageMiddle =
    middleCounts.reduce((sum, count) => sum + count, 0) /
    Math.max(1, middleCounts.length);
  const fairnessDetails = input.employees
    .map<OptimizerFairnessDetail>((employee) => {
      const counts = shiftCounts.get(employee.id) ?? numericRecord();
      const colleagues = input.employees.filter(
        (candidate) =>
          candidate.id !== employee.id &&
          candidate.primaryOutletId === employee.primaryOutletId
      );
      const pairs = Object.fromEntries(
        colleagues.map((colleague) => [
          colleague.id,
          pairingCounts.get(employee.id)?.get(colleague.id) ?? 0,
        ])
      );
      const pairValues = Object.values(pairs);
      const pairSpread =
        pairValues.length > 0
          ? Math.max(...pairValues) - Math.min(...pairValues)
          : 0;
      const penalty =
        Math.abs(counts.morning - counts.night) *
          FAIRNESS_WEIGHTS.morningNightImbalance +
        Math.abs(counts.middle - averageMiddle) *
          FAIRNESS_WEIGHTS.middleDistribution +
        pairSpread * FAIRNESS_WEIGHTS.pairingSpread;

      return {
        employeeId: employee.id,
        morningCount: counts.morning,
        middleCount: counts.middle,
        nightCount: counts.night,
        offCount: [...(actualOffDates.get(employee.id) ?? [])].filter(
          (date) => date >= input.monthStart && date <= end
        ).length,
        pairingCounts: pairs,
        fairnessScore: Number(Math.max(0, 100 - penalty).toFixed(2)),
      };
    })
    .sort((left, right) => left.employeeId.localeCompare(right.employeeId));

  const fairnessScore = Number(
    (
      fairnessDetails.reduce((sum, detail) => sum + detail.fairnessScore, 0) /
      Math.max(1, fairnessDetails.length)
    ).toFixed(2)
  );
  const outputAssignments = [...assignments.values()].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.employeeId.localeCompare(right.employeeId)
  );
  conflicts.sort(
    (left, right) =>
      (left.date ?? "").localeCompare(right.date ?? "") ||
      (left.outletId ?? "").localeCompare(right.outletId ?? "") ||
      (left.employeeId ?? "").localeCompare(right.employeeId ?? "") ||
      left.code.localeCompare(right.code)
  );

  return {
    status: conflicts.some((conflict) => conflict.severity === "blocking")
      ? "invalid"
      : "valid",
    algorithmVersion: ALGORITHM_VERSION,
    seed: input.seed,
    assignments: outputAssignments,
    conflicts,
    fairnessScore,
    fairnessDetails,
    ruleSnapshot: {
      monthStart: input.monthStart,
      seed: input.seed,
      hardConstraints: [
        "one_daily_status",
        "active_employee_only",
        "off_and_leave_unavailable",
        "minimum_staffing",
        "weekly_middle_limit",
        "morning_before_off",
        "night_after_off",
        "manual_backup_only",
        "active_shift_template",
      ],
      warningRules: ["consecutive_work_days"],
      weights: FAIRNESS_WEIGHTS,
    },
  };
}
