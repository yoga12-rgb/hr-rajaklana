"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CalendarDays, 
  Calendar,
  MoreHorizontal,
  FileBarChart,
  Settings,
  ChevronRight,
  Grid2X2,
  Timer
} from "lucide-react";
import { motion } from "framer-motion";
import { playClickSound } from "@/utils/clickSound";
import { Modal } from "@/components/ui/Modal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  isCenterFAB?: boolean;
  isMoreMenu?: boolean;
}

const navItems: NavItem[] = [
  { label: "Beranda", href: "/", icon: LayoutDashboard },
  { label: "Jadwal", href: "/schedule", icon: Calendar },
  { label: "Presensi", href: "/attendance", icon: Clock, isCenterFAB: true },
  { label: "Cuti", href: "/leaves", icon: CalendarDays },
  { label: "Lainnya", href: "#more", icon: MoreHorizontal, isMoreMenu: true },
];

/**
 * Mobile Bottom Navigation Bar Berstandar UI/UX Industri
 * 
 * - Menyembunyikan diri otomatis saat Virtual Keyboard terbuka (Industry Standard UX).
 * - 5 Menu Ergonomis untuk jangkauan jempol (Thumb-Driven UX).
 * - Tombol Presensi di tengah dibuat sebagai Center Floating Action Button (FAB) bercahaya.
 * - Menu ke-5 "Lainnya ⋯" memicu Mobile Bottom Sheet.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Industry Standard: Menyembunyikan BottomNav saat pengguna mengetik agar keyboard tidak terhalang
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };
    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const secondaryPages = ["/employees", "/reports", "/overtime", "/profile", "/settings"];
  const isSecondaryActive = secondaryPages.some(
    (page) => pathname === page || pathname.startsWith(page + "/")
  );

  const checkIsActive = (item: NavItem) => {
    if (item.isMoreMenu) return isSecondaryActive;
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const getActiveIndex = () => {
    if (pathname === "/") return 0;
    if (pathname.startsWith("/schedule")) return 1;
    if (pathname.startsWith("/attendance")) return 2;
    if (pathname.startsWith("/leaves")) return 3;
    if (isSecondaryActive) return 4;
    return 0;
  };
  const activeIndex = getActiveIndex();

  return (
    <>
      <nav 
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 z-50 px-3 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_25px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-in-out ${
          isKeyboardOpen ? "translate-y-[150%] pointer-events-none" : "translate-y-0"
        }`}
      >
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          {/* Persistent Sliding Active Indicator Line - Uses absolute coordinate animation to prevent Framer Motion Y-scroll offset bugs */}
          <motion.div
            initial={false}
            animate={{
              left: `${activeIndex * 20 + 10}%`,
              opacity: activeIndex === 2 ? 0 : 1,
              scale: activeIndex === 2 ? 0.4 : 1,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="absolute -top-[10px] -translate-x-1/2 w-7 h-1 bg-amber-400 rounded-full shadow-[0_1px_12px_rgba(245,158,11,0.8)] z-[60] pointer-events-none"
          />

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = checkIsActive(item);

            if (item.isCenterFAB) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playClickSound()}
                  className="flex flex-col items-center justify-center -mt-4 relative z-10 group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-slate-950 shadow-md shadow-amber-500/30 ring-4 ring-slate-950 scale-105"
                      : "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 ring-4 ring-slate-950 group-hover:scale-105"
                  }`}>
                    <Icon className="w-4.5 h-4.5 stroke-[2.5]" />
                  </div>
                  <span className={`text-[10px] font-bold mt-1 tracking-tight ${
                    isActive ? "text-amber-400 font-extrabold" : "text-amber-400/80"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            if (item.isMoreMenu) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setShowMoreSheet(true);
                  }}
                  className="flex-1 flex flex-col items-center justify-center py-1 relative transition-colors cursor-pointer"
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? "text-amber-400 scale-110"
                      : "text-slate-400 hover:text-slate-200"
                  }`} />
                  <span className={`text-[10px] mt-1 tracking-tight transition-colors ${
                    isActive
                      ? "text-amber-400 font-bold"
                      : "text-slate-400 font-medium"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => playClickSound()}
                className="flex-1 flex flex-col items-center justify-center py-1 relative transition-colors"
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${
                  isActive
                    ? "text-amber-400 scale-110"
                    : "text-slate-400 hover:text-slate-200"
                }`} />
                <span className={`text-[10px] mt-1 tracking-tight transition-colors ${
                  isActive
                    ? "text-amber-400 font-bold"
                    : "text-slate-400 font-medium"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu Mobile Bottom Sheet */}
      <Modal
        isOpen={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        title="Menu & Layanan HRD"
        icon={Grid2X2}
      >
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-400">Pilih menu navigasi lainnya untuk mengelola sistem operasional:</p>

          <div className="space-y-2">
            {/* Menu 1: Data Karyawan */}
            <Link
              href="/employees"
              onClick={() => {
                playClickSound();
                setShowMoreSheet(false);
              }}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">Data Karyawan & Staf</h4>
                  <p className="text-[11px] text-slate-400">Kelola informasi staf, NIK, & status kerja</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">128 Staf</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>

            {/* Menu 2: Pengajuan Lembur */}
            <Link
              href="/overtime"
              onClick={() => {
                playClickSound();
                setShowMoreSheet(false);
              }}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Timer className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">Pengajuan Lembur & Overtime</h4>
                  <p className="text-[11px] text-slate-400">Ajukan jam lembur & persetujuan HRD</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">Baru</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>

            {/* Menu 2: Laporan HR */}
            <Link
              href="/reports"
              onClick={() => {
                playClickSound();
                setShowMoreSheet(false);
              }}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileBarChart className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">Laporan & Analytics HR</h4>
                  <p className="text-[11px] text-slate-400">Grafik kehadiran, rekapitulasi, & ekspor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">Grafik</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>

            {/* Menu 3: Pengaturan & Profil */}
            <Link
              href="/settings"
              onClick={() => {
                playClickSound();
                setShowMoreSheet(false);
              }}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">Pengaturan & Profil Akun</h4>
                  <p className="text-[11px] text-slate-400">Manajemen lokasi GPS, jam kerja, & profil HR</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">Setting</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
