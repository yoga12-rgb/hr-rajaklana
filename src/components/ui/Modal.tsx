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
  /** Kelas penyesuai lebar maksimum Tailwind (default: 'sm:max-w-sm') */
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
  maxWidth = "sm:max-w-sm"
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const dragControls = useDragControls();
  const contentRef = useRef<HTMLDivElement>(null);

  // Helper to safely scroll element into view INSIDE the modal scroll container only (prevents breaking window scroll lock on iOS Safari)
  const scrollElementInsideModal = (target: HTMLElement) => {
    if (!contentRef.current || !target) return;
    const container = contentRef.current;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
    const targetScrollTop = relativeTop - container.clientHeight / 2 + targetRect.height / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
  };

  // Auto-scroll input into view & adjust bottom sheet height when virtual keyboard pops up
  const handleFocusIn = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest("input, textarea, select, button, [role='combobox'], [role='button']") as HTMLElement;
    if (isInteractive) {
      setIsInputFocused(true);
      setTimeout(() => {
        scrollElementInsideModal(isInteractive);
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
              scrollElementInsideModal(activeEl);
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

  // Body Scroll Lock & Escape Key Listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Ultimate iOS Scroll Trap (DOM-traversal for nested scroll containers like Combobox)
  useEffect(() => {
    if (!isOpen) return;
    
    let initialClientY = -1;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.targetTouches.length > 0) {
        initialClientY = e.targetTouches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.targetTouches.length !== 1) return;
      
      const clientY = e.targetTouches[0].clientY;
      const isUp = clientY > initialClientY; // Swiping down (scrolling up)
      const isDown = clientY < initialClientY; // Swiping up (scrolling down)
      
      // Find the closest scrollable parent
      let target = e.target as HTMLElement | null;
      let scrollable: HTMLElement | null = null;
      
      while (target && target !== document.body && target !== document.documentElement) {
        const style = window.getComputedStyle(target);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          // Check if it actually has overflowing content
          if (target.scrollHeight > target.clientHeight) {
            scrollable = target;
            break;
          }
        }
        target = target.parentElement;
      }

      // 1. If touching outside any scrollable container, block completely!
      if (!scrollable) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      // 2. If scrollable container is at the boundary, block scroll chaining!
      if (isUp && scrollable.scrollTop <= 0) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      
      if (isDown && Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      
      // 3. Otherwise, let native scroll work on this specific container
      e.stopPropagation();
    };

    // capture: true ensures we intercept before Framer Motion or React portals can stopPropagation
    document.addEventListener("touchstart", handleTouchStart, { passive: false, capture: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, { capture: true });
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
    };
  }, [isOpen]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
        >
          {/* Backdrop Overlay - Separate element with touch-none & onTouchMove preventDefault to completely freeze iOS background */}
          <div
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm touch-none"
          />

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
                ? "pb-[max(16rem,env(safe-area-inset-bottom))] sm:pb-8 max-h-[75vh] sm:max-h-[90vh]" 
                : "pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-8 max-h-[90vh]"
            } w-full ${maxWidth} space-y-4 shadow-2xl overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y relative z-10 transform-gpu will-change-transform`}
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
