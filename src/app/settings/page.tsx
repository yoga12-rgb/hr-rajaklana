"use client";

import { useState } from "react";
import { useHR } from "@/context/HRContext";
import { useDataSource } from "@/context/DataSourceContext";
import {
  useActiveShiftTemplates,
  useCreateOutletMaster,
  useCurrentPolicies,
  useCurrentAccessRole,
  useLiveEmployees,
  useLiveOutlets,
  usePublishPolicyVersion,
  usePublishWorkPolicy,
  useReplaceOutletShiftTemplate,
  useReplaceOutletStaffingRequirements,
  useSetOutletActive,
  useStaffingRequirements,
  useUpdateOutletMaster,
} from "@/lib/master-data/queries";
import type { LiveOutlet } from "@/lib/master-data/repository";
import { 
  Building2, 
  MapPin, 
  Plus, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Calendar, 
  Bell, 
  Navigation, 
  SlidersHorizontal, 
  Compass, 
  Power,
  Database,
  RotateCcw,
  Pencil,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

export default function SettingsPage() {
  const dataSource = useDataSource();
  const liveOutletCountQuery = useLiveOutlets(
    dataSource.mode === "supabase",
    true
  );
  const { 
    outlets, 
    addOutlet, 
    toggleOutletStatus, 
    employees, 
    preferences,
    updatePreferences,
    resetDemoData,
    showToast
  } = useHR();

  const [activeTab, setActiveTab] = useState<"outlets" | "work_policy" | "leave_policy" | "security">("outlets");
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Form State Tambah Outlet Baru
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("-6.2891");
  const [longitude, setLongitude] = useState("106.7214");
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [openTime, setOpenTime] = useState("07:00");
  const [closeTime, setCloseTime] = useState("22:00");

  const handleAddOutletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !address) {
      showToast("Harap isi semua bidang lokasi yang wajib!", "warning");
      return;
    }

    addOutlet({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      address: address.trim(),
      latitude: parseFloat(latitude) || -6.2891,
      longitude: parseFloat(longitude) || 106.7214,
      radiusMeters: Number(radiusMeters) || 100,
      openTime: openTime || "07:00",
      closeTime: closeTime || "22:00",
      isActive: true,
    });

    // Reset Form
    setName("");
    setCode("");
    setAddress("");
    setShowAddOutletModal(false);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header Settings Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-5 border border-slate-800 shadow-xl flex items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border-2 border-amber-500/40 flex items-center justify-center font-extrabold text-xl shadow-lg shadow-amber-500/20 shrink-0">
            <SlidersHorizontal className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-100">Pengaturan Sistem & Operations Portal</h1>
            <p className="text-xs text-amber-400 font-semibold">Manajemen Lokasi GPS, Geofencing, Shift & Kebijakan HR</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-slate-400" /> Rajaklana HR Operational Hub
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-right relative z-10">
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1">
            <Database className="w-3 h-3" />{" "}
            {dataSource.mode === "supabase" ? "Live Bertahap" : "Data Demo Lokal"}
          </span>
        </div>

        <div className="absolute right-0 bottom-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Navigation Tab Settings */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveTab("outlets")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "outlets"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Lokasi & Geofencing GPS</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full font-bold bg-slate-950/20 text-slate-950">
            {dataSource.mode === "supabase"
              ? (liveOutletCountQuery.data?.length ?? "…")
              : outlets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("work_policy")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "work_policy"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Jam Kerja & Presensi</span>
        </button>

        <button
          onClick={() => setActiveTab("leave_policy")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "leave_policy"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Aturan Cuti</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "security"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Keamanan & Akses</span>
        </button>
      </div>

      {dataSource.mode === "supabase" && activeTab === "security" && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          Pengaturan notifikasi dan reset demo pada tab ini masih bersifat
          lokal. Akun pengguna sudah dilindungi Supabase Auth.
        </div>
      )}

      {/* TAB 1: MANAJEMEN LOKASI & GEOFENCING GPS */}
      {activeTab === "outlets" && (
        dataSource.mode === "supabase" ? (
          <LiveOutletManager />
        ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Daftar Lokasi & Area Operasional
              </h3>
              <p className="text-[11px] text-slate-400">Pengaturan lokasi GPS Geofencing presensi seluruh staf</p>
            </div>
            <button
              onClick={() => setShowAddOutletModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Lokasi</span>
            </button>
          </div>

          {/* Grid Cards Outlet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {outlets.map((out) => {
              const staffCount = employees.filter(e => e.department === out.name).length;
              return (
                <div 
                  key={out.id} 
                  className={`p-4 rounded-2xl bg-slate-900 border transition-all space-y-3 ${
                    out.isActive ? "border-slate-800 shadow-md" : "border-rose-900/40 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{out.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-amber-300 border border-slate-700">
                            {out.code}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" /> {out.address}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleOutletStatus(out.id)}
                      title={out.isActive ? "Nonaktifkan Lokasi" : "Aktifkan Lokasi"}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        out.isActive 
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30" 
                          : "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Geofencing & Operating Hours Info */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <Compass className="w-3 h-3 text-amber-400" /> Koordinat GPS
                      </span>
                      <p className="font-mono text-slate-200 mt-0.5 truncate">
                        {out.latitude.toFixed(4)}, {out.longitude.toFixed(4)}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <Navigation className="w-3 h-3 text-blue-400" /> Radius Geofence
                      </span>
                      <p className="font-bold text-amber-400 mt-0.5">
                        {out.radiusMeters} Meter
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Jam Buka: <strong className="text-slate-200">{out.openTime} - {out.closeTime} WIB</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px]">
                      {staffCount} Staf
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      )}

      {/* TAB 2: KEBIJAKAN JAM KERJA & PRESENSI */}
      {activeTab === "work_policy" && (
        dataSource.mode === "supabase" ? (
          <LiveWorkPolicyManager />
        ) : (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-md">
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Pengaturan Kebijakan Presensi & Shift
            </h3>
            <p className="text-[11px] text-slate-400">Atur batas toleransi keterlambatan, pengingat, dan verifikasi selfie</p>
          </div>

          <div className="space-y-3 pt-1">
            {/* Setting 1: Toleransi Keterlambatan */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Toleransi Keterlambatan</h4>
                <p className="text-[10px] text-slate-400">Batas menit sebelum absensi dicatat sebagai &ldquo;Terlambat&rdquo;</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={preferences.lateTolerance}
                  onChange={(e) => updatePreferences({
                    lateTolerance: Math.min(120, Math.max(0, Number(e.target.value) || 0)),
                  })}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">Menit</span>
              </div>
            </div>

            {/* Setting 2: Wajib Selfie Photo */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Wajib Foto Selfie GPS</h4>
                <p className="text-[10px] text-slate-400">Staf harus mengambil selfie melalui kamera saat presensi masuk</p>
              </div>
              <button
                onClick={() => {
                  const nextValue = !preferences.requireSelfie;
                  updatePreferences({ requireSelfie: nextValue });
                  showToast(`Persyaratan foto selfie ${nextValue ? "diaktifkan" : "dinonaktifkan"} pada data demo.`, "info");
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  preferences.requireSelfie ? "bg-amber-500" : "bg-slate-800"
                }`}
                aria-label="Wajibkan foto selfie presensi"
                aria-pressed={preferences.requireSelfie}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                  preferences.requireSelfie ? "right-0.5" : "left-0.5"
                }`} />
              </button>
            </div>

            {/* Setting 3: Batas Minimal Lembur */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Batas Minimum Lembur</h4>
                <p className="text-[10px] text-slate-400">Durasi minimum jam lembur yang dapat diajukan per hari</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={preferences.minOvertime}
                  onChange={(e) => updatePreferences({
                    minOvertime: Math.min(24, Math.max(0.5, Number(e.target.value) || 0.5)),
                  })}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">Jam</span>
              </div>
            </div>
          </div>
        </div>
        )
      )}

      {/* TAB 3: KEBIJAKAN CUTI & HAK STAF */}
      {activeTab === "leave_policy" && (
        dataSource.mode === "supabase" ? (
          <LiveLeavePolicyManager />
        ) : (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-md">
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Aturan Hak Cuti & Pengajuan Izin
            </h3>
            <p className="text-[11px] text-slate-400">Pengaturan saldo kuota tahunan dan batas minimum pengajuan</p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Kuota Cuti Tahunan Default</h4>
                <p className="text-[10px] text-slate-400">Jumlah saldo cuti tahunan awal untuk karyawan tetap baru</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={preferences.defaultLeaveBalance}
                  onChange={(e) => updatePreferences({
                    defaultLeaveBalance: Math.min(365, Math.max(0, Number(e.target.value) || 0)),
                  })}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">Hari</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Batas Pengajuan Cuti (Notice Period)</h4>
                <p className="text-[10px] text-slate-400">Minimum hari sebelum tanggal cuti dimulai</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={preferences.advanceNoticeDays}
                  onChange={(e) => updatePreferences({
                    advanceNoticeDays: Math.min(90, Math.max(0, Number(e.target.value) || 0)),
                  })}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">Hari</span>
              </div>
            </div>
          </div>
        </div>
        )
      )}

      {/* TAB 4: KEAMANAN AKUN HRD */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-2">Keamanan Sistem HRD</h3>

            <div className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="block">Kata Sandi Admin</span>
                  <span className="text-[10px] text-slate-400">Menunggu integrasi autentikasi</span>
                </div>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                Demo
              </span>
            </div>

            <button 
              onClick={() => {
                const nextValue = !preferences.notificationsEnabled;
                updatePreferences({ notificationsEnabled: nextValue });
                showToast(
                  `Notifikasi demo ${nextValue ? "diaktifkan" : "dinonaktifkan"} secara lokal.`,
                  "info"
                );
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-800/60 border border-slate-800/80 transition-colors text-xs text-slate-300 cursor-pointer"
              aria-pressed={preferences.notificationsEnabled}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-amber-400" />
                <div className="text-left">
                  <span className="block">Notifikasi Data Demo</span>
                  <span className="text-[10px] text-slate-400">
                    {preferences.notificationsEnabled ? "Aktif di perangkat ini" : "Nonaktif di perangkat ini"}
                  </span>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                preferences.notificationsEnabled
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-slate-800 text-slate-400"
              }`}>
                {preferences.notificationsEnabled ? "Aktif" : "Nonaktif"}
              </span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-rose-500/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">Data Demo Lokal</h3>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                  Perubahan tersimpan di browser ini. Reset akan mengembalikan karyawan,
                  presensi, cuti, jadwal, dan konfigurasi ke data awal prototype.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/15"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Semua Data Demo
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah Lokasi Baru */}
      <Modal
        isOpen={showAddOutletModal}
        onClose={() => setShowAddOutletModal(false)}
        title="Tambah Lokasi Baru"
        icon={Building2}
      >
        <form onSubmit={handleAddOutletSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Nama Lokasi / Area</label>
            <input
              type="text"
              placeholder="Contoh: Area Operasional Bintaro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Kode Lokasi</label>
              <input
                type="text"
                placeholder="Contoh: BTR-05"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-amber-500 uppercase"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Radius Geofence (Meter)</label>
              <select
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={50}>50 Meter</option>
                <option value={100}>100 Meter (Default)</option>
                <option value={200}>200 Meter</option>
                <option value={500}>500 Meter</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Alamat Lengkap Lokasi</label>
            <textarea
              rows={2}
              placeholder="Masukkan alamat lengkap lokasi cabang..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Latitude GPS</label>
              <input
                type="text"
                placeholder="-6.2891"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Longitude GPS</label>
              <input
                type="text"
                placeholder="106.7214"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Jam Buka</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Jam Tutup</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddOutletModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Simpan Lokasi
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Data Demo"
        icon={RotateCcw}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs leading-relaxed text-slate-300">
            Semua perubahan lokal pada prototype akan dihapus dan data awal akan
            dimuat kembali. Tindakan ini hanya memengaruhi browser ini.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemoData();
                setShowResetModal(false);
              }}
              className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white hover:bg-rose-400"
            >
              Ya, Reset Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LiveOutletManager() {
  const outletsQuery = useLiveOutlets(true, true);
  const employeesQuery = useLiveEmployees();
  const roleQuery = useCurrentAccessRole();
  const statusMutation = useSetOutletActive();
  const { showToast } = useHR();
  const [formOutlet, setFormOutlet] = useState<LiveOutlet | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusOutlet, setStatusOutlet] = useState<LiveOutlet | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const queryError =
    outletsQuery.error ?? employeesQuery.error ?? roleQuery.error;

  if (
    outletsQuery.isPending ||
    employeesQuery.isPending ||
    roleQuery.isPending
  ) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
        Memuat outlet dan geofence Supabase…
      </div>
    );
  }

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

  const outlets = outletsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const canManage = roleQuery.data === "supervisor";
  const canViewCounts =
    roleQuery.data === "supervisor" || roleQuery.data === "management";

  const openCreate = () => {
    playClickSound();
    setFormOutlet(null);
    setShowForm(true);
  };

  const openEdit = (outlet: LiveOutlet) => {
    playClickSound();
    setFormOutlet(outlet);
    setShowForm(true);
  };

  const openStatus = (outlet: LiveOutlet) => {
    playClickSound();
    setStatusReason("");
    setStatusOutlet(outlet);
  };

  const handleStatusSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusOutlet || !statusReason.trim()) return;

    const nextStatus = !statusOutlet.is_active;

    try {
      await statusMutation.mutateAsync({
        outletId: statusOutlet.id,
        isActive: nextStatus,
        reason: statusReason.trim(),
      });
      playSuccessHaptic();
      showToast(
        `${statusOutlet.name} berhasil ${
          nextStatus ? "diaktifkan" : "dinonaktifkan"
        }.`,
        "success"
      );
      setStatusOutlet(null);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Status outlet belum dapat diubah.",
        "warning"
      );
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Daftar Lokasi & Area Operasional
            </h3>
            <p className="text-[11px] text-slate-400">
              Koordinat dan radius berikut berasal dari Supabase.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Tambah Lokasi
            </button>
          ) : (
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-400">
              Akses Baca
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {outlets.map((outlet) => {
            const staffCount = canViewCounts
              ? employees.filter((employee) =>
                  employee.placements.some(
                    (placement) =>
                      placement.end_date === null &&
                      placement.outlet?.id === outlet.id
                  )
                ).length
              : null;

            return (
              <div
                key={outlet.id}
                className={`space-y-3 rounded-2xl border bg-slate-900 p-4 transition-all ${
                  outlet.is_active
                    ? "border-slate-800 shadow-md"
                    : "border-rose-900/40 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-100">
                        <span>{outlet.name}</span>
                        <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
                          {outlet.code}
                        </span>
                      </h4>
                      <p className="mt-0.5 flex items-start gap-1 text-[10px] text-slate-400">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {outlet.address}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      outlet.is_active
                        ? "border border-amber-500/25 bg-amber-500/10 text-amber-400"
                        : "border border-rose-500/25 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {outlet.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <span className="flex items-center gap-1 font-medium text-slate-400">
                      <Compass className="h-3 w-3 text-amber-400" /> Koordinat
                    </span>
                    <p className="mt-0.5 truncate font-mono text-slate-200">
                      {outlet.latitude.toFixed(4)},{" "}
                      {outlet.longitude.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <span className="flex items-center gap-1 font-medium text-slate-400">
                      <Navigation className="h-3 w-3 text-amber-400" /> Geofence
                    </span>
                    <p className="mt-0.5 font-bold text-amber-400">
                      {outlet.geofence_radius_m} Meter
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-400">
                    {staffCount === null
                      ? "Jumlah staf dibatasi oleh hak akses"
                      : `${staffCount} penempatan aktif`}
                  </span>
                  {canManage && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(outlet)}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition-colors hover:text-amber-400"
                        aria-label={`Ubah ${outlet.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openStatus(outlet)}
                        className={`rounded-lg border p-1.5 transition-colors ${
                          outlet.is_active
                            ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                            : "border-amber-500/25 bg-amber-500/10 text-amber-400"
                        }`}
                        aria-label={`${
                          outlet.is_active ? "Nonaktifkan" : "Aktifkan"
                        } ${outlet.name}`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <LiveOutletFormModal
          key={formOutlet?.id ?? "new"}
          outlet={formOutlet}
          onClose={() => setShowForm(false)}
          onSuccess={(message) => {
            setShowForm(false);
            showToast(message, "success");
          }}
        />
      )}

      <Modal
        isOpen={statusOutlet !== null}
        onClose={() => {
          if (!statusMutation.isPending) setStatusOutlet(null);
        }}
        title={
          statusOutlet?.is_active ? "Nonaktifkan Outlet" : "Aktifkan Outlet"
        }
        icon={Power}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
            <TriangleAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <p>
              Outlet tidak dihapus. Penonaktifan ditolak jika masih memiliki
              penempatan karyawan aktif.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Alasan perubahan status
            </label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatusOutlet(null)}
              disabled={statusMutation.isPending}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={statusMutation.isPending || !statusReason.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {statusMutation.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              Konfirmasi
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function LiveOutletFormModal({
  outlet,
  onClose,
  onSuccess,
}: {
  outlet: LiveOutlet | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const createMutation = useCreateOutletMaster();
  const updateMutation = useUpdateOutletMaster();
  const [name, setName] = useState(outlet?.name ?? "");
  const [code, setCode] = useState(outlet?.code ?? "");
  const [address, setAddress] = useState(outlet?.address ?? "");
  const [latitude, setLatitude] = useState(
    outlet?.latitude.toString() ?? "-6.2891"
  );
  const [longitude, setLongitude] = useState(
    outlet?.longitude.toString() ?? "106.7214"
  );
  const [radius, setRadius] = useState(
    outlet?.geofence_radius_m.toString() ?? "100"
  );
  const [reason, setReason] = useState(
    outlet ? "Pembaruan data outlet" : "Membuat outlet baru"
  );
  const [formError, setFormError] = useState("");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    const latitudeNumber = Number(latitude);
    const longitudeNumber = Number(longitude);
    const radiusNumber = Number(radius);

    if (
      !name.trim() ||
      !code.trim() ||
      !address.trim() ||
      !reason.trim() ||
      !Number.isFinite(latitudeNumber) ||
      !Number.isFinite(longitudeNumber) ||
      !Number.isInteger(radiusNumber)
    ) {
      setFormError("Lengkapi data outlet dengan nilai koordinat yang valid.");
      return;
    }

    try {
      const input = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim(),
        latitude: latitudeNumber,
        longitude: longitudeNumber,
        geofenceRadiusM: radiusNumber,
        reason: reason.trim(),
      };

      if (outlet) {
        await updateMutation.mutateAsync({ ...input, outletId: outlet.id });
      } else {
        await createMutation.mutateAsync(input);
      }

      playSuccessHaptic();
      onSuccess(
        outlet
          ? `${name.trim()} berhasil diperbarui.`
          : `${name.trim()} berhasil ditambahkan.`
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Data outlet belum dapat disimpan."
      );
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={outlet ? "Ubah Outlet & Geofence" : "Tambah Outlet Live"}
      icon={outlet ? Pencil : Building2}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Nama outlet
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Kode outlet
            </label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base uppercase text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">
            Alamat lengkap
          </label>
          <textarea
            rows={2}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Latitude
            </label>
            <input
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Longitude
            </label>
            <input
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Radius geofence
            </label>
            <select
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            >
              {[50, 100, 200, 500].map((value) => (
                <option key={value} value={value}>
                  {value} Meter
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Alasan perubahan
            </label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
          </div>
        </div>
        <p className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[10px] text-slate-400">
          Jam operasional akan dikelola melalui template shift outlet pada
          tahap kebijakan berikutnya.
        </p>
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {outlet ? "Simpan Perubahan" : "Simpan Outlet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function policyNumber(
  configuration: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = configuration[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function LiveWorkPolicyManager() {
  const { showToast } = useHR();
  const roleQuery = useCurrentAccessRole();
  const policyQuery = useCurrentPolicies();
  const outletQuery = useLiveOutlets(true);
  const shiftQuery = useActiveShiftTemplates();
  const publishMutation = usePublishWorkPolicy();
  const shiftMutation = useReplaceOutletShiftTemplate();
  const isSupervisor = roleQuery.data === "supervisor";
  const attendancePolicy = policyQuery.data?.find(
    (policy) => policy.policy_type === "attendance"
  );
  const overtimePolicy = policyQuery.data?.find(
    (policy) => policy.policy_type === "overtime"
  );
  const attendanceConfig = jsonObject(attendancePolicy?.configuration);
  const overtimeConfig = jsonObject(overtimePolicy?.configuration);

  const policyDefaults = {
    lateTolerance: policyNumber(
      attendanceConfig,
      "late_tolerance_minutes",
      15
    ),
    requireSelfie:
      typeof attendanceConfig.clock_in_selfie_required === "boolean"
        ? attendanceConfig.clock_in_selfie_required
        : true,
    minimumOvertimeHours:
      policyNumber(overtimeConfig, "minimum_minutes", 60) / 60,
  };
  const [policyDraft, setPolicyDraft] = useState<typeof policyDefaults | null>(
    null
  );
  const activePolicyDraft = policyDraft ?? policyDefaults;
  const { lateTolerance, requireSelfie, minimumOvertimeHours } =
    activePolicyDraft;
  const updatePolicyDraft = (updates: Partial<typeof policyDefaults>) =>
    setPolicyDraft((current) => ({
      ...(current ?? policyDefaults),
      ...updates,
    }));
  const [policyReason, setPolicyReason] = useState("");
  const [selectedOutletOverride, setSelectedOutletOverride] = useState("");
  const selectedOutletId =
    selectedOutletOverride || outletQuery.data?.[0]?.id || "";
  const [shiftType, setShiftType] = useState<"morning" | "middle" | "night">(
    "morning"
  );
  const template = shiftQuery.data?.find(
    (item) =>
      item.outlet_id === selectedOutletId && item.shift_type === shiftType
  );
  const defaultShiftTimes = {
    morning: ["07:00", "15:00"],
    middle: ["12:00", "20:00"],
    night: ["15:00", "23:00"],
  } as const;
  const shiftSelectionKey = `${selectedOutletId}:${shiftType}`;
  const shiftDefaults = {
    key: shiftSelectionKey,
    startsAt:
      template?.starts_at.slice(0, 5) ?? defaultShiftTimes[shiftType][0],
    endsAt: template?.ends_at.slice(0, 5) ?? defaultShiftTimes[shiftType][1],
    shiftLateTolerance: template?.late_tolerance_min ?? lateTolerance,
    earlyCheckoutTolerance:
      template?.early_checkout_tolerance_min ??
      policyNumber(
        attendanceConfig,
        "early_checkout_tolerance_minutes",
        15
      ),
  };
  const [shiftDraft, setShiftDraft] = useState<typeof shiftDefaults | null>(
    null
  );
  const activeShiftDraft =
    shiftDraft?.key === shiftSelectionKey ? shiftDraft : shiftDefaults;
  const {
    startsAt,
    endsAt,
    shiftLateTolerance,
    earlyCheckoutTolerance,
  } = activeShiftDraft;
  const updateShiftDraft = (
    updates: Partial<Omit<typeof shiftDefaults, "key">>
  ) =>
    setShiftDraft({
      ...activeShiftDraft,
      ...updates,
      key: shiftSelectionKey,
    });
  const [shiftReason, setShiftReason] = useState("");
  const [formError, setFormError] = useState("");

  if (
    roleQuery.isLoading ||
    policyQuery.isLoading ||
    outletQuery.isLoading ||
    shiftQuery.isLoading
  ) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
        <LoaderCircle className="h-5 w-5 animate-spin text-amber-400" />
      </div>
    );
  }

  const queryError =
    roleQuery.error ?? policyQuery.error ?? outletQuery.error ?? shiftQuery.error;

  if (queryError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
      >
        {queryError.message}
      </div>
    );
  }

  const handlePolicySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!policyReason.trim()) {
      setFormError("Alasan perubahan kebijakan wajib diisi.");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        attendanceConfiguration: {
          late_tolerance_minutes: lateTolerance,
          clock_in_selfie_required: requireSelfie,
        },
        overtimeConfiguration: {
          minimum_minutes: Math.round(minimumOvertimeHours * 60),
        },
        reason: policyReason.trim(),
      });
      setPolicyReason("");
      playSuccessHaptic();
      showToast("Versi kebijakan kerja berhasil diterbitkan.", "success");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Kebijakan kerja belum dapat disimpan."
      );
    }
  };

  const handleShiftSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!selectedOutletId || !shiftReason.trim()) {
      setFormError("Pilih outlet dan isi alasan perubahan template shift.");
      return;
    }

    try {
      await shiftMutation.mutateAsync({
        outletId: selectedOutletId,
        shiftType,
        startsAt,
        endsAt,
        lateToleranceMin: shiftLateTolerance,
        earlyCheckoutToleranceMin: earlyCheckoutTolerance,
        reason: shiftReason.trim(),
      });
      setShiftReason("");
      playSuccessHaptic();
      showToast("Template shift outlet berhasil disimpan.", "success");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Template shift belum dapat disimpan."
      );
    }
  };

  return (
    <div className="space-y-4">
      {!isSupervisor && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          Kebijakan dan template shift tersedia dalam mode baca. Hanya
          supervisor yang dapat menerbitkan perubahan.
        </div>
      )}
      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {formError}
        </div>
      )}

      <form
        onSubmit={handlePolicySubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Kebijakan Presensi & Lembur
            </h3>
            <p className="text-[11px] text-slate-400">
              Nilai global; toleransi per outlet dapat dioverride pada template
              shift.
            </p>
          </div>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
            Presensi v{attendancePolicy?.version_number ?? "—"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PolicyNumberField
            label="Toleransi terlambat default"
            value={lateTolerance}
            min={0}
            max={180}
            unit="menit"
            disabled={!isSupervisor}
            onChange={(value) => updatePolicyDraft({ lateTolerance: value })}
          />
          <PolicyNumberField
            label="Minimum lembur"
            value={minimumOvertimeHours}
            min={0.5}
            max={24}
            step={0.5}
            unit="jam"
            disabled={!isSupervisor}
            onChange={(value) =>
              updatePolicyDraft({ minimumOvertimeHours: value })
            }
          />
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs font-bold text-slate-200">
              Selfie saat masuk
            </p>
            <p className="mb-3 text-[10px] text-slate-400">
              Clock-out tidak memerlukan selfie.
            </p>
            <button
              type="button"
              disabled={!isSupervisor}
              onClick={() =>
                updatePolicyDraft({ requireSelfie: !requireSelfie })
              }
              className={`h-7 w-14 rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                requireSelfie ? "bg-amber-500" : "bg-slate-700"
              }`}
              aria-label="Wajibkan selfie saat presensi masuk"
              aria-pressed={requireSelfie}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-slate-950 transition-transform ${
                  requireSelfie ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {isSupervisor && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={policyReason}
              onChange={(event) => setPolicyReason(event.target.value)}
              placeholder="Alasan penerbitan versi baru"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
            <button
              type="submit"
              disabled={publishMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {publishMutation.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              Terbitkan Versi
            </button>
          </div>
        )}
      </form>

      <form
        onSubmit={handleShiftSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md sm:p-5"
      >
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Template Shift per Outlet
          </h3>
          <p className="text-[11px] text-slate-400">
            Perubahan membuat template baru; jadwal historis tetap memakai
            template lama.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-300">
            Outlet
            <select
              value={selectedOutletId}
              onChange={(event) =>
                setSelectedOutletOverride(event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            >
              {outletQuery.data?.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-300">
            Jenis shift
            <select
              value={shiftType}
              onChange={(event) =>
                setShiftType(
                  event.target.value as "morning" | "middle" | "night"
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            >
              <option value="morning">Pagi</option>
              <option value="middle">Middle</option>
              <option value="night">Malam</option>
            </select>
          </label>
          <TimeField
            label="Jam mulai"
            value={startsAt}
            disabled={!isSupervisor}
            onChange={(value) => updateShiftDraft({ startsAt: value })}
          />
          <TimeField
            label="Jam selesai"
            value={endsAt}
            disabled={!isSupervisor}
            onChange={(value) => updateShiftDraft({ endsAt: value })}
          />
          <PolicyNumberField
            label="Toleransi terlambat"
            value={shiftLateTolerance}
            min={0}
            max={180}
            unit="menit"
            disabled={!isSupervisor}
            onChange={(value) =>
              updateShiftDraft({ shiftLateTolerance: value })
            }
          />
          <PolicyNumberField
            label="Toleransi pulang awal"
            value={earlyCheckoutTolerance}
            min={0}
            max={180}
            unit="menit"
            disabled={!isSupervisor}
            onChange={(value) =>
              updateShiftDraft({ earlyCheckoutTolerance: value })
            }
          />
        </div>
        {isSupervisor && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={shiftReason}
              onChange={(event) => setShiftReason(event.target.value)}
              placeholder="Alasan perubahan template shift"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              required
            />
            <button
              type="submit"
              disabled={shiftMutation.isPending || !selectedOutletId}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {shiftMutation.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              Simpan Template
            </button>
          </div>
        )}
      </form>
      <LiveStaffingRequirementManager />
    </div>
  );
}

const SHIFT_LABELS = {
  morning: "Pagi",
  middle: "Middle",
  night: "Malam",
} as const;
const SHIFT_ORDER = { morning: 0, middle: 1, night: 2 } as const;

function defaultStaffingMinimum(
  cashierCount: number,
  dayScope: "weekday" | "weekend"
) {
  if (cashierCount <= 1) {
    return { morning: 1, middle: 0, night: 0 } as const;
  }
  if (cashierCount === 2) {
    return { morning: 1, middle: 0, night: 1 } as const;
  }
  if (cashierCount === 3) {
    return {
      morning: 1,
      middle: dayScope === "weekday" ? 1 : 0,
      night: 1,
    } as const;
  }
  return {
    morning: Math.ceil(cashierCount / 2),
    middle: 0,
    night: Math.floor(cashierCount / 2),
  } as const;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Pengelola kebutuhan staf outlet yang menyimpan satu set versioned untuk
 * jumlah kasir tertentu. Set ini menjadi input minimum staffing generator
 * roster dan tetap mempertahankan konfigurasi periode sebelumnya.
 */
function LiveStaffingRequirementManager() {
  const { showToast } = useHR();
  const roleQuery = useCurrentAccessRole();
  const outletQuery = useLiveOutlets(true);
  const shiftQuery = useActiveShiftTemplates();
  const staffingQuery = useStaffingRequirements();
  const mutation = useReplaceOutletStaffingRequirements();
  const isSupervisor = roleQuery.data === "supervisor";
  const [selectedOutletOverride, setSelectedOutletOverride] = useState("");
  const selectedOutletId =
    selectedOutletOverride || outletQuery.data?.[0]?.id || "";
  const [cashierCount, setCashierCount] = useState(3);
  const [dayScope, setDayScope] = useState<"weekday" | "weekend">(
    "weekday"
  );
  const [effectiveFrom, setEffectiveFrom] = useState(localDateValue);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const activeTemplates = [...(shiftQuery.data ?? [])]
    .filter((template) => template.outlet_id === selectedOutletId)
    .sort(
      (left, right) =>
        SHIFT_ORDER[left.shift_type] - SHIFT_ORDER[right.shift_type]
    );
  const selectionKey = `${selectedOutletId}:${cashierCount}:${dayScope}:${effectiveFrom}`;
  const effectiveRows = (staffingQuery.data ?? []).filter(
    (requirement) =>
      requirement.outlet_id === selectedOutletId &&
      requirement.cashier_count === cashierCount &&
      requirement.day_scope === dayScope &&
      requirement.effective_from <= effectiveFrom &&
      (!requirement.effective_until ||
        requirement.effective_until >= effectiveFrom)
  );
  const recommendedMinimums = defaultStaffingMinimum(cashierCount, dayScope);
  const minimumDefaults = Object.fromEntries(
    activeTemplates.map((template) => [
      template.shift_type,
      effectiveRows.find(
        (requirement) => requirement.shift_template_id === template.id
      )?.minimum_staff ?? recommendedMinimums[template.shift_type],
    ])
  ) as Partial<Record<keyof typeof SHIFT_LABELS, number>>;
  const [staffingDraft, setStaffingDraft] = useState<{
    key: string;
    values: Partial<Record<keyof typeof SHIFT_LABELS, number>>;
  } | null>(null);
  const minimums =
    staffingDraft?.key === selectionKey
      ? staffingDraft.values
      : minimumDefaults;
  const totalMinimum = activeTemplates.reduce(
    (total, template) => total + (minimums[template.shift_type] ?? 1),
    0
  );
  const activeShiftTypes = new Set(
    activeTemplates.map((template) => template.shift_type)
  );
  const configuredTemplateCount = activeTemplates.filter((template) =>
    effectiveRows.some(
      (requirement) => requirement.shift_template_id === template.id
    )
  ).length;
  const hasEffectiveConfiguration =
    activeTemplates.length > 0 &&
    configuredTemplateCount === activeTemplates.length;
  const hasCompleteShiftSet = (
    ["morning", "middle", "night"] as const
  ).every((shiftType) => activeShiftTypes.has(shiftType));

  const updateMinimum = (
    shiftType: keyof typeof SHIFT_LABELS,
    value: number
  ) => {
    setStaffingDraft({
      key: selectionKey,
      values: { ...minimums, [shiftType]: value },
    });
  };

  if (
    roleQuery.isLoading ||
    outletQuery.isLoading ||
    shiftQuery.isLoading ||
    staffingQuery.isLoading
  ) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
        <LoaderCircle className="h-5 w-5 animate-spin text-amber-400" />
      </div>
    );
  }

  const queryError =
    roleQuery.error ??
    outletQuery.error ??
    shiftQuery.error ??
    staffingQuery.error;

  if (queryError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
      >
        {queryError.message}
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!selectedOutletId || !reason.trim()) {
      setFormError("Pilih outlet dan isi alasan perubahan kebutuhan staf.");
      return;
    }

    if (!hasCompleteShiftSet) {
      setFormError(
        "Lengkapi template Pagi, Middle, dan Malam sebelum mengatur kebutuhan staf."
      );
      return;
    }

    if (effectiveFrom < localDateValue()) {
      setFormError("Tanggal efektif tidak boleh sebelum hari ini.");
      return;
    }

    if (totalMinimum > cashierCount) {
      setFormError(
        `Total minimum ${totalMinimum} orang melebihi ${cashierCount} kasir tersedia.`
      );
      return;
    }

    if (totalMinimum < 1) {
      setFormError("Sedikitnya satu shift harus memiliki minimum staf.");
      return;
    }

    try {
      await mutation.mutateAsync({
        outletId: selectedOutletId,
        cashierCount,
        dayScope,
        effectiveFrom,
        requirements: activeTemplates.map((template) => ({
          shiftType: template.shift_type,
          minimumStaff:
            minimums[template.shift_type] ??
            recommendedMinimums[template.shift_type],
        })),
        reason: reason.trim(),
      });
      setReason("");
      setStaffingDraft(null);
      playSuccessHaptic();
      showToast("Kebutuhan staf outlet berhasil disimpan.", "success");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Kebutuhan staf outlet belum dapat disimpan."
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Kebutuhan Staf Outlet
          </h3>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Jumlah kasir dihitung setelah off, cuti, dan backup. Override dapat
            dibedakan untuk weekday dan weekend.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
          {hasEffectiveConfiguration ? "Override aktif" : "Default sistem"}
        </span>
      </div>

      {!isSupervisor && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          Kebutuhan staf tersedia dalam mode baca. Hanya supervisor yang dapat
          menyimpan versi baru.
        </div>
      )}

      {!hasCompleteShiftSet && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
          Buat template Pagi, Middle, dan Malam untuk outlet ini terlebih
          dahulu.
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {formError}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
        Default: 2 kasir memakai Pagi dan Malam; 3 kasir memakai Middle hanya
        Senin–Jumat; 4 kasir dibagi ke Pagi dan Malam. Simpan override hanya
        bila kebutuhan outlet berbeda.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-300">
          Outlet
          <select
            value={selectedOutletId}
            onChange={(event) =>
              setSelectedOutletOverride(event.target.value)
            }
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
          >
            {outletQuery.data?.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </label>
        <PolicyNumberField
          label="Skenario jumlah kasir"
          value={cashierCount}
          min={1}
          max={100}
          unit="orang"
          disabled={!isSupervisor}
          onChange={setCashierCount}
        />
        <label className="text-xs font-medium text-slate-300">
          Jenis hari
          <select
            value={dayScope}
            disabled={!isSupervisor}
            onChange={(event) =>
              setDayScope(event.target.value as "weekday" | "weekend")
            }
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 disabled:opacity-60 sm:text-xs"
          >
            <option value="weekday">Weekday (Senin–Jumat)</option>
            <option value="weekend">Weekend (Sabtu–Minggu)</option>
          </select>
        </label>
        <DatePicker
          label="Berlaku mulai"
          value={effectiveFrom}
          onChange={setEffectiveFrom}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {activeTemplates.map((template) => (
          <PolicyNumberField
            key={template.id}
            label={`Minimum shift ${SHIFT_LABELS[template.shift_type]}`}
            value={
              minimums[template.shift_type] ??
              recommendedMinimums[template.shift_type]
            }
            min={0}
            max={cashierCount}
            unit="orang"
            disabled={!isSupervisor}
            onChange={(value) => updateMinimum(template.shift_type, value)}
          />
        ))}
      </div>

      <div
        className={`rounded-xl border p-3 text-xs ${
          totalMinimum <= cashierCount
            ? "border-slate-800 bg-slate-950 text-slate-300"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
        }`}
      >
        Total minimum harian: <strong>{totalMinimum} orang</strong> dari {" "}
        <strong>{cashierCount} kasir</strong>. Sisa kasir dapat dipakai untuk
        pemerataan atau backup.
      </div>

      {isSupervisor && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Alasan konfigurasi kebutuhan staf"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
          <button
            type="submit"
            disabled={
              mutation.isPending ||
              !selectedOutletId ||
              !hasCompleteShiftSet ||
              totalMinimum > cashierCount
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {mutation.isPending && (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            )}
            Simpan Override
          </button>
        </div>
      )}
    </form>
  );
}

function LiveLeavePolicyManager() {
  const { showToast } = useHR();
  const roleQuery = useCurrentAccessRole();
  const policyQuery = useCurrentPolicies();
  const publishMutation = usePublishPolicyVersion();
  const leavePolicy = policyQuery.data?.find(
    (policy) => policy.policy_type === "leave"
  );
  const configuration = jsonObject(leavePolicy?.configuration);
  const leaveDefaults = {
    annualEntitlement: policyNumber(
      configuration,
      "annual_entitlement_days",
      12
    ),
    annualNotice: policyNumber(configuration, "annual_notice_days", 3),
  };
  const [leaveDraft, setLeaveDraft] = useState<typeof leaveDefaults | null>(
    null
  );
  const { annualEntitlement, annualNotice } = leaveDraft ?? leaveDefaults;
  const updateLeaveDraft = (updates: Partial<typeof leaveDefaults>) =>
    setLeaveDraft((current) => ({
      ...(current ?? leaveDefaults),
      ...updates,
    }));
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const isSupervisor = roleQuery.data === "supervisor";

  if (roleQuery.isLoading || policyQuery.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
        <LoaderCircle className="h-5 w-5 animate-spin text-amber-400" />
      </div>
    );
  }

  const queryError = roleQuery.error ?? policyQuery.error;
  if (queryError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
      >
        {queryError.message}
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!reason.trim()) {
      setFormError("Alasan perubahan kebijakan wajib diisi.");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        policyType: "leave",
        configuration: {
          annual_entitlement_days: annualEntitlement,
          annual_notice_days: annualNotice,
        },
        reason: reason.trim(),
      });
      setReason("");
      playSuccessHaptic();
      showToast("Versi kebijakan cuti berhasil diterbitkan.", "success");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Kebijakan cuti belum dapat disimpan."
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Aturan Hak Cuti
          </h3>
          <p className="text-[11px] text-slate-400">
            Setiap perubahan diterbitkan sebagai versi baru untuk audit.
          </p>
        </div>
        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
          Versi {leavePolicy?.version_number ?? "—"}
        </span>
      </div>
      {!isSupervisor && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          Kebijakan tersedia dalam mode baca. Hanya supervisor yang dapat
          menerbitkan perubahan.
        </div>
      )}
      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          {formError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PolicyNumberField
          label="Hak cuti tahunan"
          value={annualEntitlement}
          min={0}
          max={365}
          unit="hari"
          disabled={!isSupervisor}
          onChange={(value) =>
            updateLeaveDraft({ annualEntitlement: value })
          }
        />
        <PolicyNumberField
          label="Pengajuan minimum sebelum cuti"
          value={annualNotice}
          min={0}
          max={90}
          unit="hari"
          disabled={!isSupervisor}
          onChange={(value) => updateLeaveDraft({ annualNotice: value })}
        />
      </div>
      <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-400">
        Cuti tahunan tidak dibawa ke tahun berikutnya. Sakit dan keadaan
        darurat tetap dapat diajukan pada hari yang sama sesuai jenis cuti.
      </p>
      {isSupervisor && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Alasan penerbitan versi baru"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
            required
          />
          <button
            type="submit"
            disabled={publishMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {publishMutation.isPending && (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            )}
            Terbitkan Versi
          </button>
        </div>
      )}
    </form>
  );
}

function PolicyNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-bold text-slate-200">
      {label}
      <span className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              Math.min(
                max,
                Math.max(min, Number(event.target.value) || min)
              )
            )
          }
          className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-center text-base font-bold text-amber-400 outline-none focus:border-amber-500 disabled:opacity-60 sm:text-xs"
        />
        <span className="font-normal text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-slate-300">
      {label}
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 disabled:opacity-60 sm:text-xs"
        required
      />
    </label>
  );
}
