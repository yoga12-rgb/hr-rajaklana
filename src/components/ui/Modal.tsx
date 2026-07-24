"use client";

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

interface ScrollLockSnapshot {
  scrollY: number;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
}

const subscribeToClient = () => () => undefined;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let scrollLockCount = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;

const isKeyboardInput = (element: Element | null): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;
  return element.matches("input, textarea, select, [contenteditable='true']");
};

const lockBodyScroll = () => {
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;

  const body = document.body;
  const html = document.documentElement;
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

  scrollLockSnapshot = {
    scrollY,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    htmlOverflow: html.style.overflow,
  };

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
  }
  html.style.overflow = "hidden";
};

const unlockBodyScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0 || !scrollLockSnapshot) return;

  const body = document.body;
  const html = document.documentElement;
  const snapshot = scrollLockSnapshot;

  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.left = snapshot.bodyLeft;
  body.style.right = snapshot.bodyRight;
  body.style.width = snapshot.bodyWidth;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  html.style.overflow = snapshot.htmlOverflow;

  scrollLockSnapshot = null;
  window.scrollTo(0, snapshot.scrollY);
};

/**
 * Komponen Modal & Mobile Bottom Sheet Universal (Industry Standard)
 * 
 * - Portal: Dirender di document.body untuk menghindari masalah z-index & overflow.
 * - Accessibility (A11y): Focus trap, initial/restore focus, tombol Escape, dan atribut ARIA dialog.
 * - Swipe-to-Dismiss: Bagian header dapat ditarik ke bawah (drag-to-close) untuk menutup di layar sentuh.
 * - Body Scroll Lock: Mengunci posisi body secara reference-counted agar aman di iOS dan multi-modal.
 * - Smart Keyboard: Padding dan auto-scroll hanya aktif untuk input yang benar-benar memunculkan keyboard.
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
  const mounted = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const dragControls = useDragControls();
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  // Helper to safely scroll element into view INSIDE the modal scroll container only (prevents breaking window scroll lock on iOS Safari)
  const scrollElementInsideModal = useCallback((target: HTMLElement) => {
    if (!contentRef.current || !target) return;
    const container = contentRef.current;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
    const targetScrollTop = relativeTop - container.clientHeight / 2 + targetRect.height / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
  }, []);

  // Auto-scroll input into view & adjust bottom sheet height when virtual keyboard pops up
  const handleFocusIn = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const keyboardInput = target.closest(
      "input, textarea, select, [contenteditable='true']"
    ) as HTMLElement | null;

    if (keyboardInput) {
      setIsInputFocused(true);
      window.setTimeout(() => {
        scrollElementInsideModal(keyboardInput);
      }, 150);
    }
  };

  const handleFocusOut = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const keyboardInputIsActive =
        isKeyboardInput(activeElement) &&
        Boolean(contentRef.current?.contains(activeElement));

      if (!keyboardInputIsActive) {
        setIsInputFocused(false);
      }
    }, 100);
  };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    setIsInputFocused(false);
    onCloseRef.current();
  }, []);

  // Industry Standard: Mobile Visual Viewport API listener to track virtual keyboard state 100% accurately
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        const activeElement = document.activeElement;
        const activeInputIsInside =
          isKeyboardInput(activeElement) && Boolean(contentRef.current?.contains(activeElement));
        const keyboardGap = window.innerHeight - viewport.height;
        const isKeyboardVisible = keyboardGap > Math.max(150, window.innerHeight * 0.2);

        if (activeInputIsInside) {
          setIsInputFocused(true);
          if (isKeyboardVisible) {
            window.setTimeout(() => {
              scrollElementInsideModal(activeElement);
            }, 100);
          }
        } else if (!isKeyboardVisible) {
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
  }, [isOpen, scrollElementInsideModal]);

  // Reference-counted iOS body lock, Escape handling, focus trap, and focus restoration.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key !== "Tab" || !contentRef.current) return;

      const focusableElements = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        e.preventDefault();
        contentRef.current.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!contentRef.current.contains(activeElement)) {
        e.preventDefault();
        (e.shiftKey ? lastElement : firstElement).focus();
      } else if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    lockBodyScroll();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [handleClose, isOpen]);

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
      let target = e.target as Node | null;
      if (target && target.nodeType === 3) {
        target = target.parentNode; // Fix text node target issue on Safari
      }
      let elementTarget = target as HTMLElement | null;
      let scrollable: HTMLElement | null = null;
      
      while (elementTarget && elementTarget !== document.body && elementTarget !== document.documentElement) {
        const style = window.getComputedStyle(elementTarget);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          // Check if it actually has overflowing content
          if (elementTarget.scrollHeight > elementTarget.clientHeight) {
            scrollable = elementTarget;
            break;
          }
        }
        elementTarget = elementTarget.parentElement;
      }

      // 1. If touching outside any scrollable container, block completely!
      if (!scrollable) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      // 2. If scrollable container is at the boundary, block scroll chaining!
      // Using a 2px tolerance because iOS Safari often returns fractional sub-pixel scrollTop values (e.g. 0.5)
      if (isUp && scrollable.scrollTop <= 2) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      
      if (isDown && Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight - 2) {
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
            onClick={handleClose}
            onTouchMove={(e) => e.preventDefault()}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm touch-none"
          />

          <motion.div
            ref={contentRef}
            onFocus={handleFocusIn}
            onBlur={handleFocusOut}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
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
                handleClose();
              }
            }}
            
            className={`bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 ${
              isInputFocused 
                ? "pb-[max(16rem,env(safe-area-inset-bottom))] sm:pb-8 max-h-[75vh] sm:max-h-[90vh]" 
                : "pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-8 max-h-[90vh]"
            } w-full ${maxWidth} space-y-4 shadow-2xl overflow-y-auto overflow-x-hidden overscroll-contain relative z-10 transform-gpu will-change-transform`}
          >
            {/* Drag Handle Area (Hanya area ini yang bisa ditarik/swipe-to-close) */}
            <div 
              className="cursor-grab active:cursor-grabbing sm:cursor-auto pb-3 border-b border-slate-800 touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              {/* Mobile Bottom Sheet Handle Pill */}
              <div className="w-12 h-1.5 bg-slate-700/70 rounded-full mx-auto sm:hidden mb-2" />

              <div className="flex items-center justify-between">
                <h3 id={titleId} className="font-bold text-slate-100 text-sm flex items-center gap-2 select-none">
                  {Icon && <Icon className="w-4 h-4 text-amber-400" />}
                  <span>{title}</span>
                </h3>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleClose}
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
