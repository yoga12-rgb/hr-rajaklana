"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

interface DateRangePickerProps {
  /** Tanggal mulai dalam format YYYY-MM-DD */
  startDate: string;
  /** Tanggal selesai dalam format YYYY-MM-DD */
  endDate: string;
  /** Callback saat rentang tanggal diperbarui (startDate, endDate, totalDays) */
  onChange: (startDate: string, endDate: string, totalDays: number) => void;
  /** Label opsional di atas komponen */
  label?: string;
  /** Penyesuai kelas wrapper Tailwind opsional */
  className?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * Komponen Reusable Custom DateRangePicker (Pemilih Rentang Tanggal Mulai s/d Selesai)
 * 
 * Memungkinkan pengguna untuk memilih dua tanggal (mulai & selesai) dalam 1 kalender visual.
 * Menggunakan ekspansi inline agar cocok dengan Mobile Bottom Sheet tanpa terpotong batas layar.
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  label,
  className = ""
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const initialDate = start && !isNaN(start.getTime()) ? start : new Date();

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Transient selection state when user is clicking dates
  const [selectingStart, setSelectingStart] = useState<Date | null>(start);
  const [selectingEnd, setSelectingEnd] = useState<Date | null>(end);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(viewYear, viewMonth, day);

    if (!selectingStart || (selectingStart && selectingEnd)) {
      // Step 1: First click sets start date, clears end date
      setSelectingStart(clickedDate);
      setSelectingEnd(null);
    } else {
      // Step 2: Second click sets end date
      let finalStart = selectingStart;
      let finalEnd = clickedDate;

      if (clickedDate < selectingStart) {
        finalStart = clickedDate;
        finalEnd = selectingStart;
      }

      setSelectingStart(finalStart);
      setSelectingEnd(finalEnd);

      // Calculate total days
      const diffTime = Math.abs(finalEnd.getTime() - finalStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const formatYMD = (d: Date) => {
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dy = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${m}-${dy}`;
      };

      onChange(formatYMD(finalStart), formatYMD(finalEnd), diffDays);
      setIsOpen(false);
    }
  };

  const formatShort = (dStr: string) => {
    if (!dStr) return "";
    const [y, m, d] = dStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime())
      ? dStr
      : dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const calcDays = () => {
    if (!startDate || !endDate) return 1;
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const s = new Date(sy, sm - 1, sd);
    const e = new Date(ey, em - 1, ed);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-medium text-slate-300">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-xl text-slate-200 flex items-center justify-between transition-all cursor-pointer text-left focus:outline-none focus:border-amber-500"
      >
        <div className="flex items-center gap-1.5 truncate">
          <span>{formatShort(startDate) || "Tgl Mulai"}</span>
          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{formatShort(endDate) || "Tgl Selesai"}</span>
          {startDate && endDate && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
              {calcDays()} Hari
            </span>
          )}
        </div>
        <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
      </button>

      {/* Inline Animated Calendar Expansion (No Floating/Clipping Issues) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3 w-full text-slate-200 shadow-inner">
              {/* Range Instruction Note */}
              <div className="text-[10px] text-amber-400 font-medium bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 text-center">
                {!selectingStart
                  ? "Klik tanggal awal"
                  : !selectingEnd
                  ? "Klik tanggal selesai"
                  : "Rentang terpilih (Klik untuk ubah)"}
              </div>

              {/* Calendar Header with Quick Month & Year Selectors */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Select Bulan */}
                  <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx} className="bg-slate-900 text-slate-100">
                        {m}
                      </option>
                    ))}
                  </select>

                  {/* Select Tahun */}
                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {Array.from({ length: 30 }, (_, i) => 2015 + i).map((y) => (
                      <option key={y} value={y} className="bg-slate-900 text-slate-100">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Names Header */}
              <div className="grid grid-cols-7 text-center gap-1">
                {DAY_NAMES.map((day) => (
                  <span key={day} className="text-[10px] font-semibold text-slate-400">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days Grid (Full Width & Large Touch Target for Mobile) */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const currentDate = new Date(viewYear, viewMonth, day);

                  const isStart =
                    selectingStart &&
                    selectingStart.getFullYear() === viewYear &&
                    selectingStart.getMonth() === viewMonth &&
                    selectingStart.getDate() === day;

                  const isEnd =
                    selectingEnd &&
                    selectingEnd.getFullYear() === viewYear &&
                    selectingEnd.getMonth() === viewMonth &&
                    selectingEnd.getDate() === day;

                  const isInRange =
                    selectingStart &&
                    selectingEnd &&
                    currentDate >= selectingStart &&
                    currentDate <= selectingEnd;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={`h-9 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                        isStart || isEnd
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                          : isInRange
                          ? "bg-amber-500/20 text-amber-300 font-semibold"
                          : "hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
