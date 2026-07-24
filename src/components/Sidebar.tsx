"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CalendarDays, 
  Calendar,
  FileBarChart, 
  Settings, 
  UserCheck, 
  Building2,
  Timer
} from "lucide-react";
import { playClickSound } from "@/utils/clickSound";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Jadwal Kerja", href: "/schedule", icon: Calendar },
  { label: "Presensi & Kehadiran", href: "/attendance", icon: Clock },
  { label: "Pengajuan Cuti", href: "/leaves", icon: CalendarDays, badge: "5 Baru" },
  { label: "Pengajuan Lembur", href: "/overtime", icon: Timer, badge: "Baru" },
  { label: "Data Karyawan", href: "/employees", icon: Users, badge: "128" },
  { label: "Laporan HR", href: "/reports", icon: FileBarChart },
  { label: "Pengaturan", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col h-screen sticky top-0 border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-teal-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold text-xl">
          HR
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-wide text-white">
            HR Rajaklana
          </h1>
          <span className="text-xs text-amber-400 font-medium tracking-wider uppercase flex items-center gap-1">
            <Building2 className="w-3 h-3 inline" /> Mobile Portal
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Menu Utama
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => playClickSound()}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-amber-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  isActive 
                    ? "bg-amber-700 text-white" 
                    : "bg-slate-800 text-amber-400 border border-amber-500/30"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Card */}
      <div className="p-3 m-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-semibold text-sm">
          HR
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">Admin HRD</p>
          <p className="text-[11px] text-slate-400 truncate">admin@rajaklana.com</p>
        </div>
        <UserCheck className="w-4 h-4 text-amber-400" />
      </div>
    </aside>
  );
}
