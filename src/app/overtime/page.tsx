"use client";

import { useState } from "react";
import { 
  Clock, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Check,
  X,
  Timer
} from "lucide-react";
import { useHR } from "@/context/HRContext";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { SwipeableCard } from "@/components/ui/SwipeableCard";

export default function OvertimePage() {
  const { 
    overtimeRequests, 
    employees, 
    submitOvertimeRequest, 
    approveOvertimeRequest, 
    rejectOvertimeRequest,
    showToast 
  } = useHR();

  const [filterStatus, setFilterStatus] = useState<"Semua" | "Pending" | "Approved" | "Rejected">("Semua");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || "EMP-001");
  const [ovtDate, setOvtDate] = useState("2026-07-22");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("20:00");
  const [duration, setDuration] = useState("3");
  const [reason, setReason] = useState("");

  // Helper untuk Kalkulasi Durasi Jam Otomatis
  const calculateDurationHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    
    // Hapus suffix " WIB" jika ada agar fungsi Number() tidak mengembalikan NaN
    const cleanStart = start.replace(/(?:\s+WIB)+$/i, "");
    const cleanEnd = end.replace(/(?:\s+WIB)+$/i, "");

    const [sh, sm] = cleanStart.split(":").map(Number);
    const [eh, em] = cleanEnd.split(":").map(Number);

    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

    const startTotal = sh * 60 + sm;
    let endTotal = eh * 60 + em;

    if (endTotal <= startTotal) {
      endTotal += 24 * 60; // Lintas hari / lembur malam
    }

    const diff = (endTotal - startTotal) / 60;
    return Math.round(diff * 10) / 10;
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const calc = calculateDurationHours(val, endTime);
    setDuration(calc.toString());
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    const calc = calculateDurationHours(startTime, val);
    setDuration(calc.toString());
  };

  const filteredRequests = overtimeRequests.filter((r) => {
    if (filterStatus === "Semua") return true;
    return r.status === filterStatus;
  });

  const totalApprovedHours = overtimeRequests
    .filter((r) => r.status === "Approved")
    .reduce((sum, r) => sum + r.durationHours, 0);

  const pendingCount = overtimeRequests.filter((r) => r.status === "Pending").length;
  const approvedCount = overtimeRequests.filter((r) => r.status === "Approved").length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast("Harap isi alasan pekerjaan lembur", "warning");
      return;
    }

    const durationNum = parseFloat(duration) || 2;
    submitOvertimeRequest(
      selectedEmpId,
      ovtDate,
      `${startTime} WIB`,
      `${endTime} WIB`,
      durationNum,
      reason
    );

    setShowAddModal(false);
    setReason("");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" />
            Pengajuan Lembur & Overtime
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola pengajuan jam lembur operasional staf & verifikasi persetujuan HRD.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Ajukan Lembur</span>
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Lembur Disetujui"
          value={`${totalApprovedHours} Jam`}
          icon={Timer}
          subtext={<span className="text-amber-400 font-medium">+8 jam minggu ini</span>}
        />
        <StatCard
          title="Pending Approval"
          value={pendingCount.toString()}
          icon={AlertCircle}
          subtext={<span className="text-slate-400">Menunggu Verifikasi</span>}
        />
        <StatCard
          title="Pengajuan Disetujui"
          value={approvedCount.toString()}
          icon={CheckCircle2}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar">
        {(["Semua", "Pending", "Approved", "Rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterStatus === tab
                ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {tab === "Approved" ? "Disetujui" : tab === "Rejected" ? "Ditolak" : tab}
          </button>
        ))}
      </div>

      {/* Overtime Request List */}
      <div className="space-y-3">
        {/* Mobile Swipe Hint */}
        {filteredRequests.some((r) => r.status === "Pending") && (
          <p className="text-[10px] text-slate-500 italic text-center sm:hidden">
            💡 Geser kartu ke kanan untuk menyetujui, ke kiri untuk menolak
          </p>
        )}
        {filteredRequests.map((req) => (
          <SwipeableCard
            key={req.id}
            enabled={req.status === "Pending"}
            onSwipeRight={() => approveOvertimeRequest(req.id)}
            onSwipeLeft={() => rejectOvertimeRequest(req.id)}
            rightLabel="Setujui"
            leftLabel="Tolak"
          >
          <div
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {req.employeeName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{req.employeeName}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{req.department}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-mono font-medium">{req.date}</span>
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                req.status === "Approved"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : req.status === "Rejected"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              }`}>
                {req.status === "Approved" && <CheckCircle2 className="w-3 h-3" />}
                {req.status === "Rejected" && <XCircle className="w-3 h-3" />}
                {req.status === "Pending" && <AlertCircle className="w-3 h-3" />}
                <span>{req.status === "Approved" ? "Disetujui" : req.status === "Rejected" ? "Ditolak" : "Pending"}</span>
              </span>
            </div>

            {/* Time slot & Reason */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Jam: <strong className="font-mono">{req.startTime} - {req.endTime}</strong>
                </span>
                <span className="text-[11px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                  Durasi: {req.durationHours} Jam
                </span>
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-slate-400">Pekerjaan:</strong> {req.reason}
              </p>
            </div>

            {/* Approval Action Buttons for HRD/Supervisor */}
            {req.status === "Pending" && (
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => rejectOvertimeRequest(req.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tolak</span>
                </button>
                <button
                  type="button"
                  onClick={() => approveOvertimeRequest(req.id)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Setujui Lembur</span>
                </button>
              </div>
            )}
          </div>
          </SwipeableCard>
        ))}

        {filteredRequests.length === 0 && (
          <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm italic">Tidak ada pengajuan lembur yang cocok dengan filter ini.</p>
          </div>
        )}
      </div>

      {/* Modal Ajukan Lembur */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Form Pengajuan Lembur Staf"
        icon={Clock}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilih Karyawan */}
          <Combobox
            label="Pilih Karyawan / Staf"
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.name} (${emp.department})`,
            }))}
            value={selectedEmpId}
            onChange={setSelectedEmpId}
          />

          {/* Pilih Tanggal Lembur */}
          <DatePicker
            label="Tanggal Lembur"
            value={ovtDate}
            onChange={setOvtDate}
          />

          {/* Time Pickers for Start & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TimePicker
              label="Jam Mulai Lembur"
              value={startTime}
              onChange={handleStartTimeChange}
              includeSuffix={false}
              align="left"
            />
            <TimePicker
              label="Jam Selesai Lembur"
              value={endTime}
              onChange={handleEndTimeChange}
              includeSuffix={false}
              align="right"
            />
          </div>

          {/* Durasi Jam (Automatic Calculation) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Estimasi Durasi (Jam)</label>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                ⚡ Terhitung Otomatis: {duration} Jam
              </span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              step="0.1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-xs font-bold font-mono text-amber-400 focus:outline-none focus:border-amber-500"
              placeholder="Contoh: 3"
              required
            />
          </div>

          {/* Alasan / Task Lembur */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Detail Pekerjaan Lembur</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-xs text-slate-100 focus:outline-none focus:border-amber-500 placeholder-slate-500"
              placeholder="Jelaskan instruksi atau pekerjaan operasional yang dikerjakan saat lembur..."
              required
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
