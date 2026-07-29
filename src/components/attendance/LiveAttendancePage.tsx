"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  Loader2,
  LocateFixed,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Video,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { Modal } from "@/components/ui/Modal";
import { useHR } from "@/context/HRContext";
import {
  useAttendanceWorkspace,
  useAttendanceGeofencePreview,
  useAttendanceRetentionHealth,
  useAttendanceSelfieUrl,
  useClockInAttendance,
  useClockOutAttendance,
  useDecideAttendanceValidation,
  usePendingAttendanceValidations,
} from "@/lib/attendance/queries";
import type {
  AttendanceValidationItem,
  ClockInPhase,
  DeviceLocation,
  GeofencePreview,
} from "@/lib/attendance/repository";
import { playClickSound } from "@/utils/clickSound";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return "Sesi terbuka";
  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function selfieRetentionDeadline(uploadedAt: string) {
  return new Date(
    new Date(uploadedAt).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();
}

function validationLabel(status: string) {
  return (
    {
      pending: "Menunggu Validasi",
      approved: "Disetujui",
      rejected: "Ditolak",
      needs_correction: "Perlu Koreksi",
    }[status] ?? status
  );
}

function stateLabel(state: string | null) {
  return (
    {
      on_time: "Tepat Waktu",
      late: "Terlambat",
      flexible: "Fleksibel",
      early: "Pulang Lebih Awal",
      potential_overtime: "Potensi Lembur",
      short_hours: "Kurang dari 8 Jam",
      complete: "Selesai",
    }[state ?? ""] ?? "Menunggu"
  );
}

function getDeviceLocation() {
  return new Promise<DeviceLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Perangkat ini tidak menyediakan layanan lokasi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan lokasi pada pengaturan browser."
            : "Lokasi belum dapat diperoleh. Coba di area dengan sinyal GPS lebih baik.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  });
}

/**
 * Pantauan clock-in dan inbox validasi supervisor dengan signed URL dua menit.
 * Bukti dapat dipreview sejak clock-in, sedangkan keputusan menunggu clock-out.
 */
function AttendanceValidationQueue() {
  const { showToast } = useHR();
  const queue = usePendingAttendanceValidations(true);
  const retentionHealth = useAttendanceRetentionHealth(true);
  const decisionMutation = useDecideAttendanceValidation();
  const selfieMutation = useAttendanceSelfieUrl();
  const [selected, setSelected] = useState<AttendanceValidationItem | null>(
    null
  );
  const [note, setNote] = useState("");
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const activeSessionCount =
    queue.data?.filter((item) => !item.clock_out_at).length ?? 0;
  const readyValidationCount =
    queue.data?.filter((item) => item.clock_out_at).length ?? 0;
  const lastCronRunAt = retentionHealth.data?.lastCronRunAt ?? null;
  const lastCronIsStale = retentionHealth.data?.lastCronIsStale ?? false;
  const lastCronFailed =
    retentionHealth.data?.lastCronStatus === "failed" ||
    (retentionHealth.data?.lastCronFailedJobs ?? 0) > 0;

  const close = () => {
    if (decisionMutation.isPending) return;
    setSelected(null);
    setNote("");
    setSelfieUrl(null);
  };

  const open = async (item: AttendanceValidationItem) => {
    setSelected(item);
    setNote("");
    setSelfieUrl(null);
    if (!item.evidence || item.evidence.deleted_at) return;
    try {
      setSelfieUrl(
        await selfieMutation.mutateAsync(item.evidence.storage_path)
      );
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const decide = async (
    decision: "approved" | "rejected" | "needs_correction"
  ) => {
    if (!selected) return;
    if (!selected.clock_out_at) {
      showToast("Keputusan tersedia setelah karyawan clock-out.", "warning");
      return;
    }
    if (decision !== "approved" && note.trim().length < 3) {
      showToast("Catatan minimal 3 karakter wajib untuk keputusan ini.", "warning");
      return;
    }
    try {
      await decisionMutation.mutateAsync({
        attendanceId: selected.id,
        decision,
        note: note.trim(),
        expectedVersion: selected.record_version,
      });
      playClickSound();
      showToast("Keputusan presensi berhasil disimpan.", "success");
      setSelected(null);
      setNote("");
      setSelfieUrl(null);
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-500/20 bg-slate-900 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-100">
          <ClipboardCheck className="h-4 w-4 text-amber-400" />
          Pantauan & Validasi Presensi
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
            {activeSessionCount} sedang bekerja
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
            {readyValidationCount} siap validasi
          </span>
        </div>
      </div>

      {queue.isPending && (
        <div className="flex justify-center py-5 text-amber-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {queue.isError && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {errorMessage(queue.error)}
        </p>
      )}
      {retentionHealth.isError && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage(retentionHealth.error)}
        </p>
      )}
      {retentionHealth.data && (
        <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400">
          <p>
            Retensi foto: {retentionHealth.data.scheduledJobs} terjadwal
            {" · "}
            {retentionHealth.data.retryingJobs} menunggu retry. Status
            diperbarui otomatis setiap menit.
          </p>
          <p className="flex items-center gap-1.5 border-t border-slate-800 pt-1.5">
            <Clock className="h-3 w-3 shrink-0 text-amber-400" />
            {lastCronRunAt
              ? `Cron terakhir ${formatDateTime(lastCronRunAt)} · ${
                  retentionHealth.data.lastCronScannedJobs ?? 0
                } job diperiksa · ${
                  retentionHealth.data.lastCronCompletedJobs ?? 0
                } selesai`
              : "Cron otomatis: menunggu invocation pertama setelah monitoring diaktifkan."}
          </p>
        </div>
      )}
      {lastCronFailed && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Invocation cron terakhir gagal atau masih memiliki{" "}
          {retentionHealth.data?.lastCronFailedJobs ?? 0} job gagal.
        </p>
      )}
      {lastCronIsStale && !lastCronFailed && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Cron otomatis belum tercatat lagi selama lebih dari 26 jam. Periksa
          deployment dan scheduler Vercel.
        </p>
      )}
      {(retentionHealth.data?.overdueJobs ?? 0) > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {retentionHealth.data?.overdueJobs} penghapusan sudah jatuh tempo dan
          menunggu proses cron.
        </p>
      )}
      {(retentionHealth.data?.staleProcessingJobs ?? 0) > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {retentionHealth.data?.staleProcessingJobs} proses worker tertahan dan
          akan dipulihkan otomatis.
        </p>
      )}
      {(retentionHealth.data?.exhaustedJobs ?? 0) > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {retentionHealth.data?.exhaustedJobs} penghapusan selfie berhenti
          setelah enam percobaan dan perlu diperiksa.
        </p>
      )}
      {queue.data?.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">
          Tidak ada sesi aktif atau presensi yang menunggu validasi.
        </p>
      )}
      {queue.data?.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => void open(item)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left transition hover:border-amber-500/30"
        >
          <span>
            <span className="block text-xs font-bold text-slate-100">
              {item.employee_name}
            </span>
            <span className="mt-1 block text-[10px] text-slate-400">
              {formatDate(item.work_date)} · {item.outlet_name} ·{" "}
              {item.clock_out_at
                ? formatDuration(item.worked_duration_min)
                : `Masuk ${formatTime(item.clock_in_at)} · Sedang bekerja`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                item.clock_out_at
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-sky-500/10 text-sky-300"
              }`}
            >
              {item.clock_out_at ? "Siap validasi" : "Sedang bekerja"}
            </span>
            <Eye className="h-4 w-4 text-amber-400" />
          </span>
        </button>
      ))}

      <Modal
        isOpen={selected !== null}
        onClose={close}
        title="Validasi Presensi"
        icon={ClipboardCheck}
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-sm font-bold text-slate-100">
                {selected.employee_name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(selected.work_date)} · {selected.outlet_name}
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Masuk {formatTime(selected.clock_in_at)}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {selected.clock_out_at
                  ? `Pulang ${formatTime(selected.clock_out_at)} · ${formatDuration(
                      selected.worked_duration_min
                    )}`
                  : "Sedang bekerja · keputusan tersedia setelah clock-out"}
              </p>
            </div>

            <div className="flex aspect-[3/4] max-h-80 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              {selfieMutation.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              ) : selfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selfieUrl}
                  alt={`Selfie clock-in ${selected.employee_name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="px-4 text-center text-xs text-slate-500">
                  Bukti selfie tidak tersedia atau sudah dihapus.
                </p>
              )}
            </div>

            {selected.evidence && (
              <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400">
                {selected.evidence.deleted_at
                  ? `Foto telah dihapus otomatis pada ${formatDateTime(
                      selected.evidence.deleted_at
                    )}.`
                  : `Foto tersimpan privat hingga ${formatDateTime(
                      selfieRetentionDeadline(selected.evidence.uploaded_at)
                    )}, lalu masuk proses penghapusan otomatis.`}
              </p>
            )}

            {selected.clock_out_at ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Catatan keputusan
                  </label>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Wajib untuk penolakan atau permintaan koreksi"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={decisionMutation.isPending}
                    onClick={() => void decide("needs_correction")}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300 disabled:opacity-50"
                  >
                    Perlu Koreksi
                  </button>
                  <button
                    type="button"
                    disabled={decisionMutation.isPending}
                    onClick={() => void decide("rejected")}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Tolak
                  </button>
                  <button
                    type="button"
                    disabled={decisionMutation.isPending}
                    onClick={() => void decide("approved")}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Setujui
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                Foto dan waktu clock-in sudah dapat dipantau. Validasi akhir
                tersedia setelah karyawan melakukan clock-out.
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}

/** Workspace presensi live dengan GPS perangkat, geofence server, dan selfie private. */
export function LiveAttendancePage() {
  const { showToast } = useHR();
  const workspace = useAttendanceWorkspace();
  const previewMutation = useAttendanceGeofencePreview();
  const clockInMutation = useClockInAttendance();
  const clockOutMutation = useClockOutAttendance();
  const [now, setNow] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [outletId, setOutletId] = useState("");
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [geofencePreview, setGeofencePreview] =
    useState<GeofencePreview | null>(null);
  const [clockInPhase, setClockInPhase] = useState<
    "locating" | ClockInPhase | null
  >(null);
  const [clockOutPhase, setClockOutPhase] = useState<
    "locating" | "saving" | null
  >(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submitRef = useRef(false);
  const clockOutRef = useRef(false);
  const eventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  const stopCamera = () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  useEffect(() => () => {
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
  }, [selfieUrl]);

  const startCamera = async () => {
    const requestId = ++cameraRequestRef.current;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 640 },
          aspectRatio: { ideal: 0.75 },
        },
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setCameraError(
        denied
          ? "Izin kamera ditolak. Aktifkan kamera pada pengaturan browser."
          : "Kamera depan tidak ditemukan atau sedang digunakan aplikasi lain."
      );
    }
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = 480;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(480, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, 480, 640);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (selfieUrl) URL.revokeObjectURL(selfieUrl);
        setSelfie(blob);
        setSelfieUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.82
    );
  };

  const refreshLocation = async (targetOutletId = outletId) => {
    if (!navigator.onLine) {
      showToast(
        "Perangkat sedang offline. Sambungkan internet sebelum mengambil lokasi.",
        "warning"
      );
      return;
    }
    if (!targetOutletId) return;
    setLocationPending(true);
    setClockInPhase("locating");
    setGeofencePreview(null);
    try {
      const next = await getDeviceLocation();
      setLocation(next);
      const preview = await previewMutation.mutateAsync({
        outletId: targetOutletId,
        location: next,
      });
      setGeofencePreview(preview);
      if (!preview.accuracy_ok) {
        showToast(
          `Akurasi GPS ${Math.round(next.accuracy)} m, batas maksimal ${Math.round(preview.max_accuracy_m)} m. Coba lagi.`,
          "warning"
        );
      }
    } catch (error) {
      showToast(errorMessage(error), "warning");
    } finally {
      setLocationPending(false);
      setClockInPhase(null);
    }
  };

  const resetCapture = () => {
    stopCamera();
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfie(null);
    setSelfieUrl(null);
    setLocation(null);
    setGeofencePreview(null);
    setCameraError(null);
  };

  const closeModal = () => {
    if (submitRef.current) return;
    resetCapture();
    setNotes("");
    setModalOpen(false);
  };

  const openClockIn = () => {
    const data = workspace.data;
    if (!data) return;
    const initialOutlet =
      data.role === "employee"
        ? data.today_assignment?.outlet_id
        : data.available_outlets[0]?.id;
    if (!initialOutlet) {
      showToast(
        data.role === "employee"
          ? "Jadwal terbit hari ini belum tersedia."
          : "Belum ada outlet aktif untuk presensi.",
        "warning"
      );
      return;
    }
    setOutletId(initialOutlet);
    eventIdRef.current = crypto.randomUUID();
    setModalOpen(true);
    void refreshLocation(initialOutlet);
  };

  const handleClockIn = async () => {
    const data = workspace.data;
    if (submitRef.current) return;
    if (!isOnline) {
      showToast("Clock-in membutuhkan koneksi internet.", "warning");
      return;
    }
    if (!data || !location || !geofencePreview) {
      showToast("Ambil lokasi perangkat terbaru terlebih dahulu.", "warning");
      return;
    }
    if (!geofencePreview.location_fresh) {
      showToast("Lokasi sudah kedaluwarsa. Ambil lokasi kembali.", "warning");
      return;
    }
    if (!geofencePreview.accuracy_ok) {
      showToast("Akurasi GPS belum memenuhi batas presensi.", "warning");
      return;
    }
    if (!geofencePreview.within_geofence) {
      showToast("Posisi masih berada di luar geofence outlet.", "warning");
      return;
    }
    if (data.requires_selfie && !selfie) {
      showToast("Ambil selfie langsung dari kamera sebelum clock-in.", "warning");
      return;
    }
    try {
      submitRef.current = true;
      await clockInMutation.mutateAsync({
        currentEmployeeId: data.current_employee_id,
        clientEventId: eventIdRef.current ?? crypto.randomUUID(),
        outletId,
        location,
        selfie,
        notes: notes.trim(),
        onPhase: setClockInPhase,
      });
      playClickSound();
      showToast("Clock-in berhasil diverifikasi oleh server.", "success");
      resetCapture();
      setNotes("");
      setModalOpen(false);
    } catch (error) {
      showToast(errorMessage(error), "warning");
    } finally {
      submitRef.current = false;
      setClockInPhase(null);
    }
  };

  const handleClockOut = async () => {
    const session = workspace.data?.open_session;
    if (!session || clockOutRef.current) return;
    if (!navigator.onLine) {
      showToast("Clock-out membutuhkan koneksi internet.", "warning");
      return;
    }
    clockOutRef.current = true;
    setClockOutPhase("locating");
    try {
      const currentLocation = await getDeviceLocation();
      setClockOutPhase("saving");
      await clockOutMutation.mutateAsync({
        attendanceId: session.id,
        location: currentLocation,
      });
      playClickSound();
      showToast("Clock-out berhasil. Durasi kerja sudah dihitung.", "success");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    } finally {
      clockOutRef.current = false;
      setClockOutPhase(null);
    }
  };

  const data = workspace.data;
  const maxAccuracy = data?.policy.gps_max_accuracy_m ?? 100;
  const locationAgeSeconds = location
    ? Math.max(0, Math.floor((now.getTime() - new Date(location.capturedAt).getTime()) / 1000))
    : null;
  const locationFresh = locationAgeSeconds != null && locationAgeSeconds <= 90;
  const locationReady = Boolean(
    location &&
      locationFresh &&
      geofencePreview?.accuracy_ok &&
      geofencePreview.location_fresh &&
      geofencePreview.within_geofence
  );
  const selectedOutlet = useMemo(
    () => data?.available_outlets.find((outlet) => outlet.id === outletId),
    [data?.available_outlets, outletId]
  );

  if (workspace.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center text-amber-400">
        <Loader2 className="h-7 w-7 animate-spin" aria-label="Memuat presensi" />
      </div>
    );
  }
  if (workspace.isError || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
        {errorMessage(workspace.error)}
      </div>
    );
  }
  if (data.role === "management") {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
        Akun manajemen bersifat read-only dan tidak melakukan presensi.
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200">
          <WifiOff className="h-4 w-4 shrink-0" />
          Perangkat offline. Riwayat tersimpan dapat terlihat, tetapi presensi
          membutuhkan internet.
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Presensi & Kehadiran</h1>
          <p className="mt-1 text-xs text-slate-400">
            GPS dan geofence diverifikasi langsung oleh server.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Live
        </span>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-amber-950 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          {new Intl.DateTimeFormat("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          }).format(now)}
        </p>
        <p className="mt-2 font-mono text-3xl font-black text-slate-100">
          {new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Jakarta",
          }).format(now)}{" "}
          WIB
        </p>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
          {data.open_session ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-400" />
              Masuk {formatTime(data.open_session.clock_in_at)} ·{" "}
              {data.open_session.outlet_name}
            </span>
          ) : data.today_assignment ? (
            <span>
              Jadwal {data.today_assignment.planned_start.slice(0, 5)}–
              {data.today_assignment.planned_end.slice(0, 5)} ·{" "}
              {data.today_assignment.outlet_name}
            </span>
          ) : (
            <span>
              {data.role === "supervisor"
                ? "Presensi fleksibel · target kerja 8 jam"
                : "Tidak ada jadwal terbit hari ini"}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={clockOutPhase !== null || !isOnline}
          onClick={data.open_session ? handleClockOut : openClockIn}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition active:scale-[0.98] disabled:opacity-60 ${
            data.open_session
              ? "bg-rose-600 text-white"
              : "bg-amber-500 text-slate-950"
          }`}
        >
          {clockOutPhase !== null ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : data.open_session ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {clockOutPhase === "locating"
            ? "Mengambil Lokasi…"
            : clockOutPhase === "saving"
              ? "Menyimpan Clock-out…"
              : data.open_session
                ? "Clock Out"
                : "Clock In"}
        </button>
      </section>

      {data.role === "supervisor" && <AttendanceValidationQueue />}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-100">
            <Clock className="h-4 w-4 text-amber-400" /> Riwayat Saya
          </h2>
          <span className="text-[10px] text-slate-500">{data.history.length} catatan</span>
        </div>
        {data.history.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
            Belum ada riwayat presensi.
          </p>
        )}
        {data.history.map((record) => (
          <article key={record.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-100">{record.outlet_name}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {formatDate(record.work_date)} · {formatTime(record.clock_in_at)}–{formatTime(record.clock_out_at)}
                </p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                {stateLabel(record.clock_out_state ?? record.clock_in_state)}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {formatDuration(record.worked_duration_min)} ·{" "}
              {validationLabel(record.validation_status)}
              {record.clock_out_state && record.clock_in_state === "late"
                ? " · Datang Terlambat"
                : ""}
            </p>
          </article>
        ))}
      </section>

      <Modal isOpen={modalOpen} onClose={closeModal} title="Clock In" icon={Camera}>
        <div className="space-y-4">
          {data.role === "supervisor" && (
            <Combobox
              label="Outlet presensi"
              value={outletId}
              onChange={(value) => {
                setOutletId(value);
                setGeofencePreview(null);
                if (location && locationFresh) {
                  void previewMutation
                    .mutateAsync({ outletId: value, location })
                    .then(setGeofencePreview)
                    .catch((error) =>
                      showToast(errorMessage(error), "warning")
                    );
                } else {
                  void refreshLocation(value);
                }
              }}
              options={data.available_outlets.map((outlet) => ({
                value: outlet.id,
                label: outlet.name,
                subtext: `${outlet.address} · Radius ${outlet.geofence_radius_m} m`,
              }))}
              placeholder="Pilih outlet"
              searchPlaceholder="Cari nama atau alamat outlet…"
            />
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-100">
                  {selectedOutlet?.name ?? "Outlet jadwal"}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {location
                    ? `Akurasi ±${Math.round(location.accuracy)} m · usia ${locationAgeSeconds ?? 0} dtk`
                    : "Lokasi perangkat belum diperoleh"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshLocation()}
                disabled={locationPending}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-bold text-amber-300"
              >
                {locationPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                Ambil Ulang
              </button>
            </div>
            {location && !locationReady && (
              <div className="mt-2 space-y-1 text-[10px] text-rose-300">
                {!locationFresh ? (
                  <p className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Lokasi kedaluwarsa.
                    Ambil ulang sebelum presensi.
                  </p>
                ) : !geofencePreview?.accuracy_ok ? (
                  <p className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Akurasi harus ≤{" "}
                    {maxAccuracy} m.
                  </p>
                ) : geofencePreview && !geofencePreview.within_geofence ? (
                  <p className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Jarak{" "}
                    {Math.round(geofencePreview.distance_m)} m, di luar radius{" "}
                    {geofencePreview.radius_m} m.
                  </p>
                ) : (
                  <p>Geofence sedang diverifikasi server…</p>
                )}
              </div>
            )}
            {geofencePreview && locationReady && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                <CheckCircle2 className="h-3 w-3" /> Jarak{" "}
                {Math.round(geofencePreview.distance_m)} m · di dalam radius{" "}
                {geofencePreview.radius_m} m.
              </p>
            )}
          </div>

          {data.requires_selfie && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Selfie masuk (wajib)</span>
                {selfie && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300"><Check className="h-3 w-3" /> Siap</span>}
              </div>
              <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:h-80">
                <canvas ref={canvasRef} className="hidden" />
                {selfieUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL blob lokal hasil kamera, bukan aset jaringan. */}
                    <img src={selfieUrl} alt="Pratinjau selfie masuk" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => { setSelfie(null); setSelfieUrl(null); void startCamera(); }} className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-slate-900/90 px-3 py-2 text-[11px] font-bold text-amber-300">
                      <RotateCcw className="h-3.5 w-3.5" /> Ulangi
                    </button>
                  </>
                ) : cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                    <button type="button" onClick={captureSelfie} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950">
                      <Camera className="h-4 w-4" /> Ambil Selfie
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 p-5 text-center">
                    <Video className="mx-auto h-8 w-8 text-amber-400" />
                    <p className="text-xs text-slate-400">{cameraError ?? "Kamera depan digunakan langsung; galeri tidak tersedia."}</p>
                    <button type="button" onClick={startCamera} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300">Buka Kamera</button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="attendance-notes" className="text-xs font-semibold text-slate-300">Catatan (opsional)</label>
            <input id="attendance-notes" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100 sm:text-sm" placeholder="Tambahkan konteks bila diperlukan" />
          </div>
          <button
            type="button"
            onClick={handleClockIn}
            disabled={
              clockInMutation.isPending ||
              clockInPhase !== null ||
              !isOnline ||
              !locationReady ||
              (data.requires_selfie && !selfie)
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(clockInMutation.isPending || clockInPhase !== null) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {clockInPhase === "locating"
              ? "Mengambil Lokasi…"
              : clockInPhase === "uploading"
                ? "Mengunggah Selfie…"
                : clockInPhase === "saving"
                  ? "Menyimpan Presensi…"
                  : "Verifikasi & Clock In"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
