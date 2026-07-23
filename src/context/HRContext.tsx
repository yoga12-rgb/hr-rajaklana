"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Toast, ToastMessage, ToastType } from "@/components/ui/Toast";

export interface Employee {
  id: string;
  nik: string;
  name: string;
  role: string;
  department: string;
  status: "Tetap" | "Kontrak" | "Magang";
  shift: string;
  phone: string;
  email: string;
  joinDate: string;
  leaveBalance: number;
  avatarBg: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  status: "Tepat Waktu" | "Terlambat" | "Izin" | "Cuti";
  location: string;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: "Cuti Tahunan" | "Sakit" | "Izin Penting" | "Cuti Melahirkan";
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

export interface WorkShift {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // e.g. "2026-07-21"
  shiftName: "Shift Pagi" | "Shift Siang" | "Shift Malam" | "Off / Libur";
  timeSlot: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: "Info K3" | "Event Perusahaan" | "Kebijakan HR" | "Operasional";
  isPinned: boolean;
  date: string;
  author: string;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

interface HRContextType {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  schedules: WorkShift[];
  announcements: Announcement[];
  overtimeRequests: OvertimeRequest[];
  userClockedIn: boolean;
  currentUserClockInTime: string | null;
  clockIn: (notes?: string) => void;
  clockOut: () => void;
  submitLeaveRequest: (type: LeaveRequest["type"], startDate: string, endDate: string, reason: string) => void;
  approveLeaveRequest: (id: string) => void;
  rejectLeaveRequest: (id: string) => void;
  submitOvertimeRequest: (employeeId: string, date: string, startTime: string, endTime: string, durationHours: number, reason: string) => void;
  approveOvertimeRequest: (id: string) => void;
  rejectOvertimeRequest: (id: string) => void;
  addEmployee: (emp: Omit<Employee, "id" | "nik">) => void;
  updateEmployeeShift: (employeeId: string, shiftName: WorkShift["shiftName"], timeSlot: string) => void;
  addAnnouncement: (title: string, content: string, category: Announcement["category"], isPinned?: boolean) => void;
  showToast: (message: string, type?: ToastType) => void;
}

const initialEmployees: Employee[] = [
  // Outlet Jombang (Kasir)
  { id: "EMP-010", nik: "RK-2024-010", name: "Karyati", role: "Kasir", department: "Outlet Jombang", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-1001-0001", email: "karyati@rajaklana.com", joinDate: "10 Jan 2024", leaveBalance: 12, avatarBg: "bg-teal-500/20 text-teal-400" },
  { id: "EMP-011", nik: "RK-2024-011", name: "Amel", role: "Kasir", department: "Outlet Jombang", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-1001-0002", email: "amel@rajaklana.com", joinDate: "12 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-012", nik: "RK-2024-012", name: "Meta", role: "Kasir", department: "Outlet Jombang", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-1001-0003", email: "meta@rajaklana.com", joinDate: "01 Mar 2024", leaveBalance: 10, avatarBg: "bg-purple-500/20 text-purple-400" },
  { id: "EMP-013", nik: "RK-2024-013", name: "Sella", role: "Kasir", department: "Outlet Jombang", status: "Tetap", shift: "Off / Libur", phone: "0812-1001-0004", email: "sella@rajaklana.com", joinDate: "15 Apr 2024", leaveBalance: 12, avatarBg: "bg-blue-500/20 text-blue-400" },

  // Outlet Ciputat (Kasir)
  { id: "EMP-020", nik: "RK-2024-020", name: "Ghina", role: "Kasir", department: "Outlet Ciputat", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-2002-0001", email: "ghina@rajaklana.com", joinDate: "10 Jan 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-021", nik: "RK-2024-021", name: "Aisah", role: "Kasir", department: "Outlet Ciputat", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-2002-0002", email: "aisah@rajaklana.com", joinDate: "15 Feb 2024", leaveBalance: 12, avatarBg: "bg-teal-500/20 text-teal-400" },
  { id: "EMP-022", nik: "RK-2024-022", name: "Alif", role: "Kasir", department: "Outlet Ciputat", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-2002-0003", email: "alif@rajaklana.com", joinDate: "01 Mar 2024", leaveBalance: 10, avatarBg: "bg-blue-500/20 text-blue-400" },
  { id: "EMP-023", nik: "RK-2024-023", name: "Aul", role: "Kasir", department: "Outlet Ciputat", status: "Tetap", shift: "Off / Libur", phone: "0812-2002-0004", email: "aul@rajaklana.com", joinDate: "20 May 2024", leaveBalance: 12, avatarBg: "bg-rose-500/20 text-rose-400" },

  // Outlet Pahlawan (Kasir)
  { id: "EMP-030", nik: "RK-2024-030", name: "Sulta", role: "Kasir", department: "Outlet Pahlawan", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-3003-0001", email: "sulta@rajaklana.com", joinDate: "05 Jan 2024", leaveBalance: 12, avatarBg: "bg-purple-500/20 text-purple-400" },
  { id: "EMP-031", nik: "RK-2024-031", name: "Ea", role: "Kasir", department: "Outlet Pahlawan", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-3003-0002", email: "ea@rajaklana.com", joinDate: "12 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-032", nik: "RK-2024-032", name: "Endah", role: "Kasir", department: "Outlet Pahlawan", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-3003-0003", email: "endah@rajaklana.com", joinDate: "10 Mar 2024", leaveBalance: 10, avatarBg: "bg-teal-500/20 text-teal-400" },

  // Outlet Pajajaran (Kasir)
  { id: "EMP-040", nik: "RK-2024-040", name: "Siti", role: "Kasir", department: "Outlet Pajajaran", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-4004-0001", email: "siti.pajajaran@rajaklana.com", joinDate: "15 Jan 2024", leaveBalance: 12, avatarBg: "bg-blue-500/20 text-blue-400" },
  { id: "EMP-041", nik: "RK-2024-041", name: "Aini", role: "Kasir", department: "Outlet Pajajaran", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-4004-0002", email: "aini@rajaklana.com", joinDate: "01 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-042", nik: "RK-2024-042", name: "Nurul", role: "Kasir", department: "Outlet Pajajaran", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-4004-0003", email: "nurul@rajaklana.com", joinDate: "10 Mar 2024", leaveBalance: 10, avatarBg: "bg-rose-500/20 text-rose-400" },
];

const initialSchedules: WorkShift[] = [
  { id: "SCH-010", employeeId: "EMP-010", employeeName: "Karyati", department: "Outlet Jombang", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-020", employeeId: "EMP-020", employeeName: "Ghina", department: "Outlet Ciputat", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-030", employeeId: "EMP-030", employeeName: "Sulta", department: "Outlet Pahlawan", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-040", employeeId: "EMP-040", employeeName: "Siti", department: "Outlet Pajajaran", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
];

const initialAttendance: AttendanceRecord[] = [
  { id: "ATT-010", employeeId: "EMP-010", employeeName: "Karyati", role: "Kasir", department: "Outlet Jombang", date: "21 Juli 2026", timeIn: "06:55 WIB", status: "Tepat Waktu", location: "Outlet Jombang (Kasir 1)" },
  { id: "ATT-020", employeeId: "EMP-020", employeeName: "Ghina", role: "Kasir", department: "Outlet Ciputat", date: "21 Juli 2026", timeIn: "07:02 WIB", status: "Tepat Waktu", location: "Outlet Ciputat (Main Cashier)" },
  { id: "ATT-030", employeeId: "EMP-030", employeeName: "Sulta", role: "Kasir", department: "Outlet Pahlawan", date: "21 Juli 2026", timeIn: "07:15 WIB", status: "Terlambat", location: "Outlet Pahlawan", notes: "Macet di persimpangan" },
  { id: "ATT-040", employeeId: "EMP-040", employeeName: "Siti", role: "Kasir", department: "Outlet Pajajaran", date: "21 Juli 2026", timeIn: "06:58 WIB", status: "Tepat Waktu", location: "Outlet Pajajaran" },
];

const initialLeaveRequests: LeaveRequest[] = [
  { id: "LV-101", employeeId: "EMP-013", employeeName: "Sella", department: "Outlet Jombang", type: "Cuti Tahunan", startDate: "2026-07-22", endDate: "2026-07-24", totalDays: 3, reason: "Acara keluarga di luar kota", status: "Pending", createdAt: "21 Jul 2026" },
  { id: "LV-102", employeeId: "EMP-023", employeeName: "Aul", department: "Outlet Ciputat", type: "Sakit", startDate: "2026-07-21", endDate: "2026-07-21", totalDays: 1, reason: "Demam dan flu berat", status: "Pending", createdAt: "21 Jul 2026" },
];

const initialAnnouncements: Announcement[] = [
  {
    id: "ANC-001",
    title: "Briefing Operasional & Standar Layanan Baru Kuartal 3",
    content: "Dihimbau kepada seluruh staf operasional dan tim lapangan untuk menghadiri briefing gabungan pada hari Kamis jam 15:00 WIB.",
    category: "Operasional",
    isPinned: true,
    date: "21 Jul 2026",
    author: "Admin HRD"
  },
  {
    id: "ANC-002",
    title: "Pemberitahuan Pemeriksaan Kesehatan Rutin Staf Operasional",
    content: "Pemeriksaan kesehatan berkala akan dilaksanakan minggu depan di Head Office. Harap koordinasi dengan Team Lead per shift.",
    category: "Info K3",
    isPinned: false,
    date: "19 Jul 2026",
    author: "Admin HRD"
  }
];

const initialOvertimeRequests: OvertimeRequest[] = [
  { id: "OVT-001", employeeId: "EMP-001", employeeName: "Budi Santoso", department: "Produksi & Operasional", date: "2026-07-21", startTime: "15:00 WIB", endTime: "18:00 WIB", durationHours: 3, reason: "Persiapan stok produksi tambahan kuartal 3", status: "Approved", createdAt: "21 Jul 2026" },
  { id: "OVT-002", employeeId: "EMP-005", employeeName: "Rian Hidayat", department: "Operasional", date: "2026-07-22", startTime: "20:00 WIB", endTime: "22:00 WIB", durationHours: 2, reason: "Supervisi stok gudang & audit peralatan", status: "Pending", createdAt: "21 Jul 2026" }
];

const HRContext = createContext<HRContextType | undefined>(undefined);

export function HRProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(initialAttendance);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initialLeaveRequests);
  const [schedules, setSchedules] = useState<WorkShift[]>(initialSchedules);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>(initialOvertimeRequests);
  const [userClockedIn, setUserClockedIn] = useState(false);
  const [currentUserClockInTime, setCurrentUserClockInTime] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    const id = Date.now().toString();
    setToastMessage({ id, message, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.id === id ? null : prev);
    }, 3500);
  };

  const clockIn = (notes?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    const isLate = now.getHours() >= 8 && now.getMinutes() > 0;
    
    const newRecord: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId: "EMP-999",
      employeeName: "Admin HRD (Saya)",
      role: "HR Manager",
      department: "HR & Legal",
      date: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      timeIn: timeStr,
      status: isLate ? "Terlambat" : "Tepat Waktu",
      location: "Rajaklana Mobile App (GPS Active)",
      notes: notes || "Check-in via Mobile App"
    };

    setAttendanceLogs([newRecord, ...attendanceLogs]);
    setUserClockedIn(true);
    setCurrentUserClockInTime(timeStr);
  };

  const clockOut = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    
    setAttendanceLogs(prev => prev.map((item, idx) => {
      if (idx === 0 && item.employeeId === "EMP-999") {
        return { ...item, timeOut: timeStr };
      }
      return item;
    }));
    
    setUserClockedIn(false);
    setCurrentUserClockInTime(null);
  };

  const submitLeaveRequest = (type: LeaveRequest["type"], startDate: string, endDate: string, reason: string) => {
    // Parse manual untuk menghindari bug zona waktu UTC bawaan JS (YYYY-MM-DD)
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newLeave: LeaveRequest = {
      id: `LV-${Date.now().toString().slice(-3)}`,
      employeeId: "EMP-999",
      employeeName: "Admin HRD (Saya)",
      department: "HR & Legal",
      type,
      startDate,
      endDate,
      totalDays: diffDays,
      reason,
      status: "Pending",
      createdAt: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    };

    setLeaveRequests([newLeave, ...leaveRequests]);
  };

  const approveLeaveRequest = (id: string) => {
    setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: "Approved" } : req));
  };

  const rejectLeaveRequest = (id: string) => {
    setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: "Rejected" } : req));
  };

  const addEmployee = (emp: Omit<Employee, "id" | "nik">) => {
    const newEmp: Employee = {
      ...emp,
      id: `EMP-${(employees.length + 1).toString().padStart(3, "0")}`,
      nik: `RK-2026-${(employees.length + 1).toString().padStart(3, "0")}`,
    };
    setEmployees([...employees, newEmp]);
  };

  const updateEmployeeShift = (employeeId: string, shiftName: WorkShift["shiftName"], timeSlot: string) => {
    setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, shift: `${shiftName} (${timeSlot})` } : emp));
    setSchedules(prev => prev.map(s => s.employeeId === employeeId ? { ...s, shiftName, timeSlot } : s));
  };

  const addAnnouncement = (title: string, content: string, category: Announcement["category"], isPinned: boolean = false) => {
    const newAnc: Announcement = {
      id: `ANC-${Date.now().toString().slice(-3)}`,
      title,
      content,
      category,
      isPinned,
      date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      author: "Admin HRD"
    };
    setAnnouncements([newAnc, ...announcements]);
    showToast("Pengumuman berhasil dipublikasikan!", "success");
  };

  const submitOvertimeRequest = (employeeId: string, date: string, startTime: string, endTime: string, durationHours: number, reason: string) => {
    const emp = employees.find(e => e.id === employeeId);
    const newOvt: OvertimeRequest = {
      id: `OVT-${Date.now().toString().slice(-3)}`,
      employeeId,
      employeeName: emp ? emp.name : "Staf Operasional",
      department: emp ? emp.department : "Operasional",
      date,
      startTime,
      endTime,
      durationHours,
      reason,
      status: "Pending",
      createdAt: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    };
    setOvertimeRequests([newOvt, ...overtimeRequests]);
    showToast("Pengajuan lembur berhasil dikirim!", "success");
  };

  const approveOvertimeRequest = (id: string) => {
    setOvertimeRequests(prev => prev.map(o => o.id === id ? { ...o, status: "Approved" } : o));
    showToast("Pengajuan lembur berhasil disetujui!", "success");
  };

  const rejectOvertimeRequest = (id: string) => {
    setOvertimeRequests(prev => prev.map(o => o.id === id ? { ...o, status: "Rejected" } : o));
    showToast("Pengajuan lembur ditolak.", "warning");
  };

  return (
    <HRContext.Provider
      value={{
        employees,
        attendanceLogs,
        leaveRequests,
        schedules,
        announcements,
        overtimeRequests,
        userClockedIn,
        currentUserClockInTime,
        clockIn,
        clockOut,
        submitLeaveRequest,
        approveLeaveRequest,
        rejectLeaveRequest,
        submitOvertimeRequest,
        approveOvertimeRequest,
        rejectOvertimeRequest,
        addEmployee,
        updateEmployeeShift,
        addAnnouncement,
        showToast,
      }}
    >
      <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
      {children}
    </HRContext.Provider>
  );
}

export function useHR() {
  const context = useContext(HRContext);
  if (!context) {
    throw new Error("useHR must be used within an HRProvider");
  }
  return context;
}
