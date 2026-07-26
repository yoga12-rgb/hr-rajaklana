"use client";

import { useRef, useState } from "react";
import type { Cell, SheetData } from "write-excel-file/browser";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  useCommitEmployeeImport,
  useDryRunEmployeeImport,
} from "@/lib/master-data/queries";
import type {
  EmployeeImportDryRunResult,
  EmployeeImportRow,
  LiveEmploymentStatus,
  LiveJobPosition,
  LiveOutlet,
} from "@/lib/master-data/repository";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

const requiredHeaders = [
  "nik",
  "full_name",
  "phone",
  "joined_at",
  "employment_status_code",
  "job_position_code",
  "outlet_code",
  "change_reason",
] as const;

type RequiredHeader = (typeof requiredHeaders)[number];

function headerCell(value: string): Cell {
  return {
    value,
    type: String,
    fontWeight: "bold",
    backgroundColor: "#F59E0B",
    textColor: "#020617",
  };
}

function dateToInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cellToText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateToInputValue(value);
  return String(value).trim();
}

function parseEmployeeRows(sheetData: unknown[][]): EmployeeImportRow[] {
  if (sheetData.length < 2) {
    throw new Error("File XLSX belum memiliki baris data karyawan.");
  }

  const headers = sheetData[0].map((value) =>
    cellToText(value).toLocaleLowerCase("id-ID")
  );
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Kolom wajib tidak ditemukan: ${missingHeaders.join(", ")}.`
    );
  }

  const indexes = Object.fromEntries(
    requiredHeaders.map((header) => [header, headers.indexOf(header)])
  ) as Record<RequiredHeader, number>;

  const rows = sheetData
    .slice(1)
    .filter((row) => row.some((cell) => cellToText(cell) !== ""))
    .map((row) => ({
      nik: cellToText(row[indexes.nik]).toUpperCase(),
      full_name: cellToText(row[indexes.full_name]),
      phone: cellToText(row[indexes.phone]),
      joined_at: cellToText(row[indexes.joined_at]),
      employment_status_code: cellToText(
        row[indexes.employment_status_code]
      ),
      job_position_code: cellToText(row[indexes.job_position_code]),
      outlet_code: cellToText(row[indexes.outlet_code]).toUpperCase(),
      change_reason:
        cellToText(row[indexes.change_reason]) || "Impor data awal",
    }));

  if (rows.length < 1) {
    throw new Error("File XLSX belum memiliki baris data karyawan.");
  }

  if (rows.length > 500) {
    throw new Error("Maksimal 500 baris untuk setiap proses impor.");
  }

  return rows;
}

/**
 * Alur impor XLSX khusus supervisor.
 *
 * File dibaca lokal di browser dan tidak diunggah ke Storage. PostgreSQL
 * memvalidasi seluruh referensi dan duplikasi, menyimpan ringkasan dry-run,
 * lalu hanya mengizinkan commit atomik untuk payload dengan checksum sama.
 */
export function EmployeeImportModal({
  isOpen,
  outlets,
  jobPositions,
  employmentStatuses,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  outlets: LiveOutlet[];
  jobPositions: LiveJobPosition[];
  employmentStatuses: LiveEmploymentStatus[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dryRunMutation = useDryRunEmployeeImport();
  const commitMutation = useCommitEmployeeImport();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<EmployeeImportRow[]>([]);
  const [dryRunResult, setDryRunResult] =
    useState<EmployeeImportDryRunResult | null>(null);
  const [reason, setReason] = useState("Impor data awal dari template XLSX");
  const [formError, setFormError] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const isPending =
    isReadingFile || dryRunMutation.isPending || commitMutation.isPending;

  const resetValidation = () => {
    setFileName("");
    setRows([]);
    setDryRunResult(null);
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = async () => {
    playClickSound();
    setIsDownloading(true);
    setFormError("");

    try {
      const { default: writeXlsxFile } = await import(
        "write-excel-file/browser"
      );
      const sampleStatus = employmentStatuses[0]?.code ?? "tetap";
      const samplePosition = jobPositions[0]?.code ?? "cashier";
      const sampleOutlet = outlets[0]?.code ?? "OUTLET-01";
      const employeeData: SheetData = [
        requiredHeaders.map((header) => headerCell(header)),
        [
          { value: "RK-2026-002", type: String },
          { value: "Nama Karyawan", type: String },
          { value: "081234567890", type: String },
          { value: "2026-07-26", type: String },
          { value: sampleStatus, type: String },
          { value: samplePosition, type: String },
          { value: sampleOutlet, type: String },
          { value: "Impor data awal", type: String },
        ],
      ];
      const referenceData: SheetData = [
        ["jenis_referensi", "kode", "nama"].map((value) => headerCell(value)),
        ...employmentStatuses.map((status) => [
          { value: "status_kerja", type: String },
          { value: status.code, type: String },
          { value: status.name, type: String },
        ]),
        ...jobPositions.map((position) => [
          { value: "jabatan", type: String },
          { value: position.code, type: String },
          { value: position.name, type: String },
        ]),
        ...outlets.map((outlet) => [
          { value: "outlet", type: String },
          { value: outlet.code, type: String },
          { value: outlet.name, type: String },
        ]),
      ];

      await writeXlsxFile([
        {
          data: employeeData,
          sheet: "Karyawan",
          stickyRowsCount: 1,
        },
        {
          data: referenceData,
          sheet: "Referensi",
          stickyRowsCount: 1,
        },
      ]).toFile("template-impor-karyawan-rajaklana.xlsx");
    } catch {
      setFormError("Template XLSX belum dapat dibuat di perangkat ini.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetValidation();
    setIsReadingFile(true);

    try {
      if (!file.name.toLocaleLowerCase("id-ID").endsWith(".xlsx")) {
        throw new Error("Pilih file dengan ekstensi .xlsx.");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Ukuran file maksimal 2 MB.");
      }

      const { readSheet } = await import("read-excel-file/browser");
      const sheetData = await readSheet(file, 1);
      const parsedRows = parseEmployeeRows(sheetData as unknown[][]);
      setFileName(file.name);
      setRows(parsedRows);

      const result = await dryRunMutation.mutateAsync({
        sourceFileName: file.name,
        rows: parsedRows,
      });
      setDryRunResult(result);
      playSuccessHaptic();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "File XLSX belum dapat dibaca."
      );
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleCommit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!dryRunResult || dryRunResult.failed_rows > 0 || !reason.trim()) {
      setFormError(
        "Selesaikan seluruh kesalahan validasi dan isi alasan impor."
      );
      return;
    }

    try {
      const result = await commitMutation.mutateAsync({
        dryRunJobId: dryRunResult.job_id,
        rows,
        reason: reason.trim(),
      });
      playSuccessHaptic();
      onSuccess(
        `${result.imported_rows} data karyawan berhasil diimpor secara atomik.`
      );
      resetValidation();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Data karyawan belum dapat diimpor."
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isPending) onClose();
      }}
      title="Impor Data Karyawan"
      icon={FileSpreadsheet}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleCommit} className="space-y-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Dry-run wajib sebelum impor
          </div>
          File dibaca hanya di perangkat ini. Email dan kata sandi tidak ikut
          diimpor; akun login tetap dibuat terpisah oleh supervisor.
        </div>

        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
          >
            {isDownloading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Unduh Template XLSX
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Pilih & Validasi XLSX
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Pilih file XLSX data karyawan"
          />
        </div>

        {fileName && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="truncate text-xs font-bold text-slate-200">
              {fileName}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {rows.length} baris dibaca dari sheet pertama.
            </p>
          </div>
        )}

        {dryRunResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <ImportStat label="Total" value={dryRunResult.total_rows} />
              <ImportStat
                label="Valid"
                value={dryRunResult.success_rows}
                tone="amber"
              />
              <ImportStat
                label="Bermasalah"
                value={dryRunResult.failed_rows}
                tone={dryRunResult.failed_rows > 0 ? "rose" : "slate"}
              />
            </div>

            {dryRunResult.failed_rows > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <TriangleAlert className="h-4 w-4" />
                  Perbaiki file lalu validasi ulang
                </div>
                {dryRunResult.validation_errors.map((rowError) => (
                  <div
                    key={rowError.row_number}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                  >
                    <p className="mb-1 text-[11px] font-bold text-slate-200">
                      Baris Excel {rowError.row_number + 1}
                    </p>
                    <ul className="space-y-1 text-[10px] text-rose-300">
                      {rowError.errors.map((issue, index) => (
                        <li key={`${issue.field}-${issue.code}-${index}`}>
                          <strong>{issue.field}:</strong> {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-400" />
                <p>
                  Semua baris valid. Database akan mengimpor seluruh baris
                  dalam satu transaksi atau membatalkan semuanya.
                </p>
              </div>
            )}
          </div>
        )}

        {dryRunResult?.failed_rows === 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Alasan impor
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
          >
            Tutup
          </button>
          <button
            type="submit"
            disabled={
              isPending ||
              !dryRunResult ||
              dryRunResult.failed_rows > 0 ||
              !reason.trim()
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {commitMutation.isPending && (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            )}
            Impor Semua
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "border-slate-800 text-slate-200",
    amber: "border-amber-500/25 text-amber-300",
    rose: "border-rose-500/25 text-rose-300",
  }[tone];

  return (
    <div
      className={`rounded-xl border bg-slate-950 p-2.5 text-center ${toneClass}`}
    >
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
