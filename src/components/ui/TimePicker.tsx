"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Check } from "lucide-react";
import { playClickSound } from "@/utils/clickSound";

interface TimePickerProps {
  /** Nilai jam terformat (contoh: "07:00 WIB" atau "07:00") */
  value: string;
  /** Callback saat nilai jam diperbarui */
  onChange: (value: string) => void;
  /** Label opsional di atas komponen */
  label?: string;
  /** Placeholder teks saat belum memilih */
  placeholder?: string;
  /** Penyesuai kelas wrapper Tailwind opsional */
  className?: string;
  /** Tampilkan akhiran WIB (default: true) */
  includeSuffix?: boolean;
  /** Posisi penjangkaran popover melayang: "left" (kolom kiri) atau "right" (kolom kanan) */
  align?: "left" | "right";
}

const SHIFT_PRESETS = [
  { label: "Shift Pagi (07:00)", value: "07:00" },
  { label: "Shift Siang (12:00)", value: "12:00" },
  { label: "Shift Malam (15:00)", value: "15:00" },
  { label: "Selesai Shift (23:00)", value: "23:00" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

/**
 * Komponen Reusable Custom TimePicker (Pemilih Jam / Waktu) Berstandar Industri
 * 
 * - Smart Alignment (`align="left" | "right"`) mencegah popover meluap keluar batas modal.
 * - Menggunakan Floating Popover Card (`absolute top-full z-50`) bebas dari ruang kosong asimetris.
 * - Dilengkapi tombol preset cepat, jam 00-23 monospace, click outside listener, & tombol Selesai.
 */
export function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Pilih Jam",
  className = "",
  includeSuffix = true,
  align = "left"
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract initial hour and minute from value string if available (e.g. "07:00" or "07:00 WIB")
  const match = value ? value.match(/(\d{2}):(\d{2})/) : null;
  const currentHour = match ? match[1] : "07";
  const currentMinute = match ? match[2] : "00";

  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinute);

  // Synchronize internal state when value prop changes externally
  useEffect(() => {
    if (match) {
      setSelectedHour(match[1]);
      setSelectedMinute(match[2]);
    }
  }, [value]);

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Auto flip logic
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // if space below is less than TimePicker height (~320px), open upwards
      setOpenUpwards(spaceBelow < 320);
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectTime = (h: string, m: string) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    const formatted = includeSuffix ? `${h}:${m} WIB` : `${h}:${m}`;
    onChange(formatted);
  };

  const handleDone = () => {
    playClickSound();
    setIsOpen(false);
  };

  const alignClass = align === "right" ? "right-0" : "left-0";

  return (
    <div className={`relative space-y-1 ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-medium text-slate-300 block">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setIsOpen(!isOpen);
        }}
        className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-xl text-slate-200 flex items-center justify-between transition-all cursor-pointer text-left focus:outline-none focus:border-amber-500 shadow-sm"
      >
        <span className="truncate font-semibold">{value || placeholder}</span>
        <Clock className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
      </button>

      {/* Smart Alignment Floating Popover Overlay Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${alignClass} z-50 w-[270px] sm:w-[290px] bg-slate-900 border border-slate-700/90 shadow-2xl rounded-2xl p-3.5 space-y-3 text-slate-200 ring-1 ring-amber-500/20 ${
              openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {/* Quick Shift Presets */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-amber-400/90 uppercase tracking-wider block">Tombol Cepat Shift:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {SHIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      handleSelectTime(preset.value, "00");
                    }}
                    className={`py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer border text-center flex items-center justify-center leading-tight ${
                      selectedHour === preset.value && selectedMinute === "00"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour & Minute Picker Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
              {/* Hour Column */}
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Jam (00 - 23):</span>
                <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto overflow-x-hidden pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-900">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        handleSelectTime(h, selectedMinute);
                      }}
                      className={`h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                        selectedHour === h
                          ? "bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30 scale-105"
                          : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Column */}
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Menit:</span>
                <div className="grid grid-cols-2 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        handleSelectTime(selectedHour, m);
                      }}
                      className={`h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                        selectedMinute === m
                          ? "bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30 scale-105"
                          : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      :{m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm Done Button */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 font-mono">
                Terpilih: {selectedHour}:{selectedMinute}
              </span>
              <button
                type="button"
                onClick={handleDone}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Selesai</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
