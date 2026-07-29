import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { generateDeterministicRoster } from "../../src/lib/roster/optimizer.ts";

const MONTH_START = "2026-06-01";
const OWNER_WEEKS = [
  "2026-06-01",
  "2026-06-08",
  "2026-06-15",
  "2026-06-22",
  "2026-06-29",
];

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStart(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function offDays(offset) {
  return OWNER_WEEKS.map((sourceWeekStart) => ({
    date: addDays(sourceWeekStart, offset),
    sourceWeekStart,
  }));
}

function createInput(employeeCount = 4) {
  return {
    monthStart: MONTH_START,
    seed: "fixture-june-2026",
    outlets: [
      {
        id: "outlet-a",
        name: "Area Operasional A",
        availableShifts: ["morning", "middle", "night"],
      },
    ],
    employees: Array.from({ length: employeeCount }, (_, index) => ({
      id: `employee-${index + 1}`,
      name: `Kasir ${index + 1}`,
      primaryOutletId: "outlet-a",
      offDays: offDays(index),
    })),
  };
}

test("menghasilkan roster bulanan valid dan deterministik untuk empat kasir", () => {
  const input = createInput();
  const first = generateDeterministicRoster(input);
  const second = generateDeterministicRoster(structuredClone(input));

  assert.deepEqual(second, first);
  assert.equal(first.status, "valid");
  assert.deepEqual(first.conflicts, []);
  assert.equal(first.assignments.length, 120);
  assert.ok(first.fairnessScore >= 0 && first.fairnessScore <= 100);

  const assignmentsByEmployeeDate = new Map(
    first.assignments.map((assignment) => [
      `${assignment.employeeId}:${assignment.date}`,
      assignment,
    ])
  );

  for (const employee of input.employees) {
    for (const item of employee.offDays) {
      if (item.date >= MONTH_START && item.date <= "2026-06-30") {
        assert.equal(
          assignmentsByEmployeeDate.get(`${employee.id}:${item.date}`)?.shift,
          "off"
        );
      }

      const before = addDays(item.date, -1);
      if (before >= MONTH_START && before <= "2026-06-30") {
        assert.equal(
          assignmentsByEmployeeDate.get(`${employee.id}:${before}`)?.shift,
          "morning"
        );
      }

      const after = addDays(item.date, 1);
      if (after >= MONTH_START && after <= "2026-06-30") {
        assert.equal(
          assignmentsByEmployeeDate.get(`${employee.id}:${after}`)?.shift,
          "night"
        );
      }
    }
  }

  const middleByEmployeeWeek = new Map();
  for (const assignment of first.assignments) {
    if (assignment.shift !== "middle") continue;
    const key = `${assignment.employeeId}:${weekStart(assignment.date)}`;
    middleByEmployeeWeek.set(key, (middleByEmployeeWeek.get(key) ?? 0) + 1);
  }
  assert.ok([...middleByEmployeeWeek.values()].every((count) => count <= 1));

  for (const date of Array.from({ length: 30 }, (_, index) =>
    addDays(MONTH_START, index)
  )) {
    const daily = first.assignments.filter(
      (assignment) =>
        assignment.date === date &&
        assignment.shift !== "off" &&
        assignment.shift !== "leave"
    );
    const middleCount = daily.filter(
      (assignment) => assignment.shift === "middle"
    ).length;
    assert.equal(middleCount, daily.length === 3 ? 1 : 0);
  }

  for (const detail of first.fairnessDetails) {
    const employeeAssignments = first.assignments.filter(
      (assignment) => assignment.employeeId === detail.employeeId
    );
    assert.equal(
      detail.morningCount,
      employeeAssignments.filter((assignment) => assignment.shift === "morning")
        .length
    );
    assert.equal(
      detail.middleCount,
      employeeAssignments.filter((assignment) => assignment.shift === "middle")
        .length
    );
    assert.equal(
      detail.nightCount,
      employeeAssignments.filter((assignment) => assignment.shift === "night")
        .length
    );
    assert.equal(
      detail.offCount,
      employeeAssignments.filter((assignment) => assignment.shift === "off")
        .length
    );
  }
});

test("melaporkan konflik yang dapat ditindaklanjuti ketika kapasitas Middle tidak cukup", () => {
  const result = generateDeterministicRoster(createInput(3));

  assert.equal(result.status, "invalid");
  const conflict = result.conflicts.find(
    (candidate) => candidate.code === "middle_capacity"
  );
  assert.ok(conflict);
  assert.ok(conflict.description.includes("Middle"));
  assert.ok(conflict.suggestions.length > 0);
});

test("memperingatkan lebih dari enam hari kerja tanpa menggagalkan roster", () => {
  const input = createInput();
  input.employees[0].offDays = [
    { date: "2026-06-01", sourceWeekStart: "2026-06-01" },
    { date: "2026-06-14", sourceWeekStart: "2026-06-08" },
    { date: "2026-06-21", sourceWeekStart: "2026-06-15" },
    { date: "2026-06-28", sourceWeekStart: "2026-06-22" },
    { date: "2026-07-05", sourceWeekStart: "2026-06-29" },
  ];

  const result = generateDeterministicRoster(input);
  const warning = result.conflicts.find(
    (candidate) => candidate.code === "consecutive_work_days"
  );

  assert.equal(result.status, "valid");
  assert.equal(warning?.severity, "warning");
  assert.equal(warning?.employeeId, "employee-1");
  assert.ok(warning?.suggestions.length);
});

test("menolak perpindahan lintas outlet yang bukan backup manual", () => {
  const input = createInput();
  input.outlets.push({
    id: "outlet-b",
    name: "Area Operasional B",
    availableShifts: ["morning", "middle", "night"],
  });
  input.employees[0].lockedAssignments = [
    {
      date: "2026-06-05",
      outletId: "outlet-b",
      shift: "morning",
      isBackup: false,
    },
  ];

  const result = generateDeterministicRoster(input);

  assert.equal(result.status, "invalid");
  assert.ok(
    result.conflicts.some(
      (conflict) => conflict.code === "unauthorized_cross_outlet"
    )
  );
});

test("menolak snapshot input yang tidak dapat direproduksi dengan aman", () => {
  assert.throws(
    () =>
      generateDeterministicRoster({
        ...createInput(),
        monthStart: "2026-06-02",
      }),
    /hari pertama bulan/
  );
  assert.throws(
    () => generateDeterministicRoster({ ...createInput(), seed: " " }),
    /seed optimizer wajib diisi/
  );
});

test("memenuhi target performa PRD untuk fixture 200 kasir", () => {
  const outlets = Array.from({ length: 50 }, (_, outletIndex) => ({
    id: `outlet-${outletIndex + 1}`,
    name: `Area Operasional ${outletIndex + 1}`,
    availableShifts: ["morning", "middle", "night"],
  }));
  const employees = outlets.flatMap((outlet, outletIndex) =>
    Array.from({ length: 4 }, (_, employeeIndex) => ({
      id: `employee-${outletIndex + 1}-${employeeIndex + 1}`,
      name: `Kasir ${outletIndex + 1}-${employeeIndex + 1}`,
      primaryOutletId: outlet.id,
      offDays: offDays(employeeIndex),
    }))
  );

  const startedAt = performance.now();
  const result = generateDeterministicRoster({
    monthStart: MONTH_START,
    seed: "performance-fixture-200",
    outlets,
    employees,
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.status, "valid");
  assert.equal(result.assignments.length, 6_000);
  assert.ok(
    elapsedMs < 30_000,
    `Generate memerlukan ${elapsedMs.toFixed(2)} ms; target maksimal 30 detik.`
  );
});

test("mengikuti perubahan penempatan efektif di tengah bulan", () => {
  const input = createInput();
  input.outlets.push({
    id: "outlet-b",
    name: "Area Operasional B",
    availableShifts: ["morning", "middle", "night"],
  });
  input.employees.push(
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `employee-b-${index + 1}`,
      name: `Kasir B ${index + 1}`,
      primaryOutletId: "outlet-b",
      offDays: offDays(index),
    }))
  );
  input.employees[0].placements = [
    {
      outletId: "outlet-a",
      startDate: "2025-01-01",
      endDate: "2026-06-15",
    },
    { outletId: "outlet-b", startDate: "2026-06-16" },
  ];
  input.employees[4].placements = [
    {
      outletId: "outlet-b",
      startDate: "2025-01-01",
      endDate: "2026-06-15",
    },
    { outletId: "outlet-a", startDate: "2026-06-16" },
  ];

  const result = generateDeterministicRoster(input);

  assert.equal(result.status, "valid");
  assert.equal(
    result.assignments.find(
      (assignment) =>
        assignment.employeeId === "employee-1" &&
        assignment.date === "2026-06-15"
    )?.outletId,
    "outlet-a"
  );
  assert.equal(
    result.assignments.find(
      (assignment) =>
        assignment.employeeId === "employee-1" &&
        assignment.date === "2026-06-16"
    )?.outletId,
    "outlet-b"
  );
});
