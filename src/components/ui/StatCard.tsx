"use client";

import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  /** Label judul kartu metrik */
  title: string;
  /** Nilai utama statistik (angka, teks, atau elemen JSX) */
  value: ReactNode;
  /** Keterangan tambahan di bawah nilai */
  subtext?: ReactNode;
  /** Ikon Lucide React opsional di pojok kanan atas */
  icon?: LucideIcon;
  /** Kelas warna Tailwind untuk ikon (default: 'text-amber-400') */
  iconColor?: string;
  /** Kelas warna Tailwind untuk teks nilai (default: 'text-slate-100') */
  valueColor?: string;
  /** Elemen anak opsional (seperti grafik mini/sparkline) */
  children?: ReactNode;
}

/**
 * Komponen Kartu Ringkasan Metrik / Statistik Universal
 * 
 * @example
 * <StatCard title="Total Karyawan" value={42} subtext="+4 staf baru" icon={Users} />
 */
export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconColor = "text-amber-400",
  valueColor = "text-slate-100",
  children
}: StatCardProps) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider">{title}</span>
          {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        </div>
        <p className={`text-2xl font-bold ${valueColor} mt-1`}>{value}</p>
        {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
      </div>
      {children}
    </div>
  );
}
