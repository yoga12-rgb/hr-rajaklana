"use client";

import React, {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  ReactNode,
} from "react";
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

export interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

export interface ShiftSwapRequest {
  id: string;
  requesterId: string;
  targetEmployeeId: string;
  date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

export interface DemoPreferences {
  lateTolerance: number;
  requireSelfie: boolean;
  minOvertime: number;
  defaultLeaveBalance: number;
  advanceNoticeDays: number;
  notificationsEnabled: boolean;
}

interface HRContextType {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  schedules: WorkShift[];
  announcements: Announcement[];
  overtimeRequests: OvertimeRequest[];
  outlets: Outlet[];
  shiftSwapRequests: ShiftSwapRequest[];
  preferences: DemoPreferences;
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
  updateEmployeeShift: (employeeId: string, date: string, shiftName: WorkShift["shiftName"], timeSlot: string) => void;
  submitShiftSwapRequest: (targetEmployeeId: string, date: string, reason: string) => void;
  addAnnouncement: (title: string, content: string, category: Announcement["category"], isPinned?: boolean) => void;
  addOutlet: (outlet: Omit<Outlet, "id">) => void;
  updateOutlet: (id: string, outlet: Partial<Outlet>) => void;
  toggleOutletStatus: (id: string) => void;
  updatePreferences: (preferences: Partial<DemoPreferences>) => void;
  resetDemoData: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

const initialEmployees: Employee[] = [
  // Area operasional lintas fungsi
  { id: "EMP-010", nik: "RK-2024-010", name: "Karyati", role: "Admin Operasional", department: "Area Operasional Jombang", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-1001-0001", email: "karyati@rajaklana.com", joinDate: "10 Jan 2024", leaveBalance: 12, avatarBg: "bg-teal-500/20 text-teal-400" },
  { id: "EMP-011", nik: "RK-2024-011", name: "Amel", role: "Team Lead", department: "Area Operasional Jombang", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-1001-0002", email: "amel@rajaklana.com", joinDate: "12 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-012", nik: "RK-2024-012", name: "Meta", role: "Staf Operasional", department: "Area Operasional Jombang", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-1001-0003", email: "meta@rajaklana.com", joinDate: "01 Mar 2024", leaveBalance: 10, avatarBg: "bg-purple-500/20 text-purple-400" },
  { id: "EMP-013", nik: "RK-2024-013", name: "Sella", role: "Petugas Lapangan", department: "Area Operasional Jombang", status: "Tetap", shift: "Off / Libur", phone: "0812-1001-0004", email: "sella@rajaklana.com", joinDate: "15 Apr 2024", leaveBalance: 12, avatarBg: "bg-blue-500/20 text-blue-400" },
  { id: "EMP-020", nik: "RK-2024-020", name: "Ghina", role: "Team Lead", department: "Area Operasional Ciputat", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-2002-0001", email: "ghina@rajaklana.com", joinDate: "10 Jan 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-021", nik: "RK-2024-021", name: "Aisah", role: "Staf Layanan", department: "Area Operasional Ciputat", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-2002-0002", email: "aisah@rajaklana.com", joinDate: "15 Feb 2024", leaveBalance: 12, avatarBg: "bg-teal-500/20 text-teal-400" },
  { id: "EMP-022", nik: "RK-2024-022", name: "Alif", role: "Petugas Lapangan", department: "Area Operasional Ciputat", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-2002-0003", email: "alif@rajaklana.com", joinDate: "01 Mar 2024", leaveBalance: 10, avatarBg: "bg-blue-500/20 text-blue-400" },
  { id: "EMP-023", nik: "RK-2024-023", name: "Aul", role: "Admin Operasional", department: "Area Operasional Ciputat", status: "Tetap", shift: "Off / Libur", phone: "0812-2002-0004", email: "aul@rajaklana.com", joinDate: "20 May 2024", leaveBalance: 12, avatarBg: "bg-rose-500/20 text-rose-400" },
  { id: "EMP-030", nik: "RK-2024-030", name: "Sultan", role: "Supervisor", department: "Area Operasional Pahlawan", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-3003-0001", email: "sulta@rajaklana.com", joinDate: "05 Jan 2024", leaveBalance: 12, avatarBg: "bg-purple-500/20 text-purple-400" },
  { id: "EMP-031", nik: "RK-2024-031", name: "Ea", role: "Staf Operasional", department: "Area Operasional Pahlawan", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-3003-0002", email: "ea@rajaklana.com", joinDate: "12 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-032", nik: "RK-2024-032", name: "Endah", role: "Petugas Lapangan", department: "Area Operasional Pahlawan", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-3003-0003", email: "endah@rajaklana.com", joinDate: "10 Mar 2024", leaveBalance: 10, avatarBg: "bg-teal-500/20 text-teal-400" },
  { id: "EMP-040", nik: "RK-2024-040", name: "Siti", role: "Team Lead", department: "Area Operasional Pajajaran", status: "Tetap", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-4004-0001", email: "siti.pajajaran@rajaklana.com", joinDate: "15 Jan 2024", leaveBalance: 12, avatarBg: "bg-blue-500/20 text-blue-400" },
  { id: "EMP-041", nik: "RK-2024-041", name: "Aini", role: "Staf Layanan", department: "Area Operasional Pajajaran", status: "Tetap", shift: "Shift Siang (12:00 - 20:00)", phone: "0812-4004-0002", email: "aini@rajaklana.com", joinDate: "01 Feb 2024", leaveBalance: 12, avatarBg: "bg-amber-500/20 text-amber-400" },
  { id: "EMP-042", nik: "RK-2024-042", name: "Nurul", role: "Admin Operasional", department: "Area Operasional Pajajaran", status: "Kontrak", shift: "Shift Pagi (07:00 - 15:00)", phone: "0812-4004-0003", email: "nurul@rajaklana.com", joinDate: "10 Mar 2024", leaveBalance: 10, avatarBg: "bg-rose-500/20 text-rose-400" },
];

const initialSchedules: WorkShift[] = [
  { id: "SCH-010", employeeId: "EMP-010", employeeName: "Karyati", department: "Area Operasional Jombang", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-020", employeeId: "EMP-020", employeeName: "Ghina", department: "Area Operasional Ciputat", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-030", employeeId: "EMP-030", employeeName: "Sultan", department: "Area Operasional Pahlawan", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
  { id: "SCH-040", employeeId: "EMP-040", employeeName: "Siti", department: "Area Operasional Pajajaran", date: "2026-07-21", shiftName: "Shift Pagi", timeSlot: "07:00 - 15:00 WIB" },
];

const initialAttendance: AttendanceRecord[] = [
  { id: "ATT-010", employeeId: "EMP-010", employeeName: "Karyati", role: "Admin Operasional", department: "Area Operasional Jombang", date: "21 Juli 2026", timeIn: "06:55 WIB", status: "Tepat Waktu", location: "Area Operasional Jombang" },
  { id: "ATT-020", employeeId: "EMP-020", employeeName: "Ghina", role: "Team Lead", department: "Area Operasional Ciputat", date: "21 Juli 2026", timeIn: "07:02 WIB", status: "Tepat Waktu", location: "Area Operasional Ciputat" },
  { id: "ATT-030", employeeId: "EMP-030", employeeName: "Sultan", role: "Supervisor", department: "Area Operasional Pahlawan", date: "21 Juli 2026", timeIn: "07:15 WIB", status: "Terlambat", location: "Area Operasional Pahlawan", notes: "Macet di persimpangan" },
  { id: "ATT-040", employeeId: "EMP-040", employeeName: "Siti", role: "Team Lead", department: "Area Operasional Pajajaran", date: "21 Juli 2026", timeIn: "06:58 WIB", status: "Tepat Waktu", location: "Area Operasional Pajajaran" },
];

const initialLeaveRequests: LeaveRequest[] = [
  { id: "LV-101", employeeId: "EMP-013", employeeName: "Sella", department: "Area Operasional Jombang", type: "Cuti Tahunan", startDate: "2026-07-22", endDate: "2026-07-24", totalDays: 3, reason: "Acara keluarga di luar kota", status: "Pending", createdAt: "21 Jul 2026" },
  { id: "LV-102", employeeId: "EMP-023", employeeName: "Aul", department: "Area Operasional Ciputat", type: "Sakit", startDate: "2026-07-21", endDate: "2026-07-21", totalDays: 1, reason: "Demam dan flu berat", status: "Pending", createdAt: "21 Jul 2026" },
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
  { id: "OVT-001", employeeId: "EMP-010", employeeName: "Karyati", department: "Area Operasional Jombang", date: "2026-07-21", startTime: "15:00 WIB", endTime: "18:00 WIB", durationHours: 3, reason: "Persiapan laporan operasional bulanan", status: "Approved", createdAt: "21 Jul 2026" },
  { id: "OVT-002", employeeId: "EMP-021", employeeName: "Aisah", department: "Area Operasional Ciputat", date: "2026-07-22", startTime: "20:00 WIB", endTime: "22:00 WIB", durationHours: 2, reason: "Audit data layanan dan dokumentasi lapangan", status: "Pending", createdAt: "21 Jul 2026" }
];

const initialOutlets: Outlet[] = [
  { id: "OUT-001", name: "Area Operasional Jombang", code: "JBG-01", address: "Jl. Jombang Raya No. 45, Tangerang Selatan", latitude: -6.2891, longitude: 106.7214, radiusMeters: 100, openTime: "07:00", closeTime: "22:00", isActive: true },
  { id: "OUT-002", name: "Area Operasional Ciputat", code: "CPT-02", address: "Jl. Ciputat Molek No. 12, Tangerang Selatan", latitude: -6.3123, longitude: 106.7456, radiusMeters: 100, openTime: "07:00", closeTime: "22:00", isActive: true },
  { id: "OUT-003", name: "Area Operasional Pahlawan", code: "PHL-03", address: "Jl. Pahlawan No. 88, Tangerang Selatan", latitude: -6.3211, longitude: 106.7589, radiusMeters: 100, openTime: "07:00", closeTime: "22:00", isActive: true },
  { id: "OUT-004", name: "Area Operasional Pajajaran", code: "PJJ-04", address: "Jl. Pajajaran Raya No. 19, Tangerang Selatan", latitude: -6.3345, longitude: 106.7612, radiusMeters: 100, openTime: "07:00", closeTime: "22:00", isActive: true },
];

const initialPreferences: DemoPreferences = {
  lateTolerance: 15,
  requireSelfie: true,
  minOvertime: 1,
  defaultLeaveBalance: 12,
  advanceNoticeDays: 3,
  notificationsEnabled: true,
};

interface DemoState {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  schedules: WorkShift[];
  announcements: Announcement[];
  overtimeRequests: OvertimeRequest[];
  outlets: Outlet[];
  shiftSwapRequests: ShiftSwapRequest[];
  preferences: DemoPreferences;
  userClockedIn: boolean;
  currentUserClockInTime: string | null;
}

const DEMO_STORAGE_KEY = "hr-rajaklana-demo-v1";

const createInitialDemoState = (): DemoState => ({
  employees: [...initialEmployees],
  attendanceLogs: [...initialAttendance],
  leaveRequests: [...initialLeaveRequests],
  schedules: [...initialSchedules],
  announcements: [...initialAnnouncements],
  overtimeRequests: [...initialOvertimeRequests],
  outlets: [...initialOutlets],
  shiftSwapRequests: [],
  preferences: { ...initialPreferences },
  userClockedIn: false,
  currentUserClockInTime: null,
});

const serverDemoSnapshot = createInitialDemoState();
let clientDemoSnapshot: DemoState | null = null;
const demoStateListeners = new Set<() => void>();

const parseStoredDemoState = (rawState: string | null): DemoState => {
  if (!rawState) return createInitialDemoState();

  try {
    const parsed = JSON.parse(rawState) as Partial<DemoState>;
    const initialState = createInitialDemoState();

    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : initialState.employees,
      attendanceLogs: Array.isArray(parsed.attendanceLogs)
        ? parsed.attendanceLogs
        : initialState.attendanceLogs,
      leaveRequests: Array.isArray(parsed.leaveRequests)
        ? parsed.leaveRequests
        : initialState.leaveRequests,
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : initialState.schedules,
      announcements: Array.isArray(parsed.announcements)
        ? parsed.announcements
        : initialState.announcements,
      overtimeRequests: Array.isArray(parsed.overtimeRequests)
        ? parsed.overtimeRequests
        : initialState.overtimeRequests,
      outlets: Array.isArray(parsed.outlets) ? parsed.outlets : initialState.outlets,
      shiftSwapRequests: Array.isArray(parsed.shiftSwapRequests)
        ? parsed.shiftSwapRequests
        : initialState.shiftSwapRequests,
      preferences:
        parsed.preferences && typeof parsed.preferences === "object"
          ? { ...initialState.preferences, ...parsed.preferences }
          : initialState.preferences,
      userClockedIn:
        typeof parsed.userClockedIn === "boolean"
          ? parsed.userClockedIn
          : initialState.userClockedIn,
      currentUserClockInTime:
        typeof parsed.currentUserClockInTime === "string" ||
        parsed.currentUserClockInTime === null
          ? parsed.currentUserClockInTime
          : initialState.currentUserClockInTime,
    };
  } catch {
    return createInitialDemoState();
  }
};

const getDemoSnapshot = () => {
  if (typeof window === "undefined") return serverDemoSnapshot;
  if (clientDemoSnapshot) return clientDemoSnapshot;

  try {
    clientDemoSnapshot = parseStoredDemoState(
      window.localStorage.getItem(DEMO_STORAGE_KEY)
    );
  } catch {
    clientDemoSnapshot = createInitialDemoState();
  }

  return clientDemoSnapshot;
};

const getServerDemoSnapshot = () => serverDemoSnapshot;

const notifyDemoStateListeners = () => {
  demoStateListeners.forEach((listener) => listener());
};

const subscribeToDemoState = (listener: () => void) => {
  demoStateListeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== DEMO_STORAGE_KEY) return;
    clientDemoSnapshot = parseStoredDemoState(event.newValue);
    notifyDemoStateListeners();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    demoStateListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
};

const persistDemoState = (nextState: DemoState) => {
  clientDemoSnapshot = nextState;

  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn("Data demo tidak dapat disimpan ke localStorage.", error);
  }

  notifyDemoStateListeners();
};

const updateDemoState = (updater: (currentState: DemoState) => DemoState) => {
  persistDemoState(updater(getDemoSnapshot()));
};

const clearPersistedDemoState = () => {
  clientDemoSnapshot = createInitialDemoState();

  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch (error) {
    console.warn("Data demo tidak dapat dihapus dari localStorage.", error);
  }

  notifyDemoStateListeners();
};

const nextNumericId = (items: Array<{ id: string }>, prefix: string) => {
  const highestId = items.reduce((highest, item) => {
    const numericId = Number(item.id.replace(`${prefix}-`, ""));
    return Number.isFinite(numericId) ? Math.max(highest, numericId) : highest;
  }, 0);

  return `${prefix}-${String(highestId + 1).padStart(3, "0")}`;
};

const HRContext = createContext<HRContextType | undefined>(undefined);

export function HRProvider({ children }: { children: ReactNode }) {
  const demoState = useSyncExternalStore(
    subscribeToDemoState,
    getDemoSnapshot,
    getServerDemoSnapshot
  );
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const {
    employees,
    attendanceLogs,
    leaveRequests,
    schedules,
    announcements,
    overtimeRequests,
    outlets,
    shiftSwapRequests,
    preferences,
    userClockedIn,
    currentUserClockInTime,
  } = demoState;

  const showToast = (message: string, type: ToastType = "success") => {
    const id = Date.now().toString();
    setToastMessage({ id, message, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.id === id ? null : prev);
    }, 3500);
  };

  const addOutlet = (newOut: Omit<Outlet, "id">) => {
    updateDemoState((currentState) => {
      const outlet: Outlet = {
        ...newOut,
        id: nextNumericId(currentState.outlets, "OUT"),
      };
      return { ...currentState, outlets: [...currentState.outlets, outlet] };
    });
    showToast(`Lokasi ${newOut.name} berhasil ditambahkan ke data demo.`, "success");
  };

  const updateOutlet = (id: string, updatedFields: Partial<Outlet>) => {
    updateDemoState((currentState) => ({
      ...currentState,
      outlets: currentState.outlets.map((outlet) =>
        outlet.id === id ? { ...outlet, ...updatedFields } : outlet
      ),
    }));
    showToast("Data lokasi berhasil diperbarui.", "success");
  };

  const toggleOutletStatus = (id: string) => {
    updateDemoState((currentState) => ({
      ...currentState,
      outlets: currentState.outlets.map((outlet) =>
        outlet.id === id ? { ...outlet, isActive: !outlet.isActive } : outlet
      ),
    }));
    showToast("Status lokasi operasional diperbarui.", "info");
  };

  const clockIn = (notes?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    const { lateTolerance } = getDemoSnapshot().preferences;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isLate = currentMinutes > 8 * 60 + lateTolerance;

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

    updateDemoState((currentState) => ({
      ...currentState,
      attendanceLogs: [newRecord, ...currentState.attendanceLogs],
      userClockedIn: true,
      currentUserClockInTime: timeStr,
    }));
  };

  const clockOut = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

    updateDemoState((currentState) => {
      const activeRecordIndex = currentState.attendanceLogs.findIndex(
        (record) => record.employeeId === "EMP-999" && !record.timeOut
      );

      return {
        ...currentState,
        attendanceLogs: currentState.attendanceLogs.map((record, index) =>
          index === activeRecordIndex ? { ...record, timeOut: timeStr } : record
        ),
        userClockedIn: false,
        currentUserClockInTime: null,
      };
    });
  };

  const submitLeaveRequest = (type: LeaveRequest["type"], startDate: string, endDate: string, reason: string) => {
    // Parse manual untuk menghindari bug zona waktu UTC bawaan JS (YYYY-MM-DD)
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end.getTime() < start.getTime()
    ) {
      showToast("Rentang tanggal cuti tidak valid.", "warning");
      return;
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    updateDemoState((currentState) => {
      const newLeave: LeaveRequest = {
        id: nextNumericId(currentState.leaveRequests, "LV"),
        employeeId: "EMP-999",
        employeeName: "Admin HRD (Saya)",
        department: "HR & Legal",
        type,
        startDate,
        endDate,
        totalDays: diffDays,
        reason: reason.trim(),
        status: "Pending",
        createdAt: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      };

      return {
        ...currentState,
        leaveRequests: [newLeave, ...currentState.leaveRequests],
      };
    });
    showToast("Pengajuan cuti tersimpan pada data demo.", "success");
  };

  const approveLeaveRequest = (id: string) => {
    updateDemoState((currentState) => ({
      ...currentState,
      leaveRequests: currentState.leaveRequests.map((request) =>
        request.id === id ? { ...request, status: "Approved" } : request
      ),
    }));
  };

  const rejectLeaveRequest = (id: string) => {
    updateDemoState((currentState) => ({
      ...currentState,
      leaveRequests: currentState.leaveRequests.map((request) =>
        request.id === id ? { ...request, status: "Rejected" } : request
      ),
    }));
  };

  const addEmployee = (emp: Omit<Employee, "id" | "nik">) => {
    updateDemoState((currentState) => {
      const id = nextNumericId(currentState.employees, "EMP");
      const sequence = id.replace("EMP-", "");
      const newEmployee: Employee = {
        ...emp,
        id,
        nik: `RK-2026-${sequence}`,
      };
      return {
        ...currentState,
        employees: [...currentState.employees, newEmployee],
      };
    });
    showToast(`${emp.name} berhasil ditambahkan ke data demo.`, "success");
  };

  const updateEmployeeShift = (
    employeeId: string,
    date: string,
    shiftName: WorkShift["shiftName"],
    timeSlot: string
  ) => {
    const employee = getDemoSnapshot().employees.find(
      (currentEmployee) => currentEmployee.id === employeeId
    );
    if (!employee) {
      showToast("Karyawan yang dipilih tidak ditemukan.", "warning");
      return;
    }

    updateDemoState((currentState) => {
      const existingSchedule = currentState.schedules.find(
        (schedule) => schedule.employeeId === employeeId && schedule.date === date
      );
      const updatedSchedule: WorkShift = {
        id: existingSchedule?.id ?? nextNumericId(currentState.schedules, "SCH"),
        employeeId,
        employeeName: employee.name,
        department: employee.department,
        date,
        shiftName,
        timeSlot,
      };
      const employeeShift =
        shiftName === "Off / Libur"
          ? "Off / Libur"
          : `${shiftName} (${timeSlot.replace(/\s+WIB$/i, "")})`;

      return {
        ...currentState,
        employees: currentState.employees.map((currentEmployee) =>
          currentEmployee.id === employeeId
            ? { ...currentEmployee, shift: employeeShift }
            : currentEmployee
        ),
        schedules: existingSchedule
          ? currentState.schedules.map((schedule) =>
              schedule.id === existingSchedule.id ? updatedSchedule : schedule
            )
          : [...currentState.schedules, updatedSchedule],
      };
    });
  };

  const submitShiftSwapRequest = (
    targetEmployeeId: string,
    date: string,
    reason: string
  ) => {
    const targetEmployee = getDemoSnapshot().employees.find(
      (employee) => employee.id === targetEmployeeId
    );
    if (!targetEmployee || !reason.trim()) {
      showToast("Pilih staf dan isi alasan tukar shift.", "warning");
      return;
    }

    updateDemoState((currentState) => {
      const request: ShiftSwapRequest = {
        id: nextNumericId(currentState.shiftSwapRequests, "SWP"),
        requesterId: "EMP-999",
        targetEmployeeId,
        date,
        reason: reason.trim(),
        status: "Pending",
        createdAt: new Date().toISOString(),
      };
      return {
        ...currentState,
        shiftSwapRequests: [request, ...currentState.shiftSwapRequests],
      };
    });
    showToast(
      `Simulasi tukar shift dengan ${targetEmployee.name} tersimpan di perangkat ini.`,
      "success"
    );
  };

  const addAnnouncement = (title: string, content: string, category: Announcement["category"], isPinned: boolean = false) => {
    updateDemoState((currentState) => {
      const newAnnouncement: Announcement = {
        id: nextNumericId(currentState.announcements, "ANC"),
        title: title.trim(),
        content: content.trim(),
        category,
        isPinned,
        date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
        author: "Admin HRD"
      };
      return {
        ...currentState,
        announcements: [newAnnouncement, ...currentState.announcements],
      };
    });
    showToast("Pengumuman tersimpan pada data demo.", "success");
  };

  const submitOvertimeRequest = (employeeId: string, date: string, startTime: string, endTime: string, durationHours: number, reason: string) => {
    const emp = getDemoSnapshot().employees.find(e => e.id === employeeId);
    updateDemoState((currentState) => {
      const newOvertime: OvertimeRequest = {
        id: nextNumericId(currentState.overtimeRequests, "OVT"),
        employeeId,
        employeeName: emp ? emp.name : "Staf Operasional",
        department: emp ? emp.department : "Operasional",
        date,
        startTime,
        endTime,
        durationHours,
        reason: reason.trim(),
        status: "Pending",
        createdAt: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      };
      return {
        ...currentState,
        overtimeRequests: [newOvertime, ...currentState.overtimeRequests],
      };
    });
    showToast("Pengajuan lembur tersimpan pada data demo.", "success");
  };

  const approveOvertimeRequest = (id: string) => {
    updateDemoState((currentState) => ({
      ...currentState,
      overtimeRequests: currentState.overtimeRequests.map((request) =>
        request.id === id ? { ...request, status: "Approved" } : request
      ),
    }));
    showToast("Pengajuan lembur berhasil disetujui!", "success");
  };

  const rejectOvertimeRequest = (id: string) => {
    updateDemoState((currentState) => ({
      ...currentState,
      overtimeRequests: currentState.overtimeRequests.map((request) =>
        request.id === id ? { ...request, status: "Rejected" } : request
      ),
    }));
    showToast("Pengajuan lembur ditolak.", "warning");
  };

  const updatePreferences = (updatedPreferences: Partial<DemoPreferences>) => {
    updateDemoState((currentState) => ({
      ...currentState,
      preferences: { ...currentState.preferences, ...updatedPreferences },
    }));
  };

  const resetDemoData = () => {
    clearPersistedDemoState();
    showToast("Data demo berhasil dikembalikan ke kondisi awal.", "success");
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
        outlets,
        shiftSwapRequests,
        preferences,
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
        submitShiftSwapRequest,
        addAnnouncement,
        addOutlet,
        updateOutlet,
        toggleOutletStatus,
        updatePreferences,
        resetDemoData,
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
