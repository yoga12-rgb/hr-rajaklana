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
  { label: "Shift Pagi (07:00)", h: "07", m: "00" },
  { label: "Shift Siang (12:00)", h: "12", m: "00" },
  { label: "Shift Malam (15:00)", h: "15", m: "00" },
  { label: "Selesai Shift (23:00)", h: "23", m: "00" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Komponen Reusable Custom TimePicker (Wheel Scroll Picker / Pemilih Roda Jam)
 * 
 * - Dual-Wheel Scroll Column (Jam 00-23 & Menit 00-59) berstandar iOS/Android Native.
 * - Center Highlight Selection Band dengan animasi snap mulus.
 * - Tombol Cepat Shift Presets & Smart Alignment Popover Card.
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
  
  const hourItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const minuteItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  // Click Outside Handler & Auto-flip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 340);

      // Auto-scroll wheel items to center when opened
      setTimeout(() => {
        hourItemRefs.current[selectedHour]?.scrollIntoView({ behavior: "smooth", block: "center" });
        minuteItemRefs.current[selectedMinute]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, selectedHour, selectedMinute]);

  const handleSelectTime = (h: string, m: string) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    const formatted = includeSuffix ? `${h}:${m} WIB` : `${h}:${m}`;
    onChange(formatted);
  };

  const handleSelectHour = (h: string) => {
    playClickSound();
    handleSelectTime(h, selectedMinute);
    hourItemRefs.current[h]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSelectMinute = (m: string) => {
    playClickSound();
    handleSelectTime(selectedHour, m);
    minuteItemRefs.current[m]?.scrollIntoView({ behavior: "smooth", block: "center" });
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

      {/* Smart Alignment Floating Popover Wheel Card */}
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
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      handleSelectTime(preset.h, preset.m);
                      hourItemRefs.current[preset.h]?.scrollIntoView({ behavior: "smooth", block: "center" });
                      minuteItemRefs.current[preset.m]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer border text-center flex items-center justify-center leading-tight ${
                      selectedHour === preset.h && selectedMinute === preset.m
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* iOS/Android Style Dual Wheel Scroll Picker */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-around mb-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Jam</span>
                <span>Menit</span>
              </div>

              {/* Wheel Container Box */}
              <div className="relative h-[150px] bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center">
                {/* Active Selection Center Band Indicator */}
                <div className="absolute top-[55px] left-2 right-2 h-[40px] bg-amber-500/15 border-y border-amber-500/40 rounded-lg pointer-events-none z-10" />

                {/* Hours Wheel Column */}
                <div className="flex-1 h-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[55px] text-center z-20">
                  {HOURS.map((h) => {
                    const isSelected = selectedHour === h;
                    return (
                      <div
                        key={h}
                        ref={(el) => { hourItemRefs.current[h] = el; }}
                        onClick={() => handleSelectHour(h)}
                        className={`h-[40px] snap-center flex items-center justify-center cursor-pointer font-mono transition-all duration-150 select-none ${
                          isSelected
                            ? "text-amber-400 font-extrabold text-base scale-110"
                            : "text-slate-500 font-medium text-xs hover:text-slate-300"
                        }`}
                      >
                        {h}
                      </div>
                    );
                  })}
                </div>

                <span className="text-amber-400 font-bold font-mono text-sm z-20 pb-0.5">:</span>

                {/* Minutes Wheel Column */}
                <div className="flex-1 h-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[55px] text-center z-20">
                  {MINUTES.map((m) => {
                    const isSelected = selectedMinute === m;
                    return (
                      <div
                        key={m}
                        ref={(el) => { minuteItemRefs.current[m] = el; }}
                        onClick={() => handleSelectMinute(m)}
                        className={`h-[40px] snap-center flex items-center justify-center cursor-pointer font-mono transition-all duration-150 select-none ${
                          isSelected
                            ? "text-amber-400 font-extrabold text-base scale-110"
                            : "text-slate-500 font-medium text-xs hover:text-slate-300"
                        }`}
                      >
                        {m}
                      </div>
                    );
                  })}
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
