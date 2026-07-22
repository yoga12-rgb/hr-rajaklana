"use client";

import { useState } from "react";
import { useHR } from "@/context/HRContext";
import { playClickSound } from "@/utils/clickSound";
import { 
  FileBarChart, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  Clock, 
  Calendar, 
  Users, 
  Award, 
  AlertTriangle, 
  Building2,
  CheckCircle2,
  ChevronRight,
  Filter
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { DepartmentChart } from "@/components/ui/DepartmentChart";
import { Combobox } from "@/components/ui/Combobox";

const deptAnalytics = [
  { name: "Produksi", hadir: 98.2, terlambat: 1.8, totalStaf: 42, color: "#f59e0b" },
  { name: "Lapangan", hadir: 95.5, terlambat: 4.5, totalStaf: 35, color: "#14b8a6" },
  { name: "Ops", hadir: 96.0, terlambat: 4.0, totalStaf: 26, color: "#3b82f6" },
  { name: "Finance", hadir: 100, terlambat: 0, totalStaf: 15, color: "#a855f7" },
  { name: "HR", hadir: 100, terlambat: 0, totalStaf: 10, color: "#f59e0b" },
];

const topDisciplineStaff = [
  { name: "Budi Santoso", dept: "Produksi & Operasional", score: "100%", avatarBg: "bg-amber-500/20 text-amber-400" },
  { name: "Siti Rahmawati", dept: "HR & Legal", score: "100%", avatarBg: "bg-blue-500/20 text-blue-400" },
  { name: "Dewi Lestari", dept: "Finance", score: "99.5%", avatarBg: "bg-purple-500/20 text-purple-400" },
];

const warningStaff = [
  { name: "Agus Pratama", dept: "F&B Service", note: "2x Terlambat minggu ini", avatarBg: "bg-amber-500/20 text-amber-400" },
];

export default function ReportsPage() {
  const { employees, attendanceLogs, leaveRequests, showToast } = useHR();
  const [selectedMonth, setSelectedMonth] = useState("Juli 2026");
  const [selectedDept, setSelectedDept] = useState("Semua");

  const handleExport = (type: "excel" | "pdf") => {
    playClickSound();
    const formatName = type === "excel" ? "File Excel (.xlsx)" : "Dokumen PDF (.pdf)";
    showToast(`Berhasil mengunduh Laporan Rekap Presensi & Cuti - ${selectedMonth} (${formatName})`, "success");
  };

  return (
    <div className="space-y-6 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Laporan & Analytics HR</h1>
          <p className="text-xs text-slate-400">Analisis kehadiran, kedisiplinan & rekap ekspor</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("excel")}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Period Filter Selector */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">Periode Laporan:</span>
        </div>
        <Combobox
          className="w-48"
          options={[
            { value: "Juli 2026", label: "Juli 2026 (Berjalan)" },
            { value: "Juni 2026", label: "Juni 2026" },
            { value: "Mei 2026", label: "Mei 2026" },
            { value: "Q2 2026", label: "Kuartal 2 (Q2 2026)" },
          ]}
          value={selectedMonth}
          onChange={(val) => {
            playClickSound();
            setSelectedMonth(val);
          }}
          searchPlaceholder="Cari bulan/kuartal..."
        />
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Rata-rata Kehadiran"
          value="96.8%"
          subtext={<span className="text-amber-400 font-medium">+1.2% dari bulan lalu</span>}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Terlambat"
          value={<>4.5 <span className="text-xs text-slate-400 font-normal">Jam</span></>}
          subtext="Terakumulasi 5 staf"
          icon={Clock}
          valueColor="text-amber-400"
        />
        <StatCard
          title="Cuti Terpakai"
          value={<>18 <span className="text-xs text-slate-400 font-normal">Hari</span></>}
          subtext="Total dari 128 staf"
          icon={Calendar}
          iconColor="text-blue-400"
          valueColor="text-blue-400"
        />
        <StatCard
          title="Tingkat Kedisiplinan"
          value="94.2%"
          subtext={<span className="text-amber-400 font-medium">Kategori Baik</span>}
          icon={Award}
          iconColor="text-purple-400"
        />
      </div>

      {/* Department Analytics Chart Breakdown */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Persentase Kehadiran Per Departemen</span>
          </h3>
          <span className="text-[11px] text-amber-400 font-semibold">{selectedMonth}</span>
        </div>

        <DepartmentChart data={deptAnalytics} />
      </div>

      {/* Top Performers & Warnings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Discipline Staff */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Staf Paling Disiplin</h3>
          </div>
          <div className="space-y-2">
            {topDisciplineStaff.map((staf) => (
              <div key={staf.name} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center ${staf.avatarBg}`}>
                    {staf.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{staf.name}</p>
                    <p className="text-[10px] text-slate-400">{staf.dept}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 font-mono">{staf.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warning / Attention Needed */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Perhatian Khusus HR</h3>
          </div>
          <div className="space-y-2">
            {warningStaff.map((staf) => (
              <div key={staf.name} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center ${staf.avatarBg}`}>
                    {staf.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{staf.name}</p>
                    <p className="text-[10px] text-rose-400 font-medium">{staf.note}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    showToast(`Pengingat WhatsApp kedisiplinan dikirim ke ${staf.name}`, "info");
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                >
                  Ingatkan
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
