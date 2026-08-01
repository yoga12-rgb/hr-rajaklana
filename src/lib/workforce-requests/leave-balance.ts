import type { LeaveBalance } from "./repository";

export type LeaveBalanceDecision = "approved" | "rejected" | "cancelled";

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
