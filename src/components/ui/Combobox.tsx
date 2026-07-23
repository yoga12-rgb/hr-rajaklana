"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  subtext?: string;
}

interface ComboboxProps {
  /** Daftar opsi yang dapat dipilih */
  options: ComboboxOption[];
  /** Nilai terpolite yang sedang dipilih (value) */
  value: string;
  /** Callback saat pengguna memilih opsi baru */
  onChange: (value: string) => void;
  /** Teks placeholder saat belum ada yang dipilih */
  placeholder?: string;
  /** Teks placeholder untuk input pencarian */
  searchPlaceholder?: string;
  /** Label opsional di atas komponen */
  label?: string;
  /** Penyesuai kelas warna/margin opsional */
  className?: string;
}

/**
 * Komponen Reusable Searchable Combobox Dropdown
 * 
 * Memungkinkan pengguna untuk mencari opsi via input teks interaktif
 * atau memilih opsi dari daftar dropdown berbasis animasi Framer Motion.
 * 
 * @example
 * <Combobox
 *   label="Pilih Karyawan"
 *   options={employees.map(e => ({ value: e.id, label: e.name, subtext: e.role }))}
 *   value={selectedEmpId}
 *   onChange={setSelectedEmpId}
 * />
 */
export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Pilih salah satu...",
  searchPlaceholder = "Cari...",
  className = "",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openUpwards, setOpenUpwards] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subtext && opt.subtext.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchTerm]);

  // Keyboard Navigation (Industry Standard A11y)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < filteredOptions.length) {
      e.preventDefault();
      onChange(filteredOptions[activeIndex].value);
      setIsOpen(false);
      setSearchTerm("");
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Close dropdown on click outside and measure space
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    // Auto flip logic
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Only flip upwards if space below is severely restricted (< 160px) AND there's plenty of space above (> 240px)
      setOpenUpwards(spaceBelow < 160 && spaceAbove > 240);
    }
    
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`space-y-1 relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && <label className="text-xs font-medium text-slate-300">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-lg text-slate-200 flex items-center justify-between transition-colors cursor-pointer text-left focus:outline-none focus:border-amber-500"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-slate-500">{placeholder}</span>}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[120] left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-1.5 space-y-1 max-h-56 flex flex-col ${
              openUpwards ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {/* Search Input */}
            <div className="relative p-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-7 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="overflow-y-auto flex-1 space-y-0.5 pr-0.5">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected || isActive
                          ? "bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border border-transparent"
                      }`}
                    >
                      <div className="truncate">
                        <p>{option.label}</p>
                        {option.subtext && <p className="text-[10px] text-slate-500 font-normal">{option.subtext}</p>}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />}
                    </button>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-500 italic p-3 text-center">Tidak ada opsi cocok</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
