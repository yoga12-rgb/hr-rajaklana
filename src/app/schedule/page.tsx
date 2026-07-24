"use client";

import React, { useState, Fragment } from "react";
import { useHR, WorkShift } from "@/context/HRContext";
import { 
  CalendarDays, 
  Building2, 
  RefreshCw, 
  Edit3, 
  Sun, 
  Sunset, 
  Moon, 
  Coffee
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { TimePicker } from "@/components/ui/TimePicker";

const daysOfWeek = [
  { dayName: "Sen", dateNum: "20", fullDate: "2026-07-20" },
  { dayName: "Sel", dateNum: "21", fullDate: "2026-07-21", isToday: true },
  { dayName: "Rab", dateNum: "22", fullDate: "2026-07-22" },
  { dayName: "Kam", dateNum: "23", fullDate: "2026-07-23" },
  { dayName: "Jum", dateNum: "24", fullDate: "2026-07-24" },
  { dayName: "Sab", dateNum: "25", fullDate: "2026-07-25" },
  { dayName: "Min", dateNum: "26", fullDate: "2026-07-26" },
];

export default function SchedulePage() {
  const { employees, updateEmployeeShift, showToast } = useHR();
  const [selectedDate, setSelectedDate] = useState("2026-07-21");
  const [selectedDept, setSelectedDept] = useState("Semua");
  const [viewMode, setViewMode] = useState<"matrix" | "daily">("matrix");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState("EMP-001");
  const [newShiftName, setNewShiftName] = useState<WorkShift["shiftName"]>("Shift Pagi");
  const [shiftStartTime, setShiftStartTime] = useState("07:00");
  const [shiftEndTime, setShiftEndTime] = useState("15:00");

  const newTimeSlot = newShiftName === "Off / Libur"
    ? "Libur / Off"
    : `${shiftStartTime} - ${shiftEndTime} WIB`;

  const filteredEmployees = employees.filter((emp) => 
    selectedDept === "Semua" || emp.department === selectedDept
  );

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateEmployeeShift(selectedEmpId, newShiftName, newTimeSlot);
    showToast("Shift karyawan berhasil diperbarui", "success");
    setShowEditModal(false);
  };

  const getShiftIcon = (shiftStr: string) => {
    if (shiftStr.includes("Pagi")) return <Sun className="w-3.5 h-3.5 text-blue-400" />;
    if (shiftStr.includes("Siang")) return <Sunset className="w-3.5 h-3.5 text-amber-400" />;
    if (shiftStr.includes("Malam")) return <Moon className="w-3.5 h-3.5 text-orange-400" />;
    return <Coffee className="w-3.5 h-3.5 text-rose-400" />;
  };

  // Helper to determine weekly shift matrix badge per day
  const getWeeklyDayShift = (emp: typeof employees[0], dayIndex: number) => {
    // Tuesday (index 1 = 21 July) uses employee's actual updated shift
    if (dayIndex === 1) {
      if (emp.shift.includes("Siang")) return { code: "SIANG", label: "Siang", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
      if (emp.shift.includes("Malam")) return { code: "MALAM", label: "Malam", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
      if (emp.shift.includes("Off") || emp.shift.includes("Libur")) return { code: "OFF", label: "Off", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
      return { code: "PAGI", label: "Pagi", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    }
    // Fixed pattern for weekend days (Sab/Min) or shift variations
    if (emp.id === "EMP-003" && (dayIndex === 5 || dayIndex === 6)) {
      return { code: "MALAM", label: "Malam", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
    }
    if (emp.id === "EMP-005" && dayIndex === 6) {
      return { code: "OFF", label: "Off", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
    }
    if (dayIndex === 5 || dayIndex === 6) {
      return { code: "OFF", label: "Off", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
    }
    if (emp.id === "EMP-005") {
      return { code: "SIANG", label: "Siang", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    }
    return { code: "PAGI", label: "Pagi", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Jadwal Kerja & Roster Shift</h1>
          <p className="text-xs text-slate-400">Matriks jadwal dinas mingguan per departemen & tukar shift</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Matrix vs Daily */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "matrix"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Matriks Roster</span>
            </button>
            <button
              onClick={() => setViewMode("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "daily"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Daftar Harian</span>
            </button>
          </div>

          <button
            onClick={() => setShowEditModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>Atur Shift</span>
          </button>
        </div>
      </div>

      {/* Date Picker Bar (Only shown in Daily View) */}
      {viewMode === "daily" && (
        <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex items-center justify-between gap-1 overflow-x-auto shadow-md">
          {daysOfWeek.map((d) => (
            <button
              key={d.fullDate}
              onClick={() => setSelectedDate(d.fullDate)}
              className={`flex-1 min-w-[44px] py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                selectedDate === d.fullDate
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 scale-105"
                  : d.isToday
                  ? "bg-slate-800 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider">{d.dayName}</span>
              <span className="text-sm font-extrabold mt-0.5">{d.dateNum}</span>
            </button>
          ))}
        </div>
      )}

      {/* Shift Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Shift Pagi</p>
            <p className="text-xs font-bold text-slate-200">07:00 - 15:00 WIB</p>
          </div>
        </div>

        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Sunset className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Shift Siang</p>
            <p className="text-xs font-bold text-slate-200">12:00 - 20:00 WIB</p>
          </div>
        </div>
      </div>

      {/* Swap Shift Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-100">Ingin Mengajukan Tukar Shift?</p>
          <p className="text-[11px] text-slate-400">Pilih rekan kerja untuk pengajuan tukar jadwal</p>
        </div>
        <button
          onClick={() => setShowSwapModal(true)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tukar Shift</span>
        </button>
      </div>

      {/* Department Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {["Semua", ...Array.from(new Set(employees.map(e => e.department)))].map((dept) => {
          const count = dept === "Semua" ? employees.length : employees.filter(e => e.department === dept).length;
          const isActive = selectedDept === dept;
          return (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>{dept}</span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                isActive ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* MATRIX VIEW (UI MATRIX ROSTER MINGGUAN) */}
      {viewMode === "matrix" && (
        <div className="space-y-3">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-2.5 sm:p-4 space-y-3 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Matriks Roster Mingguan (20 - 26 Jul)
                </h3>
              </div>
              <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                Klik sel ubah
              </span>
            </div>

            {/* Matrix Table Scroll Container with 2D Dual-Axis Sticky Header */}
            <div className="overflow-auto max-h-[55vh] sm:max-h-[60vh] no-scrollbar rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse min-w-[440px] sm:min-w-[600px] relative">
                <thead className="sticky top-0 z-30 shadow-md">
                  <tr className="bg-slate-900 text-[10px] font-bold text-slate-400 border-b border-slate-800">
                    <th className="p-2 sm:p-3 sticky top-0 left-0 bg-slate-900 z-40 w-[110px] min-w-[110px] sm:w-[150px] sm:min-w-[150px] border-r border-b border-slate-800 shadow-md">
                      Staf & Dept
                    </th>
                    {daysOfWeek.map((d) => (
                      <th key={d.fullDate} className={`p-1.5 text-center min-w-[46px] sm:min-w-[65px] sticky top-0 bg-slate-900 z-30 border-b border-slate-800 ${d.isToday ? "bg-amber-500/15 text-amber-400 font-extrabold" : ""}`}>
                        <div className="text-[9px] uppercase text-slate-400">{d.dayName}</div>
                        <div className="text-[11px] font-bold mt-0.5">{d.dateNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {Object.entries(
                    filteredEmployees.reduce((acc, emp) => {
                      if (!acc[emp.department]) acc[emp.department] = [];
                      acc[emp.department].push(emp);
                      return acc;
                    }, {} as Record<string, typeof employees>)
                  ).map(([deptName, deptEmps]) => (
                    <Fragment key={deptName}>
                      {/* Department Row Header inside Table */}
                      <tr className="bg-slate-900/60">
                        <td colSpan={8} className="px-2 py-1.5 text-[9px] font-extrabold text-amber-400 uppercase tracking-wider bg-slate-900/80 border-y border-slate-800">
                          <div className="sticky left-2 flex items-center gap-1 w-max">
                            <Building2 className="w-3 h-3 text-amber-400" />
                            <span>{deptName} ({deptEmps.length})</span>
                          </div>
                        </td>
                      </tr>

                      {/* Employee Rows */}
                      {deptEmps.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* Sticky Employee Name Column */}
                          <td className="p-2 sm:p-2.5 sticky left-0 bg-slate-950 z-10 w-[110px] min-w-[110px] max-w-[110px] sm:w-[150px] sm:min-w-[150px] border-r border-slate-800/80 shadow-md">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <div className={`w-6 h-6 rounded-md font-bold text-[9px] flex items-center justify-center border border-amber-500/30 shrink-0 ${emp.avatarBg}`}>
                                {emp.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div className="truncate min-w-0">
                                <h4 className="font-bold text-slate-200 text-[11px] truncate leading-tight">{emp.name.split(" ")[0]}</h4>
                                <p className="text-[9px] text-slate-400 truncate">{emp.role}</p>
                              </div>
                            </div>
                          </td>

                          {/* 7 Days Shift Cells */}
                          {daysOfWeek.map((d, dayIdx) => {
                            const shift = getWeeklyDayShift(emp, dayIdx);
                            return (
                              <td key={d.fullDate} className={`p-1 text-center align-middle ${d.isToday ? "bg-amber-500/5" : ""}`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmpId(emp.id);
                                    setShowEditModal(true);
                                  }}
                                  className={`w-full py-1 px-0.5 rounded text-[9px] font-extrabold transition-all hover:scale-105 active:scale-95 cursor-pointer block text-center truncate ${shift.color}`}
                                  title={`Edit shift ${emp.name} tanggal ${d.dateNum}`}
                                >
                                  {shift.label}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matrix Legend */}
            <div className="flex items-center justify-center gap-3 text-[9px] text-slate-400 pt-0.5 flex-wrap">
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Pagi (07-15)
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Siang (12-20)
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Malam (15-23)
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> OFF (Libur)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DAILY VIEW (TAMPILAN DETAIL HARIAN) */}
      {viewMode === "daily" && (
        <div className="space-y-4">
          {Object.entries(
            filteredEmployees.reduce((acc, emp) => {
              if (!acc[emp.department]) acc[emp.department] = [];
              acc[emp.department].push(emp);
              return acc;
            }, {} as Record<string, typeof employees>)
          ).map(([deptName, deptEmps]) => (
            <div key={deptName} className="bg-slate-900 rounded-2xl border border-slate-800/80 p-4 space-y-3 shadow-md">
              {/* Department Section Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 tracking-wide">{deptName}</h3>
                    <p className="text-[10px] text-slate-400">Jadwal Shift Staf Terjadwal</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-bold">
                  {deptEmps.length} Staf
                </span>
              </div>

              {/* Department Employee Cards */}
              <div className="space-y-2.5 pt-1">
                {deptEmps.map((emp) => (
                  <div key={emp.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center border border-amber-500/30 ${emp.avatarBg}`}>
                        {emp.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-xs">{emp.name}</h4>
                        <p className="text-[10px] text-slate-400">{emp.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                          {getShiftIcon(emp.shift)}
                          <span>{emp.shift.split("(")[0].trim()}</span>
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {emp.shift.includes("(") ? emp.shift.split("(")[1].replace(")", "") : "07:00 - 15:00 WIB"}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setShowEditModal(true);
                        }}
                        title="Ubah Shift Staf ini"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer border border-slate-700/60"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredEmployees.length === 0 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-500 mx-auto opacity-50" />
              <p className="text-xs text-slate-400">Tidak ada staf di departemen ini.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Edit Shift */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Atur Shift Karyawan"
        icon={Edit3}
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <Combobox
            label="Pilih Karyawan"
            options={employees.map(e => ({ value: e.id, label: e.name, subtext: `${e.role} • ${e.department}` }))}
            value={selectedEmpId}
            onChange={setSelectedEmpId}
            searchPlaceholder="Cari nama karyawan..."
          />

          <Combobox
            label="Master Shift"
            options={[
              { value: "Shift Pagi", label: "Shift Pagi", subtext: "07:00 - 15:00 WIB" },
              { value: "Shift Siang", label: "Shift Siang", subtext: "12:00 - 20:00 WIB" },
              { value: "Shift Malam", label: "Shift Malam", subtext: "15:00 - 23:00 WIB" },
              { value: "Off / Libur", label: "Off / Libur", subtext: "Libur Dinas" },
            ]}
            value={newShiftName}
            onChange={(val) => {
              const s = val as WorkShift["shiftName"];
              setNewShiftName(s);
              if (s === "Shift Pagi") {
                setShiftStartTime("07:00");
                setShiftEndTime("15:00");
              } else if (s === "Shift Siang") {
                setShiftStartTime("12:00");
                setShiftEndTime("20:00");
              } else if (s === "Shift Malam") {
                setShiftStartTime("15:00");
                setShiftEndTime("23:00");
              }
            }}
          />

          {newShiftName === "Off / Libur" ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-400">
              Shift libur tidak memerlukan jam mulai dan selesai.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TimePicker
                label="Jam Mulai Shift"
                value={shiftStartTime}
                onChange={setShiftStartTime}
                includeSuffix={false}
                align="left"
              />
              <TimePicker
                label="Jam Selesai Shift"
                value={shiftEndTime}
                onChange={setShiftEndTime}
                includeSuffix={false}
                align="right"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Simpan Shift
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Swap Shift */}
      <Modal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        title="Pengajuan Tukar Shift"
        icon={RefreshCw}
      >
        <div className="space-y-4">
          <Combobox
            label="Tukar Shift Dengan Staf"
            options={employees.map(e => ({ value: e.id, label: e.name, subtext: `${e.role} • ${e.shift}` }))}
            value={selectedEmpId}
            onChange={setSelectedEmpId}
            searchPlaceholder="Cari rekan kerja..."
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Alasan Tukar Shift</label>
            <textarea
              rows={2}
              placeholder="Tuliskan alasan keperluan pertukaran shift..."
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setShowSwapModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => {
                showToast("Permohonan tukar shift berhasil dikirim ke atasan!", "success");
                setShowSwapModal(false);
              }}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Kirim Pengajuan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
