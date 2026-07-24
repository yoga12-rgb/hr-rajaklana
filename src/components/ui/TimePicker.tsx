"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Check } from "lucide-react";
import { playClickSound } from "@/utils/clickSound";

interface TimePickerProps {
  /** Nilai jam terformat (contoh: "07:00 WIB" atau "07:00") */
  value: string;
  /** Callback saat pengguna mengonfirmasi nilai jam */
  onChange: (value: string) => void;
  /** Label opsional di atas komponen */
  label?: string;
  /** Placeholder teks saat belum memilih */
  placeholder?: string;
  /** Penyesuai kelas wrapper Tailwind opsional */
  className?: string;
  /** Sertakan akhiran WIB pada nilai callback (default: true) */
  includeSuffix?: boolean;
  /** Posisi penjangkaran popover: "left" atau "right" */
  align?: "left" | "right";
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const ITEM_HEIGHT = 40;

const parseTimeValue = (value: string) => {
  const match = value.match(/(\d{2}):(\d{2})/);
  return {
    hour: match?.[1] && HOURS.includes(match[1]) ? match[1] : "07",
    minute: match?.[2] && MINUTES.includes(match[2]) ? match[2] : "00",
  };
};

const clampIndex = (index: number, itemCount: number) =>
  Math.min(itemCount - 1, Math.max(0, index));

/**
 * Komponen Reusable Custom TimePicker (Dual-Wheel Scroll Picker).
 *
 * - Scroll/swipe dan klik sama-sama memperbarui pilihan yang berada di tengah.
 * - Nilai baru dikirim saat tombol "Selesai" ditekan sehingga outside-click berfungsi sebagai cancel.
 * - Mendukung keyboard dengan listbox, aria-activedescendant, dan tombol panah/Home/End.
 * - Popover otomatis memilih arah atas/bawah dan tetap muat pada viewport mobile.
 */
export function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Pilih Jam",
  className = "",
  includeSuffix = true,
  align = "left",
}: TimePickerProps) {
  const initialTime = parseTimeValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [selectedHour, setSelectedHour] = useState(initialTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(initialTime.minute);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourWheelRef = useRef<HTMLDivElement>(null);
  const minuteWheelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const popoverId = useId();
  const hourListId = useId();
  const minuteListId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const parsedValue = parseTimeValue(value);
    const frame = window.requestAnimationFrame(() => {
      hourWheelRef.current?.scrollTo({
        top: HOURS.indexOf(parsedValue.hour) * ITEM_HEIGHT,
        behavior: "auto",
      });
      minuteWheelRef.current?.scrollTo({
        top: MINUTES.indexOf(parsedValue.minute) * ITEM_HEIGHT,
        behavior: "auto",
      });
    });

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isOpen, value]);

  const scrollWheelTo = (
    wheel: HTMLDivElement | null,
    index: number,
    behavior: ScrollBehavior = "auto"
  ) => {
    wheel?.scrollTo({ top: index * ITEM_HEIGHT, behavior });
  };

  const openPicker = () => {
    playClickSound();

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const parsedValue = parseTimeValue(value);
    setSelectedHour(parsedValue.hour);
    setSelectedMinute(parsedValue.minute);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpwards(spaceBelow < 300 && spaceAbove > spaceBelow);
    }

    setIsOpen(true);
  };

  const selectHour = (hour: string) => {
    playClickSound();
    setSelectedHour(hour);
    scrollWheelTo(hourWheelRef.current, HOURS.indexOf(hour));
  };

  const selectMinute = (minute: string) => {
    playClickSound();
    setSelectedMinute(minute);
    scrollWheelTo(minuteWheelRef.current, MINUTES.indexOf(minute));
  };

  const handleWheelScroll = (
    type: "hour" | "minute",
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const values = type === "hour" ? HOURS : MINUTES;
    const index = clampIndex(
      Math.round(event.currentTarget.scrollTop / ITEM_HEIGHT),
      values.length
    );
    const nextValue = values[index];

    if (type === "hour") {
      setSelectedHour((current) => (current === nextValue ? current : nextValue));
    } else {
      setSelectedMinute((current) => (current === nextValue ? current : nextValue));
    }
  };

  const handleWheelKeyDown = (
    type: "hour" | "minute",
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    const values = type === "hour" ? HOURS : MINUTES;
    const selectedValue = type === "hour" ? selectedHour : selectedMinute;
    const currentIndex = values.indexOf(selectedValue);
    let nextIndex = currentIndex;

    if (event.key === "ArrowUp") nextIndex -= 1;
    else if (event.key === "ArrowDown") nextIndex += 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = values.length - 1;
    else return;

    event.preventDefault();
    nextIndex = clampIndex(nextIndex, values.length);
    const nextValue = values[nextIndex];

    if (type === "hour") {
      setSelectedHour(nextValue);
      scrollWheelTo(hourWheelRef.current, nextIndex);
    } else {
      setSelectedMinute(nextValue);
      scrollWheelTo(minuteWheelRef.current, nextIndex);
    }
  };

  const handleDone = () => {
    playClickSound();
    const formatted = includeSuffix
      ? `${selectedHour}:${selectedMinute} WIB`
      : `${selectedHour}:${selectedMinute}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const alignClass = align === "right" ? "right-0" : "left-0";
  const accessibleLabel = label || placeholder;

  return (
    <div className={`relative space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <span id={labelId} className="text-xs font-medium text-slate-300 block">
          {label}
        </span>
      )}

      <button
        type="button"
        onClick={openPicker}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : accessibleLabel}
        className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-xl text-slate-200 flex items-center justify-between transition-all cursor-pointer text-left focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 shadow-sm"
      >
        <span className="truncate font-semibold">{value || placeholder}</span>
        <Clock className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={popoverId}
            role="dialog"
            aria-label={`Pilih ${accessibleLabel}`}
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${alignClass} z-50 w-[270px] max-w-[calc(100vw-2rem)] sm:w-[290px] bg-slate-900 border border-slate-700/90 shadow-2xl rounded-2xl p-3.5 space-y-3 text-slate-200 ring-1 ring-amber-500/20 ${
              openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-around mb-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Jam</span>
                <span>Menit</span>
              </div>

              <div className="relative h-[150px] bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center">
                <div className="absolute top-[55px] left-2 right-2 h-[40px] bg-amber-500/15 border-y border-amber-500/40 rounded-lg pointer-events-none z-10" />

                <div
                  ref={hourWheelRef}
                  id={hourListId}
                  role="listbox"
                  aria-label="Jam"
                  aria-activedescendant={`${hourListId}-${selectedHour}`}
                  tabIndex={0}
                  onScroll={(event) => handleWheelScroll("hour", event)}
                  onKeyDown={(event) => handleWheelKeyDown("hour", event)}
                  className="flex-1 h-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[55px] text-center z-20 touch-pan-y focus:outline-none"
                >
                  {HOURS.map((hour) => {
                    const isSelected = selectedHour === hour;
                    return (
                      <button
                        id={`${hourListId}-${hour}`}
                        key={hour}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => selectHour(hour)}
                        className={`h-[40px] w-full snap-center flex items-center justify-center cursor-pointer font-mono transition-all duration-150 select-none ${
                          isSelected
                            ? "text-amber-400 font-extrabold text-base scale-110"
                            : "text-slate-500 font-medium text-xs hover:text-slate-300"
                        }`}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>

                <span className="text-amber-400 font-bold font-mono text-sm z-20 pb-0.5">
                  :
                </span>

                <div
                  ref={minuteWheelRef}
                  id={minuteListId}
                  role="listbox"
                  aria-label="Menit"
                  aria-activedescendant={`${minuteListId}-${selectedMinute}`}
                  tabIndex={0}
                  onScroll={(event) => handleWheelScroll("minute", event)}
                  onKeyDown={(event) => handleWheelKeyDown("minute", event)}
                  className="flex-1 h-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[55px] text-center z-20 touch-pan-y focus:outline-none"
                >
                  {MINUTES.map((minute) => {
                    const isSelected = selectedMinute === minute;
                    return (
                      <button
                        id={`${minuteListId}-${minute}`}
                        key={minute}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => selectMinute(minute)}
                        className={`h-[40px] w-full snap-center flex items-center justify-center cursor-pointer font-mono transition-all duration-150 select-none ${
                          isSelected
                            ? "text-amber-400 font-extrabold text-base scale-110"
                            : "text-slate-500 font-medium text-xs hover:text-slate-300"
                        }`}
                      >
                        {minute}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

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
