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
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] w-full max-w-sm px-4 pointer-events-auto"
        >
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl shadow-2xl border backdrop-blur-md ${
              toast.type === "success"
                ? "bg-slate-900/95 border-amber-500/50 text-slate-100 shadow-amber-500/10"
                : toast.type === "warning"
                ? "bg-slate-900/95 border-rose-500/50 text-slate-100 shadow-rose-500/10"
                : "bg-slate-900/95 border-blue-500/50 text-slate-100 shadow-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
              {toast.type === "warning" && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === "info" && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xs font-semibold p-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
