import assert from "node:assert/strict";
import test from "node:test";

import {
  projectApprovedLeaveChange,
  projectLeaveBalanceDecision,
  projectPendingLeaveAmendment,
} from "../src/lib/workforce-requests/leave-balance.ts";

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

test("perubahan pending menyesuaikan reservasi berdasarkan selisih hari", () => {
  assert.deepEqual(
    projectPendingLeaveAmendment(pendingAnnualBalance, 3, 5),
    {
      availableBefore: 7,
      availableAfter: 5,
      reservedBefore: 3,
      reservedAfter: 5,
      usedBefore: 2,
      usedAfter: 2,
    }
  );
});

test("pembatalan cuti approved mengembalikan hari terpakai", () => {
  const approvedBalance = {
    ...pendingAnnualBalance,
    available_days: 5,
    reserved_days: 0,
    used_days: 7,
  };

  assert.deepEqual(
    projectApprovedLeaveChange(approvedBalance, 3, "cancel"),
    {
      availableBefore: 5,
      availableAfter: 8,
      reservedBefore: 0,
      reservedAfter: 0,
      usedBefore: 7,
      usedAfter: 4,
    }
  );
});

test("penjadwalan ulang approved memproyeksikan durasi lebih pendek dan panjang", () => {
  const approvedBalance = {
    ...pendingAnnualBalance,
    available_days: 5,
    reserved_days: 0,
    used_days: 7,
  };

  assert.equal(
    projectApprovedLeaveChange(approvedBalance, 3, "reschedule", 1)
      .availableAfter,
    7
  );
  assert.deepEqual(
    projectApprovedLeaveChange(
      {
        ...approvedBalance,
        available_days: 3,
        reserved_days: 2,
      },
      3,
      "reschedule",
      5,
      2
    ),
    {
      availableBefore: 3,
      availableAfter: 3,
      reservedBefore: 2,
      reservedAfter: 0,
      usedBefore: 7,
      usedAfter: 9,
    }
  );
});
