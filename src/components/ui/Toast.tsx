"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "warning" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className="fixed top-[calc(4.25rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-2rem)] max-w-sm pointer-events-auto"
        >
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border backdrop-blur-xl transition-all ${
              toast.type === "success"
                ? "bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-amber-500/10"
                : toast.type === "warning"
                ? "bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-rose-500/10"
                : "bg-slate-900/95 border-blue-500/40 text-slate-100 shadow-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : toast.type === "warning"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
              }`}>
                {toast.type === "success" && <CheckCircle2 className="w-4 h-4" />}
                {toast.type === "warning" && <AlertTriangle className="w-4 h-4" />}
                {toast.type === "info" && <Info className="w-4 h-4" />}
              </div>
              <span className="text-xs font-semibold tracking-tight text-slate-100">{toast.message}</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xs font-semibold p-1.5 -mr-1 cursor-pointer transition-colors rounded-lg hover:bg-slate-800/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
