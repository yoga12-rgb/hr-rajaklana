import type { LeaveBalance } from "./repository";

export type LeaveBalanceDecision = "approved" | "rejected" | "cancelled";
export type ApprovedLeaveChangeType = "cancel" | "reschedule";

export interface LeaveBalanceProjection {
  availableBefore: number;
  availableAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  usedBefore: number;
  usedAfter: number;
}

/**
 * Memproyeksikan perpindahan ledger saldo untuk keputusan pengajuan tahunan.
 * Saldo tersedia sudah berkurang ketika hari direservasi saat pengajuan.
 */
export function projectLeaveBalanceDecision(
  balance: LeaveBalance,
  requestedDays: number,
  decision: LeaveBalanceDecision
): LeaveBalanceProjection {
  const days = Math.max(0, requestedDays);
  const releasesReservation = decision !== "approved";

  return {
    availableBefore: balance.available_days,
    availableAfter:
      balance.available_days + (releasesReservation ? days : 0),
    reservedBefore: balance.reserved_days,
    reservedAfter: Math.max(0, balance.reserved_days - days),
    usedBefore: balance.used_days,
    usedAfter: balance.used_days + (decision === "approved" ? days : 0),
  };
}

/**
 * Memproyeksikan perubahan reservasi ketika tanggal pengajuan pending diubah.
 * Saldo tersedia di workspace sudah memperhitungkan hari yang direservasi.
 */
export function projectPendingLeaveAmendment(
  balance: LeaveBalance,
  previousDays: number,
  proposedDays: number
): LeaveBalanceProjection {
  const previous = Math.max(0, previousDays);
  const proposed = Math.max(0, proposedDays);
  const delta = proposed - previous;

  return {
    availableBefore: balance.available_days,
    availableAfter: balance.available_days - delta,
    reservedBefore: balance.reserved_days,
    reservedAfter: Math.max(0, balance.reserved_days + delta),
    usedBefore: balance.used_days,
    usedAfter: balance.used_days,
  };
}

/**
 * Memproyeksikan ledger Cuti Tahunan bila perubahan atas cuti approved
 * disetujui supervisor. Pembatalan mengembalikan seluruh hari terpakai,
 * sedangkan penjadwalan ulang mengganti jumlah hari lama dengan jumlah baru.
 */
export function projectApprovedLeaveChange(
  balance: LeaveBalance,
  previousDays: number,
  changeType: ApprovedLeaveChangeType,
  proposedDays = 0,
  reservedDeltaDays = 0
): LeaveBalanceProjection {
  const previous = Math.max(0, previousDays);
  const proposed = changeType === "reschedule" ? Math.max(0, proposedDays) : 0;
  const reservedDelta = Math.max(0, reservedDeltaDays);
  const usedAfter = Math.max(0, balance.used_days - previous + proposed);
  const returnedDays = Math.max(0, previous - proposed);

  return {
    availableBefore: balance.available_days,
    availableAfter: balance.available_days + returnedDays,
    reservedBefore: balance.reserved_days,
    reservedAfter: Math.max(0, balance.reserved_days - reservedDelta),
    usedBefore: balance.used_days,
    usedAfter,
  };
}
