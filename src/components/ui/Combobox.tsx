"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

const normalizeSearchText = (text: string) =>
  text.trim().toLocaleLowerCase("id-ID");

const filterOptions = (options: ComboboxOption[], searchTerm: string) => {
  const normalizedSearch = normalizeSearchText(searchTerm);
  if (!normalizedSearch) return options;

  return options.filter((option) => {
    const searchableText = `${option.label} ${option.subtext ?? ""}`;
    return normalizeSearchText(searchableText).includes(normalizedSearch);
  });
};

/**
 * Komponen Reusable Searchable Combobox Dropdown
 *
 * - Mendukung pencarian, klik, dan navigasi keyboard Arrow/Home/End/Enter/Escape.
 * - Menggunakan pola ARIA combobox + listbox dan menjaga opsi aktif tetap terlihat.
 * - Mengembalikan fokus ke trigger setelah memilih atau membatalkan pilihan.
 * - Menghapus pencarian sementara setiap kali dropdown ditutup.
 * - Menyesuaikan arah dan tinggi dropdown terhadap viewport atau batas Modal.
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
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(288);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const labelId = useId();
  const triggerValueId = useId();
  const popoverId = useId();
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(
    () => filterOptions(options, searchTerm),
    [options, searchTerm]
  );

  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  const measurePlacement = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const dialog = container.closest<HTMLElement>('[role="dialog"]');
    const dialogRect = dialog?.getBoundingClientRect();
    const visibleTop = Math.max(viewportTop, dialogRect?.top ?? viewportTop);
    const visibleBottom = Math.min(viewportBottom, dialogRect?.bottom ?? viewportBottom);
    const spaceAbove = Math.max(0, containerRect.top - visibleTop);
    const spaceBelow = Math.max(0, visibleBottom - containerRect.bottom);
    const shouldOpenUpwards = spaceBelow < 280 && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpwards ? spaceAbove : spaceBelow;

    setOpenUpwards(shouldOpenUpwards);
    setDropdownMaxHeight(Math.max(120, Math.min(288, availableSpace - 8)));
  }, []);

  const closeDropdown = useCallback((restoreTriggerFocus = false) => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(-1);

    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  const openDropdown = (initialPosition: "selected" | "first" | "last" = "selected") => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    let initialIndex = selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1;

    if (initialPosition === "first") initialIndex = options.length > 0 ? 0 : -1;
    if (initialPosition === "last") initialIndex = options.length - 1;

    setSearchTerm("");
    setActiveIndex(initialIndex);
    measurePlacement();
    setIsOpen(true);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const selectOption = (option: ComboboxOption) => {
    onChange(option.value);
    closeDropdown(true);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextSearchTerm = event.target.value;
    const nextFilteredOptions = filterOptions(options, nextSearchTerm);

    setSearchTerm(nextSearchTerm);
    setActiveIndex(nextFilteredOptions.length > 0 ? 0 : -1);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openDropdown(event.key === "ArrowUp" ? "last" : "first");
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        setActiveIndex(-1);
        return;
      }
      setActiveIndex((current) =>
        Math.min(filteredOptions.length - 1, current + 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        setActiveIndex(-1);
        return;
      }
      setActiveIndex((current) =>
        current <= 0 ? Math.max(0, filteredOptions.length - 1) : current - 1
      );
      return;
    }

    if (event.key === "Home" && filteredOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && filteredOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDropdown(true);
      return;
    }

    if (event.key === "Tab") {
      window.setTimeout(() => closeDropdown(false), 0);
    }
  };

  // Keep the keyboard-active option visible without synchronously changing state in an effect.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  // Close on outside pointer and keep placement correct when the mobile viewport changes.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", measurePlacement);
    window.visualViewport?.addEventListener("resize", measurePlacement);
    window.visualViewport?.addEventListener("scroll", measurePlacement);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", measurePlacement);
      window.visualViewport?.removeEventListener("resize", measurePlacement);
      window.visualViewport?.removeEventListener("scroll", measurePlacement);
    };
  }, [closeDropdown, isOpen, measurePlacement]);

  return (
    <div className={`space-y-1 relative ${className}`} ref={containerRef}>
      {label && (
        <span id={labelId} className="text-xs font-medium text-slate-300 block">
          {label}
        </span>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={label ? `${labelId} ${triggerValueId}` : triggerValueId}
        onClick={() => {
          if (isOpen) closeDropdown(false);
          else openDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-lg text-slate-200 flex items-center justify-between transition-colors cursor-pointer text-left focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40"
      >
        <span id={triggerValueId} className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <ChevronsUpDown aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={popoverId}
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{ maxHeight: dropdownMaxHeight }}
            className={`absolute z-[120] left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-1.5 space-y-1 flex flex-col ${
              openUpwards ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {/* Search Input */}
            <div className="relative p-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleInputKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                autoComplete="off"
                className="w-full pl-7 pr-7 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSearchTerm("");
                    setActiveIndex(options.length > 0 ? 0 : -1);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none focus:text-amber-400"
                >
                  <X aria-hidden="true" className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div
              id={listboxId}
              role="listbox"
              aria-label={label ?? placeholder}
              className="overflow-y-auto flex-1 min-h-0 space-y-0.5 pr-0.5 overscroll-contain"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={option.value}
                      id={`${listboxId}-option-${index}`}
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      onClick={() => selectOption(option)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected || isActive
                          ? "bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border border-transparent"
                      }`}
                    >
                      <div className="truncate">
                        <p>{option.label}</p>
                        {option.subtext && <p className="text-[10px] text-slate-400 font-normal">{option.subtext}</p>}
                      </div>
                      {isSelected && <Check aria-hidden="true" className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />}
                    </button>
                  );
                })
              ) : (
                <p role="status" className="text-[11px] text-slate-400 italic p-3 text-center">
                  Tidak ada opsi cocok
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
