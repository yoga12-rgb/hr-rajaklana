"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Bell, 
  QrCode, 
  CalendarDays, 
  Clock, 
  Megaphone, 
  CheckCircle2, 
  ChevronRight, 
  CheckCheck,
  UserCheck
} from "lucide-react";
import { useHR } from "@/context/HRContext";
import { Modal } from "@/components/ui/Modal";

export default function Header() {
  const { leaveRequests, attendanceLogs, announcements, approveLeaveRequest, showToast } = useHR();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [activeTab, setActiveTab] = useState<"Semua" | "Cuti" | "Presensi" | "Pengumuman">("Semua");

  const pendingLeaves = leaveRequests.filter((r) => r.status === "Pending");
  const lateAttendance = attendanceLogs.filter((a) => a.status === "Terlambat");

  // Calculate unread count (e.g. pending leaves + late logs + pinned announcements)
  const unreadCount = isRead ? 0 : pendingLeaves.length + lateAttendance.length + announcements.filter(a => a.isPinned).length;

  const handleMarkAllAsRead = () => {
    setIsRead(true);
    showToast("Semua notifikasi ditandai sebagai dibaca", "info");
  };

  return (
    <header className="h-16 bg-slate-900 text-white border-b border-slate-800 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Mobile Brand / Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-teal-400 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 font-bold text-base md:hidden">
          HR
        </div>
        <div className="md:hidden">
          <h1 className="font-bold text-base leading-tight text-white">HR Rajaklana</h1>
          <p className="text-[10px] text-amber-400 font-medium tracking-wide">PORTAL MOBILE</p>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:flex items-center gap-4 w-72">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari karyawan atau NIK..."
              className="w-full pl-9 pr-4 py-1.5 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-slate-200 placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick QR Presensi Button */}
        <Link
          href="/attendance"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 rounded-lg text-xs font-bold shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Absen QR</span>
        </Link>

        {/* Notification Bell Button */}
        <button
          onClick={() => setShowNotifModal(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 relative transition-colors cursor-pointer"
          title="Pusat Notifikasi HR"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="min-w-4 h-4 px-1 text-[9px] font-extrabold text-slate-950 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5 flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Profile Avatar */}
        <Link href="/profile" className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs hover:border-amber-400 transition-colors">
          HR
        </Link>
      </div>

      {/* Notification Center Modal / Bottom Sheet */}
      <Modal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        title="Pusat Notifikasi HRD"
        icon={Bell}
      >
        <div className="space-y-4">
          {/* Header Action & Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(["Semua", "Cuti", "Presensi", "Pengumuman"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 shrink-0 font-medium cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Tandai Dibaca</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
            {/* Category: Cuti (Pending Leave Requests) */}
            {(activeTab === "Semua" || activeTab === "Cuti") && pendingLeaves.map((leave) => (
              <div key={leave.id} className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pengajuan Cuti</span>
                      <h4 className="text-xs font-bold text-slate-200">{leave.employeeName}</h4>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{leave.createdAt}</span>
                </div>
                <p className="text-xs text-slate-300">
                  Mengajukan <strong className="text-amber-400">{leave.type}</strong> ({leave.totalDays} Hari) dari {leave.startDate} s/d {leave.endDate}.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      approveLeaveRequest(leave.id);
                      showToast(`Cuti ${leave.employeeName} berhasil disetujui!`, "success");
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Setujui Langsung</span>
                  </button>
                  <Link
                    href="/leaves"
                    onClick={() => setShowNotifModal(false)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Detail</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}

            {/* Category: Presensi (Late Logs) */}
            {(activeTab === "Semua" || activeTab === "Presensi") && lateAttendance.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Keterlambatan</span>
                      <h4 className="text-xs font-bold text-slate-200">{log.employeeName}</h4>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{log.date}</span>
                </div>
                <p className="text-xs text-slate-300">
                  Absen masuk pukul <strong className="text-rose-400">{log.timeIn}</strong> di {log.location}.
                  {log.notes && <span className="italic text-slate-400 block mt-0.5">&ldquo;{log.notes}&rdquo;</span>}
                </p>
              </div>
            ))}

            {/* Category: Pengumuman (Broadcast) */}
            {(activeTab === "Semua" || activeTab === "Pengumuman") && announcements.map((anc) => (
              <div key={anc.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      {anc.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">{anc.date}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mt-1">{anc.title}</h4>
                <p className="text-xs text-slate-400">{anc.content}</p>
              </div>
            ))}

            {pendingLeaves.length === 0 && lateAttendance.length === 0 && announcements.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">Tidak ada notifikasi saat ini.</p>
            )}
          </div>
        </div>
      </Modal>
    </header>
  );
}
