"use client";

import { useState, type ReactNode } from "react";
import { useHR, Employee } from "@/context/HRContext";
import { useDataSource } from "@/context/DataSourceContext";
import {
  useArchiveEmployeeMaster,
  useCreateEmployeeMaster,
  useCurrentAccessRole,
  useLiveEmployees,
  useLiveEmploymentStatuses,
  useLiveJobPositions,
  useLiveOutlets,
  useUpdateEmployeeMaster,
} from "@/lib/master-data/queries";
import type {
  LiveEmployee,
  LiveEmploymentStatus,
  LiveJobPosition,
  LiveOutlet,
} from "@/lib/master-data/repository";
import { 
  Search, 
  Building2, 
  Phone, 
  Calendar, 
  UserPlus,
  Archive,
  LoaderCircle,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

const generalDepartments = [
  "Produksi & Operasional",
  "Layanan & Lapangan",
  "Operasional",
  "HR & Legal",
  "Finance",
];

export default function EmployeesPage() {
  const { mode } = useDataSource();

  return mode === "supabase" ? (
    <LiveEmployeesPage />
  ) : (
    <DemoEmployeesPage />
  );
}

function DemoEmployeesPage() {
  const { employees, preferences, addEmployee } = useHR();

  return (
    <EmployeeDirectory
      employees={employees}
      defaultLeaveBalance={preferences.defaultLeaveBalance}
      onAddEmployee={addEmployee}
    />
  );
}

function LiveEmployeesPage() {
  const employeesQuery = useLiveEmployees();
  const roleQuery = useCurrentAccessRole();
  const outletsQuery = useLiveOutlets();
  const positionsQuery = useLiveJobPositions();
  const statusesQuery = useLiveEmploymentStatuses();
  const archiveMutation = useArchiveEmployeeMaster();
  const { showToast } = useHR();
  const [formEmployee, setFormEmployee] = useState<LiveEmployee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [archiveEmployee, setArchiveEmployee] = useState<LiveEmployee | null>(
    null
  );
  const [archiveReason, setArchiveReason] = useState("");

  if (
    employeesQuery.isPending ||
    roleQuery.isPending ||
    outletsQuery.isPending ||
    positionsQuery.isPending ||
    statusesQuery.isPending
  ) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
        Memuat data karyawan Supabase…
      </div>
    );
  }

  const queryError =
    employeesQuery.error ??
    roleQuery.error ??
    outletsQuery.error ??
    positionsQuery.error ??
    statusesQuery.error;

  if (queryError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
      >
        {queryError.message}
      </div>
    );
  }

  const canManage = roleQuery.data === "supervisor";
  const liveEmployees = employeesQuery.data ?? [];
  const liveOutlets = outletsQuery.data ?? [];
  const livePositions = positionsQuery.data ?? [];
  const liveStatuses = statusesQuery.data ?? [];

  const openCreateForm = () => {
    playClickSound();
    setFormEmployee(null);
    setShowForm(true);
  };

  const openEditForm = (employee: LiveEmployee) => {
    playClickSound();
    setFormEmployee(employee);
    setShowForm(true);
  };

  const openArchiveForm = (employee: LiveEmployee) => {
    playClickSound();
    setArchiveReason("");
    setArchiveEmployee(employee);
  };

  const handleArchive = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!archiveEmployee || !archiveReason.trim()) return;

    try {
      await archiveMutation.mutateAsync({
        employeeId: archiveEmployee.id,
        reason: archiveReason.trim(),
      });
      playSuccessHaptic();
      showToast(`${archiveEmployee.full_name} berhasil diarsipkan.`, "success");
      setArchiveEmployee(null);
      setArchiveReason("");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Karyawan gagal diarsipkan.",
        "warning"
      );
    }
  };

  return (
    <>
      <EmployeeDirectory
        employees={liveEmployees.map(mapLiveEmployee)}
        defaultLeaveBalance={0}
        showLeaveBalance={false}
        headerAction={
          canManage ? (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>Tambah</span>
            </button>
          ) : (
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-400">
              Akses Baca
            </span>
          )
        }
        renderEmployeeActions={
          canManage
            ? (employee) => (
                <div className="flex items-center justify-end gap-2 border-t border-slate-800/70 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      openEditForm(
                        liveEmployees.find(
                          (item) => item.id === employee.id
                        )!
                      )
                    }
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openArchiveForm(
                        liveEmployees.find(
                          (item) => item.id === employee.id
                        )!
                      )
                    }
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/15"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arsipkan
                  </button>
                </div>
              )
            : undefined
        }
      />

      {showForm && (
        <LiveEmployeeFormModal
          key={formEmployee?.id ?? "new"}
          employee={formEmployee}
          outlets={liveOutlets}
          jobPositions={livePositions}
          employmentStatuses={liveStatuses}
          onClose={() => setShowForm(false)}
          onSuccess={(message) => {
            setShowForm(false);
            showToast(message, "success");
          }}
        />
      )}

      <Modal
        isOpen={archiveEmployee !== null}
        onClose={() => {
          if (!archiveMutation.isPending) setArchiveEmployee(null);
        }}
        title="Arsipkan Karyawan"
        icon={Archive}
      >
        <form onSubmit={handleArchive} className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">
            <TriangleAlert className="h-5 w-5 shrink-0 text-rose-400" />
            <p>
              Data <strong>{archiveEmployee?.full_name}</strong> tetap disimpan
              untuk riwayat. Penempatan aktif ditutup dan akun terkait
              dinonaktifkan.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Alasan arsip
            </label>
            <textarea
              rows={3}
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Contoh: Kontrak kerja telah berakhir"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setArchiveEmployee(null)}
              disabled={archiveMutation.isPending}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={archiveMutation.isPending || !archiveReason.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {archiveMutation.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              Arsipkan
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function mapLiveEmployee(employee: LiveEmployee): Employee {
  const activePrimaryPlacement = employee.placements.find(
    (placement) => placement.is_primary && placement.end_date === null
  );
  const status = employee.employment_status?.name;

  return {
    id: employee.id,
    nik: employee.nik,
    name: employee.full_name,
    role: employee.job_position?.name ?? "Jabatan belum ditetapkan",
    department:
      activePrimaryPlacement?.outlet?.name ?? "Belum ditempatkan di outlet",
    status:
      status === "Tetap" || status === "Kontrak" || status === "Magang"
        ? status
        : "Kontrak",
    shift: "Belum dijadwalkan",
    phone: employee.phone ?? "-",
    email: "",
    joinDate: new Date(`${employee.joined_at}T00:00:00`).toLocaleDateString(
      "id-ID",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    ),
    leaveBalance: 0,
    avatarBg: "bg-amber-500/20 text-amber-400",
  };
}

function EmployeeDirectory({
  employees,
  defaultLeaveBalance,
  onAddEmployee,
  headerAction,
  renderEmployeeActions,
  showLeaveBalance = true,
}: {
  employees: Employee[];
  defaultLeaveBalance: number;
  onAddEmployee?: (employee: Omit<Employee, "id" | "nik">) => void;
  headerAction?: ReactNode;
  renderEmployeeActions?: (employee: Employee) => ReactNode;
  showLeaveBalance?: boolean;
}) {
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

    if (!onAddEmployee) return;

    onAddEmployee({
      name: name.trim(),
      role: role.trim(),
      department: dept,
      status,
      shift,
      phone: phone || "0812-0000-1111",
      email: email || `${name.toLowerCase().replace(/\s+/g, ".")}@rajaklana.com`,
      joinDate: formattedJoinDate,
      leaveBalance: defaultLeaveBalance,
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
        {headerAction ?? (onAddEmployee ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        ) : (
          <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-400">
            Supabase Live
          </span>
        ))}
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
              {showLeaveBalance ? (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cuti: <strong className="text-amber-400">{emp.leaveBalance} Hr</strong></span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Masuk: {emp.joinDate}</span>
                </div>
              )}
            </div>
            {renderEmployeeActions?.(emp)}
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

function LiveEmployeeFormModal({
  employee,
  outlets,
  jobPositions,
  employmentStatuses,
  onClose,
  onSuccess,
}: {
  employee: LiveEmployee | null;
  outlets: LiveOutlet[];
  jobPositions: LiveJobPosition[];
  employmentStatuses: LiveEmploymentStatus[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const createMutation = useCreateEmployeeMaster();
  const updateMutation = useUpdateEmployeeMaster();
  const activePlacement = employee?.placements.find(
    (placement) => placement.is_primary && placement.end_date === null
  );
  const today = new Date().toLocaleDateString("en-CA");
  const [nik, setNik] = useState(employee?.nik ?? "");
  const [fullName, setFullName] = useState(employee?.full_name ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [joinedAt, setJoinedAt] = useState(employee?.joined_at ?? today);
  const [jobPositionId, setJobPositionId] = useState(
    employee?.job_position?.id ?? jobPositions[0]?.id ?? ""
  );
  const [employmentStatusId, setEmploymentStatusId] = useState(
    employee?.employment_status?.id ?? employmentStatuses[0]?.id ?? ""
  );
  const [outletId, setOutletId] = useState(
    activePlacement?.outlet?.id ?? outlets[0]?.id ?? ""
  );
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [changeReason, setChangeReason] = useState(
    employee ? "Pembaruan data karyawan" : "Penempatan awal"
  );
  const [formError, setFormError] = useState("");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (
      !nik.trim() ||
      !fullName.trim() ||
      !jobPositionId ||
      !employmentStatusId ||
      !outletId ||
      !changeReason.trim()
    ) {
      setFormError("Lengkapi seluruh bidang yang wajib.");
      return;
    }

    try {
      const input = {
        nik: nik.trim().toUpperCase(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        joinedAt,
        employmentStatusId,
        jobPositionId,
        outletId,
        changeReason: changeReason.trim(),
      };

      if (employee) {
        await updateMutation.mutateAsync({
          ...input,
          employeeId: employee.id,
          effectiveDate,
        });
      } else {
        await createMutation.mutateAsync(input);
      }

      playSuccessHaptic();
      onSuccess(
        employee
          ? `${fullName.trim()} berhasil diperbarui.`
          : `${fullName.trim()} berhasil ditambahkan.`
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Data karyawan belum dapat disimpan."
      );
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={employee ? "Ubah Data Karyawan" : "Tambah Karyawan Live"}
      icon={employee ? Pencil : UserPlus}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">NIK</label>
            <input
              value={nik}
              onChange={(event) => setNik(event.target.value.toUpperCase())}
              pattern="RK-[0-9]{4}-[0-9]{3,}"
              placeholder="RK-2026-002"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base uppercase text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Nama lengkap
            </label>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nama karyawan"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Nomor telepon
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="081234567890"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Combobox
            label="Jabatan"
            options={jobPositions.map((position) => ({
              value: position.id,
              label: position.name,
            }))}
            value={jobPositionId}
            onChange={setJobPositionId}
          />
          <Combobox
            label="Status kerja"
            options={employmentStatuses.map((status) => ({
              value: status.id,
              label: status.name,
            }))}
            value={employmentStatusId}
            onChange={setEmploymentStatusId}
          />
        </div>

        <Combobox
          label="Penempatan utama"
          options={outlets.map((outlet) => ({
            value: outlet.id,
            label: `${outlet.code} · ${outlet.name}`,
          }))}
          value={outletId}
          onChange={setOutletId}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            label="Tanggal masuk"
            value={joinedAt}
            onChange={setJoinedAt}
          />
          {employee && (
            <DatePicker
              label="Efektif penempatan"
              value={effectiveDate}
              onChange={setEffectiveDate}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Alasan perubahan
          </label>
          <textarea
            rows={2}
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {employee ? "Simpan Perubahan" : "Simpan Karyawan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
