"use client";

import { useState } from "react";
import { useHR, WorkShift } from "@/context/HRContext";
import { 
  CalendarDays, 
  Clock, 
  UserCheck, 
  Building2, 
  RefreshCw, 
  Edit3, 
  ChevronRight, 
  CheckCircle2, 
  Sun, 
  Sunset, 
  Moon, 
  Coffee,
  Plus
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState("EMP-001");
  const [newShiftName, setNewShiftName] = useState<WorkShift["shiftName"]>("Shift Pagi");
  const [newTimeSlot, setNewTimeSlot] = useState("07:00 - 15:00 WIB");

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
    if (shiftStr.includes("Pagi")) return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    if (shiftStr.includes("Siang")) return <Sunset className="w-3.5 h-3.5 text-orange-400" />;
    if (shiftStr.includes("Malam")) return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
    return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Jadwal Kerja & Shift</h1>
          <p className="text-xs text-slate-400">Pengaturan jadwal dinas staf & tukar shift mobile</p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Edit3 className="w-4 h-4" />
          <span>Atur Shift</span>
        </button>
      </div>

      {/* Date Picker Bar */}
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

      {/* Shift Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Shift Pagi</p>
            <p className="text-xs font-bold text-slate-200">07:00 - 15:00 WIB</p>
          </div>
        </div>

        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
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

      {/* Employees Schedule List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            <span>Daftar Jadwal Staf (21 Juli)</span>
          </h3>
          <span className="text-[11px] text-slate-400">{filteredEmployees.length} Staf</span>
        </div>

        <div className="space-y-3 pt-1">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center border border-amber-500/30 ${emp.avatarBg}`}>
                  {emp.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">{emp.name}</h4>
                  <p className="text-[10px] text-slate-400">{emp.role} &bull; {emp.department}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-200">
                  {getShiftIcon(emp.shift)}
                  <span>{emp.shift.split("(")[0].trim()}</span>
                </span>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {emp.shift.includes("(") ? emp.shift.split("(")[1].replace(")", "") : "07:00 - 15:00 WIB"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              if (s === "Shift Pagi") setNewTimeSlot("07:00 - 15:00 WIB");
              else if (s === "Shift Siang") setNewTimeSlot("12:00 - 20:00 WIB");
              else if (s === "Shift Malam") setNewTimeSlot("15:00 - 23:00 WIB");
              else setNewTimeSlot("Libur / Off");
            }}
          />

          <TimePicker
            label="Jam Kerja / Slot"
            value={newTimeSlot}
            onChange={setNewTimeSlot}
          />

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
