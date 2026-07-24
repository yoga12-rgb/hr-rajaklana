"use client";

import { useState } from "react";
import { useHR } from "@/context/HRContext";
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
  RotateCcw
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export default function SettingsPage() {
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
            <Database className="w-3 h-3" /> Data Demo Lokal
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
            {outlets.length}
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

      {/* TAB 1: MANAJEMEN LOKASI & GEOFENCING GPS */}
      {activeTab === "outlets" && (
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
      )}

      {/* TAB 2: KEBIJAKAN JAM KERJA & PRESENSI */}
      {activeTab === "work_policy" && (
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
                <p className="text-[10px] text-slate-400">Staf harus memotret foto selfie saat melakukan Masuk/Keluar</p>
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
      )}

      {/* TAB 3: KEBIJAKAN CUTI & HAK STAF */}
      {activeTab === "leave_policy" && (
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
