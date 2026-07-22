"use client";

import { useHR } from "@/context/HRContext";
import { 
  User, 
  ShieldCheck, 
  Building2, 
  Clock, 
  Calendar, 
  Lock, 
  Bell, 
  LogOut, 
  HelpCircle,
  ChevronRight,
  Phone,
  Mail,
  MapPin
} from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-6 pb-6">
      {/* Header Profile Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-6 border border-slate-800 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/20 text-amber-400 border-2 border-amber-500/40 flex items-center justify-center font-extrabold text-2xl mb-3 shadow-lg shadow-amber-500/20">
          HR
        </div>
        <h1 className="text-lg font-extrabold text-slate-100">Admin HRD (Saya)</h1>
        <p className="text-xs text-amber-400 font-semibold mt-0.5">HR Manager &bull; NIK: RK-2024-000</p>
        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
          <Building2 className="w-3 h-3 text-slate-500" /> Rajaklana Group (Head Office)
        </p>

        <div className="absolute right-0 bottom-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Info Details Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Informasi Pribadi</h3>
        
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-amber-400" /> Email Resmi
            </span>
            <span className="font-semibold text-slate-200">admin@rajaklana.com</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-400" /> WhatsApp / Kontak
            </span>
            <span className="font-semibold text-slate-200">0812-9988-7766</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Shift Utama
            </span>
            <span className="font-semibold text-slate-200">Normal (08:00 - 17:00 WIB)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Sisa Hak Cuti
            </span>
            <span className="font-bold text-amber-400">9 Hari (dari 12)</span>
          </div>
        </div>
      </div>

      {/* App Settings Menu */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-2">Pengaturan Aplikasi</h3>

        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950 hover:bg-slate-800/60 border border-slate-800/80 transition-colors text-xs text-slate-300 cursor-pointer">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Keamanan & Ganti Sandi</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950 hover:bg-slate-800/60 border border-slate-800/80 transition-colors text-xs text-slate-300 cursor-pointer">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Pengaturan Notifikasi Presensi</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950 hover:bg-slate-800/60 border border-slate-800/80 transition-colors text-xs text-slate-300 cursor-pointer">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Bantuan & Kebijakan HR</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Logout Button */}
      <button className="w-full py-3 rounded-xl bg-slate-900 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 text-slate-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
        <LogOut className="w-4 h-4 text-rose-400" />
        <span>Keluar dari Akun</span>
      </button>
    </div>
  );
}
