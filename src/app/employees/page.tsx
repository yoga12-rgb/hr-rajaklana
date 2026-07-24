"use client";

import { useState } from "react";
import { useHR, Employee } from "@/context/HRContext";
import { 
  Search, 
  Building2, 
  Phone, 
  Calendar, 
  UserPlus
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";

const generalDepartments = [
  "Produksi & Operasional",
  "Layanan & Lapangan",
  "Operasional",
  "HR & Legal",
  "Finance",
];

export default function EmployeesPage() {
  const { employees, preferences, addEmployee } = useHR();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("Semua");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Employee Form State
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("Produksi & Operasional");
  const [status, setStatus] = useState<Employee["status"]>("Tetap");
  const [shift, setShift] = useState("Shift Pagi (07:00 - 15:00)");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joinDate, setJoinDate] = useState("2026-07-22");
  const departments = [
    "Semua",
    ...Array.from(new Set(employees.map((employee) => employee.department))),
  ];
  const departmentOptions = Array.from(
    new Set([
      ...employees.map((employee) => employee.department),
      ...generalDepartments,
    ])
  );

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === "Semua" || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;

    const [joinYear, joinMonth, joinDay] = joinDate.split("-").map(Number);
    const formattedJoinDate = new Date(
      joinYear,
      joinMonth - 1,
      joinDay
    ).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    addEmployee({
      name: name.trim(),
      role: role.trim(),
      department: dept,
      status,
      shift,
      phone: phone || "0812-0000-1111",
      email: email || `${name.toLowerCase().replace(/\s+/g, ".")}@rajaklana.com`,
      joinDate: formattedJoinDate,
      leaveBalance: preferences.defaultLeaveBalance,
      avatarBg: "bg-amber-500/20 text-amber-400"
    });

    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Data Karyawan</h1>
          <p className="text-xs text-slate-400">Direktori tim & informasi staf Rajaklana Group</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari berdasarkan nama, NIK, atau jabatan..."
          className="w-full pl-9 pr-4 py-2.5 text-base sm:text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Department Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {departments.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDept(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedDept === d
                ? "bg-amber-500 text-slate-950 shadow-xs"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Employees Grid */}
      <div className="space-y-3">
        {filteredEmployees.map((emp) => (
          <div key={emp.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center border border-amber-500/30 ${emp.avatarBg}`}>
                  {emp.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{emp.name}</h3>
                  <p className="text-xs text-slate-400">{emp.role}</p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                emp.status === "Tetap"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}>
                {emp.status}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-xs text-slate-400 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate">{emp.department}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{emp.nik}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{emp.phone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Cuti: <strong className="text-amber-400">{emp.leaveBalance} Hr</strong></span>
              </div>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="p-8 text-center bg-slate-900 rounded-xl border border-slate-800 text-slate-400 text-xs">
            Tidak ada karyawan ditemukan untuk filter pencarian ini.
          </div>
        )}
      </div>

      {/* Add Employee Form Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Karyawan Baru"
        icon={UserPlus}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Rahmat Hidayat"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Jabatan / Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Contoh: Team Lead Operasional"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Combobox
              label="Departemen"
              options={departmentOptions.map((department) => ({
                value: department,
                label: department,
              }))}
              value={dept}
              onChange={setDept}
            />
            <Combobox
              label="Status Kerja"
              options={[
                { value: "Tetap", label: "Tetap" },
                { value: "Kontrak", label: "Kontrak" },
                { value: "Magang", label: "Magang" },
              ]}
              value={status}
              onChange={(val) => setStatus(val as Employee["status"])}
            />
          </div>

          <Combobox
            label="Shift Awal"
            options={[
              { value: "Shift Pagi (07:00 - 15:00)", label: "Shift Pagi", subtext: "07:00 - 15:00" },
              { value: "Shift Siang (12:00 - 20:00)", label: "Shift Siang", subtext: "12:00 - 20:00" },
              { value: "Shift Malam (15:00 - 23:00)", label: "Shift Malam", subtext: "15:00 - 23:00" },
              { value: "Off / Libur", label: "Off / Libur" },
            ]}
            value={shift}
            onChange={setShift}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Nomor WhatsApp / Telepon</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Email (Opsional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <DatePicker
            label="Tanggal Masuk Kerja (Join Date)"
            value={joinDate}
            onChange={setJoinDate}
          />

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Simpan Staf
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
