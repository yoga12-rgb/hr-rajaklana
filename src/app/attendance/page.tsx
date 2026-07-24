"use client";

import { useState, useEffect, useRef } from "react";
import { useHR } from "@/context/HRContext";
import { 
  Clock, 
  MapPin, 
  QrCode, 
  CheckCircle2, 
  Camera, 
  Calendar, 
  AlertCircle, 
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Check,
  Video
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/Modal";

export default function AttendancePage() {
  const { userClockedIn, currentUserClockInTime, clockIn, clockOut, attendanceLogs, showToast } = useHR();
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [simulatedDistance, setSimulatedDistance] = useState<number>(50);

  // Camera State & Refs
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB");
      setDateStr(now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const startCamera = async () => {
    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 480 }, 
          height: { ideal: 640 },
          aspectRatio: { ideal: 0.75 }
        }
      });

      // Modal bisa ditutup ketika dialog izin kamera masih terbuka.
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (error: unknown) {
      if (requestId !== cameraRequestRef.current) return;

      console.error("Camera access error:", error);
      const permissionDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");

      setCameraError(
        permissionDenied
          ? "Izin kamera ditolak. Aktifkan izin kamera pada pengaturan browser."
          : "Perangkat kamera tidak ditemukan atau tidak dapat digunakan."
      );
      setIsCameraActive(false);
    }
  };

  // Attach stream to video element when it becomes available in DOM
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    cameraRequestRef.current += 1;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 480;
      const height = video.videoHeight || 640;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror the canvas image to match live video view (-scale-x-100)
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = canvas.toDataURL("image/jpeg");
        setCapturedImage(imgData);
        stopCamera();
      }
    }
  };

  const retakeSelfie = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Pastikan stream perangkat dilepas ketika halaman tidak lagi dirender.
  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const closeClockInModal = () => {
    stopCamera();
    setCapturedImage(null);
    setCameraError(null);
    setShowModal(false);
  };

  const handleClockInSubmit = () => {
    if (simulatedDistance > 50) {
      showToast("Gagal Absen: Anda berada di luar radius presensi kantor! (120m > Radius Maksimal 50m)", "warning");
      return;
    }
    clockIn(notes || `Check-in GPS & Selfie (Jarak: ${simulatedDistance}m)`);
    showToast("Absen Masuk Berhasil! Verifikasi Wajah & GPS Selesai.", "success");
    setNotes("");
    closeClockInModal();
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Presensi & Kehadiran</h1>
          <p className="text-xs text-slate-400">Pencatatan jam kerja & riwayat kehadiran mobile</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
          <ShieldCheck className="w-3.5 h-3.5" /> GPS Active
        </span>
      </div>

      {/* Realtime Mobile Clock Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-6 border border-slate-800 shadow-xl text-center space-y-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <p className="text-xs text-amber-400 font-semibold tracking-wider uppercase">{dateStr}</p>
          <h2 className="text-4xl font-extrabold text-slate-100 font-mono tracking-tight">{timeStr || "00:00:00 WIB"}</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400 inline" /> Rajaklana HQ (Area Utama Operasional)
          </p>
        </div>

        {/* Status Indicator */}
        <div className="pt-2 relative z-10">
          {userClockedIn ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Sudah Absen Masuk pukul <strong className="font-mono text-white">{currentUserClockInTime}</strong></span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Anda belum melakukan Absen Masuk untuk shift hari ini</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 relative z-10">
          {userClockedIn ? (
            <button
              onClick={() => clockOut()}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Absen Pulang (Clock Out)</span>
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Absen Masuk (Clock In)</span>
            </button>
          )}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Attendance Log List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Riwayat Presensi Terbaru</span>
          </h3>
          <span className="text-[11px] text-slate-400">Total: {attendanceLogs.length} Log</span>
        </div>

        <div className="space-y-3">
          {attendanceLogs.map((log) => (
            <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                    {log.employeeName.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{log.employeeName}</p>
                    <p className="text-[10px] text-slate-400">{log.role} &bull; {log.department}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                  log.status === "Tepat Waktu"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : log.status === "Terlambat"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  {log.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900 text-slate-400">
                <span className="font-mono text-slate-300">Masuk: {log.timeIn} {log.timeOut ? `| Keluar: ${log.timeOut}` : ""}</span>
                <span className="text-[10px] text-slate-500">{log.date}</span>
              </div>

              {log.notes && (
                <p className="text-[11px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-800/50">
                  Catatan: {log.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Clock In Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeClockInModal}
        title="Form Presensi Masuk"
        icon={Camera}
      >
        <div className="space-y-4">
          {/* GPS Simulation Switcher */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Simulasi Posisi GPS Staf:</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSimulatedDistance(50)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  simulatedDistance === 50
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>50m (Lolos)</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulatedDistance(120)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  simulatedDistance === 120
                    ? "bg-rose-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>120m (Ditolak)</span>
              </button>
            </div>
          </div>

          {/* Live Camera / Selfie Capture Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">Foto Selfie Kehadiran Staf:</label>
              {capturedImage && (
                <span className="text-amber-400 text-[10px] flex items-center gap-1 font-bold">
                  <Check className="w-3 h-3" /> Foto Terverifikasi
                </span>
              )}
            </div>

            <div className="relative w-full h-72 sm:h-80 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center">
              {/* Hidden Canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Case 1: Captured Image Preview */}
              {capturedImage ? (
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-img-element */}
                  <img
                    src={capturedImage}
                    alt="Selfie Check-in"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={retakeSelfie}
                    className="absolute bottom-2 right-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 shadow-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Foto Ulang</span>
                  </button>
                </div>
              ) : isCameraActive ? (
                /* Case 2: Live Video Stream */
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-amber-500/50 rounded-xl pointer-events-none" />
                  <button
                    type="button"
                    onClick={captureSelfie}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer z-10"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Foto Selfie</span>
                  </button>
                </div>
              ) : (
                /* Case 3: Initial Camera Trigger Button */
                <div className="p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <Video className="w-5 h-5" />
                  </div>
                  {cameraError ? (
                    <p className="text-xs text-rose-400 font-medium">{cameraError}</p>
                  ) : (
                    <p className="text-xs text-slate-400">Aktifkan kamera depan HP/laptop untuk verifikasi foto presensi</p>
                  )}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 mx-auto cursor-pointer shadow-sm"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Buka Kamera Device</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selfie & Geofence Visualizer Box */}
          <div className={`p-3 rounded-xl border space-y-1 text-center transition-colors ${
            simulatedDistance <= 50
              ? "bg-slate-950 border-amber-500/40"
              : "bg-rose-950/20 border-rose-500/40"
          }`}>
            <p className="text-xs font-bold text-slate-200">
              {simulatedDistance <= 50 
                ? "Jarak: 50 Meter (Di Dalam Radius Presensi)" 
                : "Jarak: 120 Meter (Di Luar Radius Presensi)"}
            </p>
            <p className={`text-[10px] font-semibold ${
              simulatedDistance <= 50 ? "text-amber-400" : "text-rose-400"
            }`}>
              {simulatedDistance <= 50
                ? "✓ Terverifikasi di Area Rajaklana HQ (<= 50M)"
                : "✕ GAGAL: Posisi melebihi batas radius 50 Meter"}
            </p>
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Catatan Presensi (Opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Kerja shift pagi di area kitchen"
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={closeClockInModal}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleClockInSubmit}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Konfirmasi Absen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
