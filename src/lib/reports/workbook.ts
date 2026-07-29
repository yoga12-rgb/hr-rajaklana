import type { Cell, SheetData } from "write-excel-file/universal";
import type { ReportWorkspace } from "./repository";

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function headerCell(value: string): Cell {
  return {
    value,
    type: String,
    fontWeight: "bold",
    backgroundColor: "#F59E0B",
    textColor: "#020617",
  };
}

function textCell(value: string | number | null): Cell {
  return {
    value: value ?? "—",
    type: typeof value === "number" ? Number : String,
  };
}

/** Membentuk lima sheet XLSX yang identik untuk ekspor browser dan worker. */
export function reportWorkbookSheets(data: ReportWorkspace) {
  const summary: SheetData = [
    ["Metrik", "Nilai"].map(headerCell),
    [
      textCell("Periode"),
      textCell(`${data.period_start} s/d ${data.period_end}`),
    ],
    [textCell("Karyawan dalam scope"), textCell(data.summary.employee_count)],
    [textCell("Log presensi"), textCell(data.summary.attendance_count)],
    [
      textCell("Tepat waktu/fleksibel"),
      textCell(data.summary.on_time_count),
    ],
    [textCell("Terlambat"), textCell(data.summary.late_count)],
    [
      textCell("Pulang awal/jam kurang"),
      textCell(data.summary.early_checkout_count),
    ],
    [
      textCell("Cuti disetujui (hari)"),
      textCell(data.summary.approved_leave_days),
    ],
    [
      textCell("Lembur disetujui (menit)"),
      textCell(data.summary.approved_overtime_minutes),
    ],
  ];
  const attendance: SheetData = [
    [
      "Nama",
      "Jabatan",
      "Outlet",
      "Tanggal",
      "Masuk",
      "Pulang",
      "Durasi (menit)",
      "Status masuk",
      "Status pulang",
      "Validasi",
    ].map(headerCell),
    ...data.attendance.map((row) => [
      textCell(row.employee_name),
      textCell(row.position_name),
      textCell(row.outlet_name),
      textCell(row.work_date),
      textCell(formatTime(row.clock_in_at)),
      textCell(formatTime(row.clock_out_at)),
      textCell(row.worked_duration_min),
      textCell(row.clock_in_state),
      textCell(row.clock_out_state),
      textCell(row.validation_status),
    ]),
  ];
  const leaves: SheetData = [
    ["Nama", "Jenis", "Mulai", "Selesai", "Hari", "Status"].map(headerCell),
    ...data.leaves.map((row) => [
      textCell(row.employee_name),
      textCell(row.leave_type_name),
      textCell(row.starts_on),
      textCell(row.ends_on),
      textCell(row.requested_days),
      textCell(row.status),
    ]),
  ];
  const overtime: SheetData = [
    [
      "Nama",
      "Tanggal",
      "Sumber",
      "Rencana (menit)",
      "Aktual (menit)",
      "Disetujui (menit)",
      "Status",
    ].map(headerCell),
    ...data.overtime.map((row) => [
      textCell(row.employee_name),
      textCell(row.overtime_date),
      textCell(row.source_type),
      textCell(row.planned_duration_min),
      textCell(row.actual_duration_min),
      textCell(row.approved_duration_min),
      textCell(row.status),
    ]),
  ];
  const shifts: SheetData = [
    ["Shift/Status", "Jenis Penugasan", "Status", "Total"].map(headerCell),
    ...data.shift_distribution.map((row) => [
      textCell(row.shift_type),
      textCell(row.assignment_type),
      textCell(row.status),
      textCell(row.total),
    ]),
  ];

  return [
    { data: summary, sheet: "Ringkasan", stickyRowsCount: 1 },
    { data: attendance, sheet: "Presensi", stickyRowsCount: 1 },
    { data: leaves, sheet: "Cuti", stickyRowsCount: 1 },
    { data: overtime, sheet: "Lembur", stickyRowsCount: 1 },
    { data: shifts, sheet: "Distribusi Shift", stickyRowsCount: 1 },
  ];
}
