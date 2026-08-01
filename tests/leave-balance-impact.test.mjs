import assert from "node:assert/strict";
import test from "node:test";

import { projectLeaveBalanceDecision } from "../src/lib/workforce-requests/leave-balance.ts";

const pendingAnnualBalance = {
  id: "balance",
  employee_id: "employee",
  employee_name: "Karyawan",
  leave_type_id: "annual",
  leave_type_name: "Cuti Tahunan",
  year: 2026,
  granted_days: 12,
  used_days: 2,
  reserved_days: 3,
  expired_days: 0,
  available_days: 7,
};

test("approval memindahkan reservasi ke saldo terpakai", () => {
  assert.deepEqual(
    projectLeaveBalanceDecision(pendingAnnualBalance, 3, "approved"),
    {
      availableBefore: 7,
      availableAfter: 7,
      reservedBefore: 3,
      reservedAfter: 0,
      usedBefore: 2,
      usedAfter: 5,
    }
  );
});

test("penolakan mengembalikan reservasi ke saldo tersedia", () => {
  assert.deepEqual(
    projectLeaveBalanceDecision(pendingAnnualBalance, 3, "rejected"),
    {
      availableBefore: 7,
      availableAfter: 10,
      reservedBefore: 3,
      reservedAfter: 0,
      usedBefore: 2,
      usedAfter: 2,
    }
  );
});
