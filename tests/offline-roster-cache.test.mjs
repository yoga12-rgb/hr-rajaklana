import assert from "node:assert/strict";
import test from "node:test";
import {
  isOfflineRosterQuery,
  sanitizeRosterForOffline,
} from "../src/lib/offline/roster-cache.ts";

test("cache offline hanya menerima query roster bulanan", () => {
  assert.equal(isOfflineRosterQuery(["roster", "month", "2026-07-01"]), true);
  assert.equal(isOfflineRosterQuery(["roster", "swap-options", "id"]), false);
  assert.equal(isOfflineRosterQuery(["attendance", "workspace"]), false);
});

test("snapshot roster offline membuang alasan dan alur pertukaran", () => {
  const result = sanitizeRosterForOffline({
    period: null,
    version: {
      id: "version",
      version_number: 2,
      status: "published",
      change_summary: "alasan sensitif",
      published_at: "2026-07-01T00:00:00Z",
    },
    employees: [
      {
        id: "employee",
        name: "Kasir Satu",
        position: "Kasir",
        primary_outlet_id: "outlet",
        primary_outlet_name: "Outlet Satu",
      },
    ],
    assignments: [
      {
        id: "assignment",
        employee_id: "employee",
        employee_name: "Kasir Satu",
        outlet_id: "outlet",
        outlet_name: "Outlet Satu",
        work_date: "2026-07-01",
        shift_type: "morning",
        planned_start: "08:00",
        planned_end: "16:00",
        status: "scheduled",
        assignment_type: "primary",
        is_own: true,
        acknowledged: false,
        unexpected_private_field: "harus hilang",
      },
    ],
    off_days: [{ override_reason: "alasan supervisor" }],
    swap_requests: [{ reason: "alasan tukar" }],
  });

  assert.ok(result);
  assert.equal(result.version.change_summary, null);
  assert.equal(result.employees[0].position, "");
  assert.deepEqual(result.off_days, []);
  assert.deepEqual(result.swap_requests, []);
  assert.equal("unexpected_private_field" in result.assignments[0], false);
});
