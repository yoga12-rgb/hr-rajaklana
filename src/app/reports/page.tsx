"use client";

import { useState } from "react";
import { useHR } from "@/context/HRContext";
import { playClickSound } from "@/utils/clickSound";
import { 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  Clock, 
  Calendar, 
  Award, 
  AlertTriangle, 
  Building2,
  Copy
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { DepartmentChart } from "@/components/ui/DepartmentChart";
import { Combobox } from "@/components/ui/Combobox";

const PERIOD_OPTIONS = [
  { value: "Juli 2026", label: "Juli 2026 (Berjalan)" },
  { value: "Juni 2026", label: "Juni 2026" },
  { value: "Mei 2026", label: "Mei 2026" },
  { value: "Q2 2026", label: "Kuartal 2 (Q2 2026)" },
];

const MONTH_INDEX: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  jul: 7,
};

const CHART_COLORS = ["#f59e0b", "#3b82f6", "#a855f7", "#14b8a6", "#f43f5e"];

const parseYearMonth = (value: string) => {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  }

  const localizedMatch = value.toLocaleLowerCase("id-ID").match(
    /\d{1,2}\s+([a-z]+)\s+(\d{4})/
  );
  if (!localizedMatch) return null;

  const month = MONTH_INDEX[localizedMatch[1]];
  return month ? { year: Number(localizedMatch[2]), month } : null;
};

const matchesPeriod = (value: string, period: string) => {
  const parsedDate = parseYearMonth(value);
  if (!parsedDate) return false;

  if (period === "Q2 2026") {
    return parsedDate.year === 2026 && parsedDate.month >= 4 && parsedDate.month <= 6;
  }

  const [monthName, yearValue] = period.toLocaleLowerCase("id-ID").split(" ");
  return parsedDate.year === Number(yearValue) && parsedDate.month === MONTH_INDEX[monthName];
};

const escapeCsvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export default function ReportsPage() {
  const { employees, attendanceLogs, leaveRequests, showToast } = useHR();
  const [selectedMonth, setSelectedMonth] = useState("Juli 2026");
  const [selectedDept, setSelectedDept] = useState("Semua");

  const departmentOptions = [
    { value: "Semua", label: "Semua Departemen" },
    ...Array.from(new Set(employees.map((employee) => employee.department)))
      .sort()
      .map((department) => ({ value: department, label: department })),
  ];

  const filteredEmployees = employees.filter(
    (employee) => selectedDept === "Semua" || employee.department === selectedDept
  );
  const filteredAttendance = attendanceLogs.filter(
    (record) =>
      matchesPeriod(record.date, selectedMonth) &&
      (selectedDept === "Semua" || record.department === selectedDept)
  );
  const filteredLeaves = leaveRequests.filter(
    (request) =>
      matchesPeriod(request.startDate, selectedMonth) &&
      (selectedDept === "Semua" || request.department === selectedDept)
  );

  const employeeIds = new Set(filteredEmployees.map((employee) => employee.id));
  const presentEmployeeIds = new Set(
    filteredAttendance
      .filter((record) => record.status === "Tepat Waktu" || record.status === "Terlambat")
      .map((record) => record.employeeId)
      .filter((employeeId) => employeeIds.has(employeeId))
  );
  const attendanceRate = filteredEmployees.length > 0
    ? (presentEmployeeIds.size / filteredEmployees.length) * 100
    : 0;
  const lateRecords = filteredAttendance.filter((record) => record.status === "Terlambat");
  const approvedLeaveDays = filteredLeaves
    .filter((request) => request.status === "Approved")
    .reduce((total, request) => total + request.totalDays, 0);
  const disciplineRate = filteredAttendance.length > 0
    ? (filteredAttendance.filter((record) => record.status === "Tepat Waktu").length /
        filteredAttendance.length) *
      100
    : 0;

  const departments = Array.from(
    new Set(filteredEmployees.map((employee) => employee.department))
  );
  const deptAnalytics = departments.map((department, index) => {
    const departmentEmployees = filteredEmployees.filter(
      (employee) => employee.department === department
    );
    const departmentEmployeeIds = new Set(
      departmentEmployees.map((employee) => employee.id)
    );
    const departmentLogs = filteredAttendance.filter(
      (record) => record.department === department
    );
    const presentIds = new Set(
      departmentLogs
        .filter((record) => record.status === "Tepat Waktu" || record.status === "Terlambat")
        .map((record) => record.employeeId)
        .filter((employeeId) => departmentEmployeeIds.has(employeeId))
    );

    return {
      name: department.replace(/^Area Operasional\s+/i, "").slice(0, 12),
      hadir:
        departmentEmployees.length > 0
          ? Number(((presentIds.size / departmentEmployees.length) * 100).toFixed(1))
          : 0,
      terlambat: departmentLogs.filter((record) => record.status === "Terlambat").length,
      totalStaf: departmentEmployees.length,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  const staffScores = Array.from(
    filteredAttendance.reduce((scores, record) => {
      const current = scores.get(record.employeeId) ?? {
        name: record.employeeName,
        dept: record.department,
        total: 0,
        onTime: 0,
      };
      current.total += 1;
      if (record.status === "Tepat Waktu") current.onTime += 1;
      scores.set(record.employeeId, current);
      return scores;
    }, new Map<string, { name: string; dept: string; total: number; onTime: number }>())
  )
    .map(([, staff]) => ({
      ...staff,
      score: staff.total > 0 ? (staff.onTime / staff.total) * 100 : 0,
    }))
    .sort((a, b) => b.score - a.score);

  const topDisciplineStaff = staffScores.slice(0, 3);
  const warningStaff = Array.from(
    lateRecords.reduce((warnings, record) => {
      const current = warnings.get(record.employeeId) ?? {
        name: record.employeeName,
        dept: record.department,
        lateCount: 0,
      };
      current.lateCount += 1;
      warnings.set(record.employeeId, current);
      return warnings;
    }, new Map<string, { name: string; dept: string; lateCount: number }>())
  ).map(([, staff]) => staff);

  const handleExportCsv = () => {
    playClickSound();
    const rows: Array<Array<string | number>> = [
      ["Laporan HR Rajaklana", selectedMonth, selectedDept],
      [],
      ["Kehadiran"],
      ["Nama", "Departemen", "Tanggal", "Masuk", "Pulang", "Status", "Lokasi"],
      ...filteredAttendance.map((record) => [
        record.employeeName,
        record.department,
        record.date,
        record.timeIn,
        record.timeOut ?? "-",
        record.status,
        record.location,
      ]),
      [],
      ["Cuti dan Izin"],
      ["Nama", "Departemen", "Jenis", "Mulai", "Selesai", "Hari", "Status"],
      ...filteredLeaves.map((request) => [
        request.employeeName,
        request.department,
        request.type,
        request.startDate,
        request.endDate,
        request.totalDays,
        request.status,
      ]),
    ];
    const csv = `\uFEFF${rows
      .map((row) => row.map(escapeCsvCell).join(";"))
      .join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `laporan-hr-${selectedMonth
      .toLocaleLowerCase("id-ID")
      .replaceAll(" ", "-")}.csv`;
    downloadLink.click();
    URL.revokeObjectURL(url);
    showToast("Laporan CSV berhasil diunduh.", "success");
  };

  const handlePrintPdf = () => {
    playClickSound();
    window.print();
    showToast("Dialog cetak dibuka. Pilih “Simpan sebagai PDF”.", "info");
  };

  const handleCopyReminder = async (name: string, lateCount: number) => {
    playClickSound();
    const message = `Halo ${name}, terdapat ${lateCount} catatan keterlambatan pada ${selectedMonth}. Mohon lakukan konfirmasi kepada HR.`;

    try {
      await navigator.clipboard.writeText(message);
      showToast(`Pesan pengingat untuk ${name} disalin.`, "success");
    } catch {
      showToast("Browser tidak mengizinkan akses clipboard.", "warning");
    }
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
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Period Filter Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] items-end bg-slate-900 p-3 rounded-xl border border-slate-800 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">Periode Laporan:</span>
        </div>
        <Combobox
          options={PERIOD_OPTIONS}
          value={selectedMonth}
          onChange={(val) => {
            playClickSound();
            setSelectedMonth(val);
          }}
          searchPlaceholder="Cari bulan/kuartal..."
        />
        <Combobox
          options={departmentOptions}
          value={selectedDept}
          onChange={setSelectedDept}
          placeholder="Pilih departemen"
          searchPlaceholder="Cari departemen..."
        />
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Rata-rata Kehadiran"
          value={`${attendanceRate.toFixed(1)}%`}
          subtext={`${presentEmployeeIds.size} dari ${filteredEmployees.length} staf`}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Terlambat"
          value={<>{lateRecords.length} <span className="text-xs text-slate-400 font-normal">log</span></>}
          subtext={`${warningStaff.length} staf terdampak`}
          icon={Clock}
          valueColor="text-amber-400"
        />
        <StatCard
          title="Cuti Terpakai"
          value={<>{approvedLeaveDays} <span className="text-xs text-slate-400 font-normal">Hari</span></>}
          subtext={`${filteredLeaves.length} pengajuan pada periode ini`}
          icon={Calendar}
          iconColor="text-blue-400"
          valueColor="text-blue-400"
        />
        <StatCard
          title="Tingkat Kedisiplinan"
          value={`${disciplineRate.toFixed(1)}%`}
          subtext={
            <span className="text-amber-400 font-medium">
              {filteredAttendance.length > 0 ? "Berdasarkan log aktual" : "Belum ada data"}
            </span>
          }
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

        {deptAnalytics.length > 0 ? (
          <DepartmentChart data={deptAnalytics} />
        ) : (
          <p className="py-10 text-center text-xs text-slate-400">
            Belum ada data departemen untuk filter ini.
          </p>
        )}
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
                  <div className="w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center bg-amber-500/20 text-amber-400">
                    {staf.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{staf.name}</p>
                    <p className="text-[10px] text-slate-400">{staf.dept}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 font-mono">{staf.score.toFixed(1)}%</span>
              </div>
            ))}
            {topDisciplineStaff.length === 0 && (
              <p className="py-5 text-center text-xs text-slate-400">Belum ada log kehadiran.</p>
            )}
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
                  <div className="w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center bg-rose-500/20 text-rose-400">
                    {staf.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{staf.name}</p>
                    <p className="text-[10px] text-rose-400 font-medium">{staf.lateCount}x terlambat</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyReminder(staf.name, staf.lateCount)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Salin Pesan
                </button>
              </div>
            ))}
            {warningStaff.length === 0 && (
              <p className="py-5 text-center text-xs text-slate-400">
                Tidak ada catatan keterlambatan.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
