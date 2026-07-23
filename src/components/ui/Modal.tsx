"use client";

import React, { ReactNode, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { LucideIcon, X } from "lucide-react";

interface ModalProps {
  /** Kontrol status terbuka/tertutupnya modal */
  isOpen: boolean;
  /** Callback saat pengguna menutup modal/bottom sheet */
  onClose: () => void;
  /** Judul header modal */
  title: string;
  /** Ikon Lucide React opsional di samping judul */
  icon?: LucideIcon;
  /** Elemen formulir / konten utama di dalam modal */
  children: ReactNode;
  /** Kelas penyesuai lebar maksimum Tailwind (default: 'max-w-sm') */
  maxWidth?: string;
}

/**
 * Komponen Modal & Mobile Bottom Sheet Universal (Industry Standard)
 * 
 * - Portal: Dirender di document.body untuk menghindari masalah z-index & overflow.
 * - Accessibility (A11y): Mendukung penutupan dengan tombol 'Escape' (Esc) & memiliki atribut ARIA.
 * - Swipe-to-Dismiss: Bagian header dapat ditarik ke bawah (drag-to-close) untuk menutup di layar sentuh.
 * - Body Scroll Lock: Mengunci scroll latar belakang utama saat terbuka.
 * - Responsive: Bottom Sheet pada Mobile (< 640px) & Centered Popup pada Desktop (>= 640px).
 */
export function Modal({
  isOpen,
  onClose,
  title,
  icon: Icon,
  children,
  maxWidth = "max-w-sm"
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const dragControls = useDragControls();
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll input into view & adjust bottom sheet height when virtual keyboard pops up
  const handleFocusIn = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest("input, textarea, select, button, [role='combobox'], [role='button']");
    if (isInteractive) {
      setIsInputFocused(true);
      setTimeout(() => {
        isInteractive.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  };

  const handleFocusOut = () => {
    setTimeout(() => {
      if (contentRef.current && !contentRef.current.contains(document.activeElement)) {
        setIsInputFocused(false);
      }
    }, 100);
  };

  // Industry Standard: Mobile Visual Viewport API listener to track virtual keyboard state 100% accurately
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        // Keyboard is visible if visualViewport height is significantly smaller than full innerHeight
        const isKeyboardVisible = window.visualViewport.height < window.innerHeight * 0.75;
        if (isKeyboardVisible) {
          setIsInputFocused(true);
          const activeEl = document.activeElement as HTMLElement;
          if (activeEl && contentRef.current?.contains(activeEl)) {
            setTimeout(() => {
              activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
          }
        } else {
          setIsInputFocused(false);
        }
      }
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [isOpen]);

  // Hydration check for Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Body Scroll Lock & Escape Key Listener (Industry Standards)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      // Robust iOS Safari scroll lock: position fixed hack
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      
      document.addEventListener("keydown", handleEscape);
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = "auto";
      
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      // Cleanup
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = "auto";
      document.removeEventListener("keydown", handleEscape);
      
      // Only restore scroll if we were actually locked
      if (scrollY && isOpen) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
        >
          <motion.div
            ref={contentRef}
            onFocus={handleFocusIn}
            onBlur={handleFocusOut}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.32 }}
            onClick={(e) => e.stopPropagation()}
            
            /* Framer Motion Drag-to-Close Settings */
            drag="y"
            dragControls={dragControls}
            dragListener={false} // Disable drag on the body so we can still scroll form content
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              // Jika ditarik ke bawah melebihi threshold atau dengan kecepatan tinggi, tutup modal
              if (info.offset.y > 150 || info.velocity.y > 500) {
                onClose();
              }
            }}
            
            className={`bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 ${
              isInputFocused 
                ? "pb-64 sm:pb-8 max-h-[65vh] sm:max-h-[90vh]" 
                : "pb-12 sm:pb-8 max-h-[85vh] sm:max-h-[90vh]"
            } w-full ${maxWidth} space-y-4 shadow-2xl overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y relative transform-gpu will-change-transform`}
          >
            {/* Drag Handle Area (Hanya area ini yang bisa ditarik/swipe-to-close) */}
            <div 
              className="cursor-grab active:cursor-grabbing sm:cursor-auto pb-3 border-b border-slate-800 touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              {/* Mobile Bottom Sheet Handle Pill */}
              <div className="w-12 h-1.5 bg-slate-700/70 rounded-full mx-auto sm:hidden mb-2" />

              <div className="flex items-center justify-between">
                <h3 id="modal-title" className="font-bold text-slate-100 text-sm flex items-center gap-2 select-none">
                  {Icon && <Icon className="w-4 h-4 text-amber-400" />}
                  <span>{title}</span>
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup Modal"
                  className="text-slate-400 hover:text-slate-200 text-xs font-semibold p-1 cursor-pointer transition-colors bg-slate-800/50 sm:bg-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
