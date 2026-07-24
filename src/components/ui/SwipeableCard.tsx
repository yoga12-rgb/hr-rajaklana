"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Check, X } from "lucide-react";

interface SwipeableCardProps {
  children: React.ReactNode;
  /** Callback saat pengguna mengusap kartu ke kanan (Approve action) */
  onSwipeRight?: () => void;
  /** Callback saat pengguna mengusap kartu ke kiri (Reject action) */
  onSwipeLeft?: () => void;
  /** Label aksi usap kanan (default: "Setujui") */
  rightLabel?: string;
  /** Label aksi usap kiri (default: "Tolak") */
  leftLabel?: string;
  /** Aktifkan/nonaktifkan kemampuan swipe (default: true) */
  enabled?: boolean;
}

const SWIPE_THRESHOLD = 80;

/**
 * Komponen Reusable Swipe-to-Action Card (Industry Standard)
 * 
 * - Geser ke kanan untuk menyetujui (hijau).
 * - Geser ke kiri untuk menolak (merah).
 * - Background action terungkap secara proporsional saat diusap.
 * - Snap kembali jika usapan tidak melebihi threshold.
 * - Dilengkapi Haptic Feedback saat threshold tercapai.
 * 
 * @example
 * <SwipeableCard onSwipeRight={handleApprove} onSwipeLeft={handleReject}>
 *   <div>Card Content</div>
 * </SwipeableCard>
 */
export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = "Setujui",
  leftLabel = "Tolak",
  enabled = true,
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  // Background opacity based on drag distance
  const leftBgOpacity = useTransform(x, [-200, -SWIPE_THRESHOLD, 0], [1, 0.8, 0]);
  const rightBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD, 200], [0, 0.8, 1]);

  // Scale animation for action icons
  const leftIconScale = useTransform(x, [-200, -SWIPE_THRESHOLD, 0], [1.2, 1, 0.5]);
  const rightIconScale = useTransform(x, [0, SWIPE_THRESHOLD, 200], [0.5, 1, 1.2]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    if (info.offset.x > SWIPE_THRESHOLD && onSwipeRight) {
      // Haptic feedback for confirmed action
      try { navigator.vibrate?.([10, 30, 15]); } catch {}
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD && onSwipeLeft) {
      try { navigator.vibrate?.([10, 30, 15]); } catch {}
      onSwipeLeft();
    }
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Left Background (Reject - Red) - appears when swiping left */}
      <motion.div
        style={{ opacity: leftBgOpacity }}
        className="absolute inset-0 bg-gradient-to-r from-transparent to-rose-600/90 rounded-2xl flex items-center justify-end pr-6"
      >
        <motion.div style={{ scale: leftIconScale }} className="flex items-center gap-2 text-white font-bold text-sm">
          <X className="w-5 h-5" />
          <span>{leftLabel}</span>
        </motion.div>
      </motion.div>

      {/* Right Background (Approve - Green) - appears when swiping right */}
      <motion.div
        style={{ opacity: rightBgOpacity }}
        className="absolute inset-0 bg-gradient-to-l from-transparent to-emerald-600/90 rounded-2xl flex items-center justify-start pl-6"
      >
        <motion.div style={{ scale: rightIconScale }} className="flex items-center gap-2 text-white font-bold text-sm">
          <Check className="w-5 h-5 stroke-[3]" />
          <span>{rightLabel}</span>
        </motion.div>
      </motion.div>

      {/* Draggable Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        className={`relative z-10 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
