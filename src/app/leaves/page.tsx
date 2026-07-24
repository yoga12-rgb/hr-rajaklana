"use client";

import { useState } from "react";
import { useHR, LeaveRequest } from "@/context/HRContext";
import { 
  CalendarDays, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Send, 
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

export default function LeavesPage() {
  const {
    leaveRequests,
    preferences,
    submitLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    showToast,
  } = useHR();
  const [activeTab, setActiveTab] = useState<"saya" | "persetujuan">("saya");
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // Form State
  const [leaveType, setLeaveType] = useState<LeaveRequest["type"]>("Cuti Tahunan");
  const [startDate, setStartDate] = useState<string>("2026-07-27");
  const [endDate, setEndDate] = useState<string>("2026-07-28");
  const [reason, setReason] = useState<string>("");

  const myRequests = leaveRequests.filter((request) => request.employeeId === "EMP-999");
  const usedLeaveDays = myRequests
    .filter((request) => request.type === "Cuti Tahunan" && request.status === "Approved")
    .reduce((total, request) => total + request.totalDays, 0);
  const remainingLeaveDays = Math.max(
    0,
    preferences.defaultLeaveBalance - usedLeaveDays
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast("Alasan cuti wajib diisi.", "warning");
      return;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestStart = new Date(today);
    earliestStart.setDate(today.getDate() + preferences.advanceNoticeDays);
    if (start < earliestStart) {
      showToast(
        `Pengajuan cuti minimum ${preferences.advanceNoticeDays} hari sebelum tanggal mulai.`,
        "warning"
      );
      return;
    }

    const totalDays = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    if (leaveType === "Cuti Tahunan" && totalDays > remainingLeaveDays) {
      showToast(`Sisa cuti tahunan hanya ${remainingLeaveDays} hari.`, "warning");
      return;
    }

    submitLeaveRequest(leaveType, startDate, endDate, reason);
    setReason("");
    setShowModal(false);
  };

  const pendingRequests = leaveRequests.filter(r => r.status === "Pending");

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Pengajuan Cuti & Izin</h1>
          <p className="text-xs text-slate-400">Manajemen permohonan cuti & persetujuan HRD</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Cuti</span>
        </button>
      </div>

      {/* Leave Quota Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-5 border border-slate-800 shadow-xl grid grid-cols-3 gap-3 text-center">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Sisa Cuti</p>
          <p className="text-2xl font-extrabold text-amber-400">{remainingLeaveDays} <span className="text-xs text-slate-400 font-normal">Hari</span></p>
        </div>
        <div className="space-y-1 border-x border-slate-800 px-2">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Terpakai</p>
          <p className="text-2xl font-extrabold text-slate-200">{usedLeaveDays} <span className="text-xs text-slate-400 font-normal">Hari</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Hak Cuti</p>
          <p className="text-2xl font-extrabold text-blue-400">{preferences.defaultLeaveBalance} <span className="text-xs text-slate-400 font-normal">Hari</span></p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab("saya")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "saya"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Pengajuan Saya
        </button>
        <button
          onClick={() => setActiveTab("persetujuan")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "persetujuan"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Persetujuan HR</span>
          {pendingRequests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content: Pengajuan Saya */}
      {activeTab === "saya" && (
        <div className="space-y-3">
          {myRequests.map((req) => (
            <div key={req.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {req.type}
                  </span>
                  <h3 className="font-bold text-slate-100 text-xs mt-1.5">{req.reason}</h3>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                  req.status === "Approved"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : req.status === "Rejected"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {req.status === "Approved" ? "Disetujui" : req.status === "Rejected" ? "Ditolak" : "Pending HR"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Durasi: <strong className="text-slate-200 font-mono">{req.totalDays} Hari</strong> ({req.startDate} s/d {req.endDate})</span>
                <span className="text-[10px] text-slate-400">{req.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Persetujuan HR */}
      {activeTab === "persetujuan" && (
        <div className="space-y-3">
          {leaveRequests.map((req) => (
            <div key={req.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                    {req.employeeName.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-xs">{req.employeeName}</h3>
                    <p className="text-[10px] text-slate-400">{req.department} &bull; <span className="text-amber-400">{req.type}</span></p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  req.status === "Approved" ? "bg-amber-500/20 text-amber-400" : req.status === "Rejected" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                }`}>
                  {req.status}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-xs text-slate-300 space-y-1">
                <p><strong>Alasan:</strong> &ldquo;{req.reason}&rdquo;</p>
                <p className="text-[11px] text-slate-400">Tanggal: {req.startDate} s/d {req.endDate} ({req.totalDays} Hari)</p>
              </div>

              {req.status === "Pending" && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => approveLeaveRequest(req.id)}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui Cuti</span>
                  </button>
                  <button
                    onClick={() => rejectLeaveRequest(req.id)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal Pengajuan Cuti */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Form Pengajuan Cuti Baru"
        icon={CalendarDays}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Leave Type Select */}
          <Combobox
            label="Tipe Cuti / Izin"
            options={[
              { value: "Cuti Tahunan", label: "Cuti Tahunan", subtext: `Sisa hak: ${remainingLeaveDays} Hari` },
              { value: "Sakit", label: "Sakit", subtext: "Lampirkan surat keterangan dokter" },
              { value: "Izin Penting", label: "Izin Penting / Khusus", subtext: "Keperluan keluarga / duka" },
              { value: "Cuti Melahirkan", label: "Cuti Melahirkan", subtext: "Sesuai regulasi HRD" },
            ]}
            value={leaveType}
            onChange={(val) => setLeaveType(val as LeaveRequest["type"])}
          />

          {/* Date Range Picker */}
          <DateRangePicker
            label="Periode Tanggal Cuti / Izin"
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
          <p className="text-[10px] text-slate-400">
            Kebijakan demo: ajukan minimal {preferences.advanceNoticeDays} hari sebelum tanggal mulai.
          </p>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Alasan Cuti</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tuliskan keterangan keperluan cuti secara jelas..."
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Permohonan</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
