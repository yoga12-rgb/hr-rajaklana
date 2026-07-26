"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  LocateFixed,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useHR } from "@/context/HRContext";
import {
  useAttendanceWorkspace,
  useClockInAttendance,
  useClockOutAttendance,
} from "@/lib/attendance/queries";
import type { DeviceLocation } from "@/lib/attendance/repository";
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

/** Workspace presensi live dengan GPS perangkat, geofence server, dan selfie private. */
export function LiveAttendancePage() {
  const { showToast } = useHR();
  const workspace = useAttendanceWorkspace();
  const clockInMutation = useClockInAttendance();
  const clockOutMutation = useClockOutAttendance();
  const [now, setNow] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [outletId, setOutletId] = useState("");
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submitRef = useRef(false);
  const eventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
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

  const refreshLocation = async () => {
    setLocationPending(true);
    try {
      const next = await getDeviceLocation();
      setLocation(next);
      const maxAccuracy = workspace.data?.policy.gps_max_accuracy_m ?? 100;
      if (next.accuracy > maxAccuracy) {
        showToast(
          `Akurasi GPS ${Math.round(next.accuracy)} m, batas maksimal ${maxAccuracy} m. Coba lagi.`,
          "warning"
        );
      }
    } catch (error) {
      showToast(errorMessage(error), "warning");
    } finally {
      setLocationPending(false);
    }
  };

  const resetCapture = () => {
    stopCamera();
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfie(null);
    setSelfieUrl(null);
    setLocation(null);
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
    void refreshLocation();
  };

  const handleClockIn = async () => {
    const data = workspace.data;
    if (submitRef.current) return;
    if (!data || !location) {
      showToast("Ambil lokasi perangkat terbaru terlebih dahulu.", "warning");
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
    }
  };

  const handleClockOut = async () => {
    const session = workspace.data?.open_session;
    if (!session || clockOutMutation.isPending) return;
    try {
      const currentLocation = await getDeviceLocation();
      await clockOutMutation.mutateAsync({
        attendanceId: session.id,
        location: currentLocation,
      });
      playClickSound();
      showToast("Clock-out berhasil. Durasi kerja sudah dihitung.", "success");
    } catch (error) {
      showToast(errorMessage(error), "warning");
    }
  };

  const data = workspace.data;
  const maxAccuracy = data?.policy.gps_max_accuracy_m ?? 100;
  const locationReady = location && location.accuracy <= maxAccuracy;
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
          disabled={clockOutMutation.isPending}
          onClick={data.open_session ? handleClockOut : openClockIn}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition active:scale-[0.98] disabled:opacity-60 ${
            data.open_session
              ? "bg-rose-600 text-white"
              : "bg-amber-500 text-slate-950"
          }`}
        >
          {clockOutMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : data.open_session ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          {data.open_session ? "Clock Out" : "Clock In"}
        </button>
      </section>

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
                  {record.work_date} · {formatTime(record.clock_in_at)}–{formatTime(record.clock_out_at)}
                </p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                {stateLabel(record.clock_out_state ?? record.clock_in_state)}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {formatDuration(record.worked_duration_min)} · Validasi {record.validation_status}
            </p>
          </article>
        ))}
      </section>

      <Modal isOpen={modalOpen} onClose={closeModal} title="Clock In" icon={Camera}>
        <div className="space-y-4">
          {data.role === "supervisor" && (
            <div className="space-y-1">
              <label htmlFor="attendance-outlet" className="text-xs font-semibold text-slate-300">
                Outlet presensi
              </label>
              <select
                id="attendance-outlet"
                value={outletId}
                onChange={(event) => setOutletId(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100 sm:text-sm"
              >
                {data.available_outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-100">
                  {selectedOutlet?.name ?? "Outlet jadwal"}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {location
                    ? `Akurasi ±${Math.round(location.accuracy)} m`
                    : "Lokasi perangkat belum diperoleh"}
                </p>
              </div>
              <button
                type="button"
                onClick={refreshLocation}
                disabled={locationPending}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-bold text-amber-300"
              >
                {locationPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                Ambil Ulang
              </button>
            </div>
            {location && !locationReady && (
              <p className="mt-2 flex items-center gap-1 text-[10px] text-rose-300">
                <AlertCircle className="h-3 w-3" /> Akurasi harus ≤ {maxAccuracy} m.
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
            disabled={clockInMutation.isPending || !locationReady || (data.requires_selfie && !selfie)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clockInMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Verifikasi & Clock In
          </button>
        </div>
      </Modal>
    </div>
  );
}
