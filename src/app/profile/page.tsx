"use client";

import { useHR } from "@/context/HRContext";
import { 
  User, 
  Building2, 
  Clock, 
  Calendar, 
  Mail, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  LogOut, 
  Award,
  TrendingUp,
  MapPin,
  Edit3
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";

export default function ProfilePage() {
  const { attendanceLogs, showToast } = useHR();

  // Riwayat Absensi Pribadi (Filter Admin HRD)
  const myAttendance = attendanceLogs.filter(a => a.employeeId === "EMP-999" || a.employeeName.includes("Admin"));

  return (
    <div className="space-y-6 pb-6">
      {/* Header Profile Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left relative z-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 border-2 border-amber-400 flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-amber-500/20 shrink-0">
              HR
            </div>
            <button 
              onClick={() => showToast("Fitur ubah foto profil diaktifkan", "info")}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-extrabold text-slate-100">Admin HRD (Saya)</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> HR Manager
              </span>
            </div>
            <p className="text-xs text-amber-300 font-medium">NIK: RK-2026-000 &bull; Dep: HR & Legal</p>
            <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1 pt-0.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Rajaklana Group Head Office
            </p>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Ringkasan Statistik Kinerja Pribadi */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          title="Tingkat Kehadiran"
          value="98.5%"
          subtext="Bulan Juli 2026"
          icon={CheckCircle2}
          iconColor="text-emerald-400"
        />
        <StatCard
          title="Jam Kerja Bulan Ini"
          value="168 Jam"
          subtext="Sesuai Target Shift"
          icon={Clock}
          iconColor="text-amber-400"
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            title="Sisa Hak Cuti"
            value="9 Hari"
            subtext="Dari Total 12 Hari"
            icon={Calendar}
            iconColor="text-blue-400"
          />
        </div>
      </div>

      {/* Detail Informasi Biodata & Pekerjaan */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Informasi Biodata & Kontak</h3>
          <button 
            onClick={() => showToast("Mode edit profil dibuka", "info")}
            className="text-[11px] text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" /> Edit Profil
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" /> Email Akun
            </span>
            <span className="font-semibold text-slate-200">admin@rajaklana.com</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400" /> Nomor WA / HP
            </span>
            <span className="font-semibold text-slate-200">0812-9988-7766</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Shift Default
            </span>
            <span className="font-semibold text-slate-200">Normal (08:00 - 17:00)</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" /> Penempatan Kerja
            </span>
            <span className="font-semibold text-slate-200">Rajaklana HQ Office</span>
          </div>
        </div>
      </div>

      {/* Riwayat Absensi Pribadi Terakhir */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3 shadow-md">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Riwayat Kehadiran Pribadi</h3>
        
        {myAttendance.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Belum ada riwayat absensi pribadi tercatat hari ini.</p>
        ) : (
          <div className="space-y-2">
            {myAttendance.map((rec) => (
              <div key={rec.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">{rec.date}</h4>
                    <p className="text-[10px] text-slate-400">{rec.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-400">{rec.timeIn}</span>
                  <p className="text-[9px] text-emerald-400 font-semibold">{rec.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout Action */}
      <button 
        onClick={() => showToast("Sesi akun berhasil keluar", "warning")}
        className="w-full py-3 rounded-xl bg-slate-900 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 text-slate-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        <span>Keluar dari Akun Admin</span>
      </button>
    </div>
  );
}
