"use client";

import Link from "next/link";
import { useHR } from "@/context/HRContext";
import { 
  Users, 
  Clock, 
  CalendarDays, 
  QrCode, 
  CheckCircle2, 
  Building2,
  ChevronRight,
  UserPlus,
  MapPin,
  UserCheck,
  Megaphone,
  Pin,
  Plus
} from "lucide-react";
import { useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";

const miniChartData = [
  { day: "Senin", hadir: 40 },
  { day: "Selasa", hadir: 42 },
  { day: "Rabu", hadir: 38 },
  { day: "Kamis", hadir: 45 },
  { day: "Jumat", hadir: 46 },
];

export default function MobileHRDashboard() {
  const { 
    userClockedIn, 
    currentUserClockInTime, 
    clockIn, 
    clockOut, 
    employees, 
    attendanceLogs, 
    leaveRequests,
    announcements,
    addAnnouncement,
    approveLeaveRequest,
    rejectLeaveRequest
  } = useHR();

  const [showAncModal, setShowAncModal] = useState(false);
  const [ancTitle, setAncTitle] = useState("");
  const [ancContent, setAncContent] = useState("");
  const [ancCategory, setAncCategory] = useState<"Info K3" | "Event Perusahaan" | "Kebijakan HR" | "Operasional">("Operasional");

  const handleAncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ancTitle.trim() || !ancContent.trim()) return;
    addAnnouncement(ancTitle, ancContent, ancCategory, true);
    setAncTitle("");
    setAncContent("");
    setShowAncModal(false);
  };

  const pendingLeaves = leaveRequests.filter(r => r.status === "Pending");
  const onTimeCount = attendanceLogs.filter(a => a.status === "Tepat Waktu").length;

  return (
    <div className="space-y-5 pb-6">
      {/* Mobile User Quick Status Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-5 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
              HR
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">Halo, Admin HRD</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-amber-400" /> Rajaklana HQ
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
            Online
          </span>
        </div>

        {/* Quick Mobile Action Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3 relative z-10">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Status Absensi Anda:</p>
            <p className="text-xs font-bold text-slate-200 mt-0.5">
              {userClockedIn 
                ? `Sudah Absen Masuk (${currentUserClockInTime})` 
                : "Belum Absen Masuk Hari Ini"}
            </p>
          </div>
          {userClockedIn ? (
            <button
              onClick={() => clockOut()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-200 border border-slate-700 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
            >
              Absen Pulang
            </button>
          ) : (
            <button
              onClick={() => clockIn("Absen Cepat via Dashboard")}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Absen Masuk</span>
            </button>
          )}
        </div>

        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Quick Action Grid Icons */}
      <div className="grid grid-cols-4 gap-3">
        <Link href="/employees" className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <UserPlus className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium text-slate-300 text-center">Data Staf</span>
        </Link>

        <Link href="/attendance" className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium text-slate-300 text-center">Presensi</span>
        </Link>

        <Link href="/leaves" className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <CalendarDays className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium text-slate-300 text-center">Cuti & Izin</span>
        </Link>

        <Link href="/profile" className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium text-slate-300 text-center">Profil Saya</span>
        </Link>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Total Karyawan"
          value={<>{employees.length} <span className="text-xs font-normal text-slate-400">org</span></>}
          subtext={<span className="text-amber-400 font-medium">+4 aktif baru</span>}
          icon={Users}
        />

        <StatCard
          title="Kehadiran Hari Ini"
          value={<>{attendanceLogs.length} <span className="text-xs font-normal text-slate-400">log</span></>}
          subtext={`${onTimeCount} Tepat Waktu`}
          icon={UserCheck}
          iconColor="text-blue-400"
        >
          {/* Mini Sparkline Chart */}
          <div className="h-10 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={miniChartData}>
                <Line type="monotone" dataKey="hadir" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </StatCard>
      </div>

      {/* HR Announcements Bulletin Board */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Pengumuman HRD</h3>
          </div>
          <button
            onClick={() => setShowAncModal(true)}
            className="text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Buat</span>
          </button>
        </div>

        <div className="space-y-2.5 pt-1">
          {announcements.map((anc) => (
            <div key={anc.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {anc.isPinned && <Pin className="w-3 h-3 text-amber-400 rotate-45 shrink-0" />}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {anc.category}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">{anc.date}</span>
              </div>
              <h4 className="font-bold text-slate-200 text-xs">{anc.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{anc.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Leave Requests Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Persetujuan Cuti</h3>
          </div>
          <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
            {pendingLeaves.length} Pending
          </span>
        </div>

        {pendingLeaves.length > 0 ? (
          <div className="space-y-2.5 pt-1">
            {pendingLeaves.map((leave) => (
              <div key={leave.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">{leave.employeeName}</p>
                    <p className="text-[11px] text-slate-400">{leave.department} &bull; <span className="text-amber-400">{leave.type}</span></p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{leave.startDate}</span>
                </div>
                <p className="text-xs text-slate-300 italic">&ldquo;{leave.reason}&rdquo;</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => approveLeaveRequest(leave.id)}
                    className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                  </button>
                  <button
                    onClick={() => rejectLeaveRequest(leave.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-3">Tidak ada pengajuan cuti yang menunggu persetujuan.</p>
        )}
      </div>

      {/* Realtime Attendance Feed */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Presensi Realtime</h3>
          </div>
          <Link href="/attendance" className="text-[11px] text-amber-400 font-semibold flex items-center gap-0.5 hover:underline">
            Semua <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-slate-800/80">
          {attendanceLogs.slice(0, 4).map((emp) => (
            <div key={emp.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {emp.employeeName.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{emp.employeeName}</p>
                  <p className="text-[10px] text-slate-400">{emp.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-mono text-slate-300">{emp.timeIn}</p>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                  emp.status === "Tepat Waktu"
                    ? "bg-amber-500/10 text-amber-400"
                    : emp.status === "Terlambat"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {emp.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Buat Pengumuman Baru */}
      <Modal
        isOpen={showAncModal}
        onClose={() => setShowAncModal(false)}
        title="Publikasikan Pengumuman HRD"
        icon={Megaphone}
      >
        <form onSubmit={handleAncSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Judul Pengumuman</label>
            <input
              type="text"
              value={ancTitle}
              onChange={(e) => setAncTitle(e.target.value)}
              placeholder="Contoh: Briefing Gabungan Shift Pagi"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <Combobox
            label="Kategori"
            options={[
              { value: "Operasional", label: "Operasional" },
              { value: "Info K3", label: "Info K3" },
              { value: "Event Perusahaan", label: "Event Perusahaan" },
              { value: "Kebijakan HR", label: "Kebijakan HR" },
            ]}
            value={ancCategory}
            onChange={(val) => setAncCategory(val as any)}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Isi Pengumuman</label>
            <textarea
              rows={3}
              value={ancContent}
              onChange={(e) => setAncContent(e.target.value)}
              placeholder="Tuliskan detail informasi pengumuman..."
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAncModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Publikasikan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
