"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  /** Nilai tanggal terformat (format YYYY-MM-DD) */
  value: string;
  /** Callback saat pengguna memilih tanggal baru */
  onChange: (value: string) => void;
  /** Label opsional di atas input */
  label?: string;
  /** Teks placeholder saat tanggal belum dipilih */
  placeholder?: string;
  /** Penyesuai kelas wrapper Tailwind opsional */
  className?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * Komponen Reusable Custom DatePicker (Pemilih Tanggal Tunggal)
 * 
 * Menampilkan kalender interaktif dengan ekspansi inline (cocok untuk Mobile Bottom Sheet),
 * lengkap dengan navigasi bulan/tahun dan visualizer hari ini & tanggal terpilih.
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pilih Tanggal",
  className = ""
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date safely to avoid YYYY-MM-DD UTC bugs
  let selectedDate = null;
  if (value) {
    const [y, m, d] = value.split("-").map(Number);
    selectedDate = new Date(y, m - 1, d);
  }
  const initialDate = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : new Date();

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

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

  // Generate calendar days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleSelectDay = (day: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateFormatted = `${viewYear}-${monthStr}-${dayStr}`;
    onChange(dateFormatted);
    setIsOpen(false);
  };

  // Format date for display
  const formattedDisplay = selectedDate && !isNaN(selectedDate.getTime())
    ? selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : value || placeholder;

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-medium text-slate-300">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-xl text-slate-200 flex items-center justify-between transition-all cursor-pointer text-left focus:outline-none focus:border-amber-500"
      >
        <span className="truncate">{formattedDisplay}</span>
        <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
      </button>

      {/* Inline Animated Calendar Expansion */}
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

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSelected =
                    selectedDate &&
                    selectedDate.getFullYear() === viewYear &&
                    selectedDate.getMonth() === viewMonth &&
                    selectedDate.getDate() === day;

                  const isToday =
                    new Date().getFullYear() === viewYear &&
                    new Date().getMonth() === viewMonth &&
                    new Date().getDate() === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`h-11 sm:h-9 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                          : isToday
                          ? "border border-amber-500/50 text-amber-400 font-bold"
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
