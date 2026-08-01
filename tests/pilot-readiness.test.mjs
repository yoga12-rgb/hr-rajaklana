import assert from "node:assert/strict";
import test from "node:test";
import {
  countPilotCapableOutlets,
  evaluatePilotReadiness,
} from "../scripts/lib/pilot-readiness.mjs";

function candidateSnapshot() {
  return {
    today: "2026-08-01",
    employees: ["e1", "e2", "e3"].map((id) => ({
      id,
      archived_at: null,
      job_position_id: "cashier",
    })),
    jobPositions: [
      { id: "cashier", is_active: true, auto_roster_eligible: true },
    ],
    userAccounts: ["e1", "e2", "e3"].map((employee_id) => ({
      employee_id,
      access_role: "employee",
      account_status: "active",
      must_change_password: false,
    })),
    outlets: [{ id: "outlet", is_active: true }],
    placements: ["e1", "e2", "e3"].map((employee_id) => ({
      employee_id,
      outlet_id: "outlet",
      is_primary: true,
      start_date: "2026-01-01",
      end_date: null,
    })),
    shiftTemplates: ["morning", "middle", "night"].map((shift_type) => ({
      id: shift_type,
      outlet_id: "outlet",
      shift_type,
      is_active: true,
    })),
    staffingRequirements: ["morning", "middle", "night"].map(
      (shift_template_id) => ({
        shift_template_id,
        outlet_id: "outlet",
        effective_from: "2026-01-01",
        effective_until: null,
      })
    ),
  };
}

test("menghitung outlet kandidat tanpa mengekspos identitas", () => {
  assert.equal(countPilotCapableOutlets(candidateSnapshot()), 1);
});

test("menolak kandidat ketika satu akun masih wajib ganti kata sandi", () => {
  const snapshot = candidateSnapshot();
  snapshot.userAccounts[0].must_change_password = true;
  assert.equal(countPilotCapableOutlets(snapshot), 0);
});

test("menghasilkan WAIT untuk gate manual setelah prasyarat teknis lulus", () => {
  const result = evaluatePilotReadiness({
    activeSupervisors: 1,
    activeOutlets: 1,
    rosterEligibleEmployees: 3,
    readyEmployeeAccounts: 3,
    pilotCapableOutlets: 1,
    activePolicyTypes: ["attendance", "leave", "overtime", "roster"],
    exhaustedDeletionJobs: 0,
    overdueDeletionJobs: 0,
    staleDeletionJobs: 0,
    exhaustedReportJobs: 0,
    latestCron: {
      action: "cron_completed",
      failed: 0,
      isStale: false,
      createdAt: "1 Agu 2026, 01.00",
    },
  });

  assert.equal(result.status, "WAIT");
  assert.equal(result.checks.some((item) => item.status === "BLOCKED"), false);
});

test("menghasilkan BLOCKED ketika job operasional menghabiskan retry", () => {
  const result = evaluatePilotReadiness({
    activeSupervisors: 1,
    activeOutlets: 1,
    rosterEligibleEmployees: 3,
    readyEmployeeAccounts: 3,
    pilotCapableOutlets: 1,
    activePolicyTypes: ["attendance", "leave", "overtime", "roster"],
    exhaustedDeletionJobs: 1,
    overdueDeletionJobs: 0,
    staleDeletionJobs: 0,
    exhaustedReportJobs: 0,
    latestCron: null,
  });

  assert.equal(result.status, "BLOCKED");
});
