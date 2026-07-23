# 📄 Product Requirements Document (PRD)
## HR Rajaklana — Mobile-First Workforce Operations Management System

**Versi**: 1.0.0  
**Tanggal**: 23 Juli 2026  
**Status**: Approved / Ready for Production & Backend Integration  
**Tim Pengembang**: AI Engineering & HRD Operations Team  

---

## 🎯 1. Ringkasan Produk (Executive Summary)

### 1.1 Visi Produk
**HR Rajaklana** adalah aplikasi sistem manajemen sumber daya manusia (*Workforce Operations & HRD System*) berbasis web seluler (*Mobile-First PWA*) yang dirancang khusus untuk mempermudah pengelolaan jadwal kerja shift, absensi lokasi GPS geofencing, pengajuan cuti dan lembur, serta data staf kasir dan operasional di berbagai cabang/outlet operasional.

### 1.2 Prinsip Utama Sistem (Domain Scope)
1. **General Operations HRD**: Aplikasi berfokus pada operasional kerja perusahaan umum (outlet, cabang, area operasional, staf kasir, tim lapangan, supervisor, dan manajer).
2. **Eksklusi Fitur Penggajian (Non-Payroll)**: Aplikasi **TIDAK MENGELOLA** slip gaji, komponen remunerasi, atau payroll. Fokus murni pada keandalan operasional, presensi, jadwal shift, dan izin kerja.
3. **Mobile-First UX Industri**: Dirancang dan dioptimalkan untuk layar smartphone (`< 640px`) terlebih dahulu dengan standar UX aplikasi native (safe-area insets, floating bottom nav, modal auto-scroll keyboard, dan feedback haptic/suara).

---

## 🛠️ 2. Arsitektur & Technology Stack

| Komponen | Teknologi yang Digunakan | Penjelasan & Rationale |
| :--- | :--- | :--- |
| **Core Framework** | **Next.js 16 (App Router)** | Framework React modern dengan Turbopack & SSR/Static Generation cepat. |
| **UI Library** | **React 19 + TypeScript** | Type-safe code untuk integritas data karyawan & struktur absensi. |
| **Styling Engine** | **Tailwind CSS v4** | Mobile-first CSS utility untuk konsistensi token warna & responsivitas. |
| **Animation Engine** | **Framer Motion** | Animasi mikro halus pada bottom nav, modal pop-up, dan toast notification. |
| **Analytics & Data Vis** | **Recharts** | Visualisasi grafik batang & tren kehadiran per departemen/outlet. |
| **State Management** | **React Context API (`HRContext`)** | State global terpusat untuk data karyawan, outlet, presensi, cuti, & shift. |
| **Sound & Haptic** | **Web Audio API (`clickSound.ts`)** | Umpan balik suara klik & getaran haptic (`navigator.vibrate`) pada aksi UI. |

---

## 🎨 3. Design System & Token Warna

* **Background Utama**: `bg-slate-950` (`#020617`)
* **Kontainer & Kartu**: `bg-slate-900` (`#0f172a`)
* **Border & Pembatas**: `border-slate-800` (`#1e293b`)
* **Aksen Utama**: **Kuning Amber** (`bg-amber-500`, `text-amber-400`, `border-amber-500/30`)
* **Aksen Status Shift**:
  - **Shift Pagi**: Biru (`bg-blue-500/20 text-blue-400 border-blue-500/30`)
  - **Shift Siang**: Kuning Amber (`bg-amber-500/20 text-amber-400 border-amber-500/30`)
  - **Shift Malam**: Oranye (`bg-orange-500/20 text-orange-400 border-orange-500/30`)
  - **Off / Libur**: Merah Rose (`bg-rose-500/20 text-rose-400 border-rose-500/30`)

---

## 🚀 4. Spesifikasi Fitur Utama & Alur Pengguna (Feature Specs)

### 4.1 Dashboard Utama (`/`)
* **Header Translusen & Notifikasi**: Menampilkan nama akun login, tanggal live, dan tombol Bell Notifikasi HR.
* **Metric Stat Cards**: Ringkasan total staf, tingkat kehadiran hari ini, staf aktif shift, dan pengajuan pending.
* **Action Center (Quick FAB)**: Tombol pemicu absensi instan (*Check-In GPS*).
* **Pengumuman Internal**: Banner pengumuman penting yang disematkan (*pinned announcements*).

### 4.2 Presensi & Kehadiran GPS (`/attendance`)
* **Geofencing Lokasi GPS**: Mengukur jarak koordinat GPS smartphone pengguna secara real-time terhadap koordinat outlet aktif (radius toleransi 100m).
* **Kamera Selfie Portrait**: Fitur pratinjau kamera selfie rasio 3:4 tegak dengan transformasi cermin (`scaleX(-1)`) dan pengambil foto instan.
* **Log Kehadiran**: Tabel dan kartu riwayat absensi (waktu masuk, waktu keluar, status tepat waktu/terlambat, dan catatan).

### 4.3 Matriks Jadwal Kerja & Shift (`/schedule`)
* **Dual-Axis 2D Sticky Table**:
  - Header tanggal (`<thead>`) terkunci di atas (`sticky top-0 z-30`).
  - Kolom nama staf (`<td>`) terkunci di kiri (`sticky left-0 z-20`).
  - Sel sudut kiri atas (`Staf & Dept`) terkunci di `(0,0)` (`sticky top-0 left-0 z-40`).
* **Pengelompokan Outlet/Departemen**: Staf kasir dikelompokkan secara visual di bawah header outlet-nya masing-masing (`Outlet Jombang`, `Outlet Ciputat`, `Outlet Pahlawan`, `Outlet Pajajaran`).
* **Kepadatan Tinggi Mobile (Ultra-Compact)**: Lebar kolom nama `110px` dan kolom tanggal `46px` sehingga 4-5 hari muat dalam 1 layar smartphone tanpa perlu menggeser.
* **Modal Edit Shift**: Modal pengubah shift dengan pemilih waktu ganda (*Snap TimePicker Dual-Wheel*).

### 4.4 Pengajuan Cuti & Izin (`/leaves`)
* **Form Pengajuan**: Pilihan jenis cuti (Tahunan, Sakit, Izin Penting), tanggal mulai & selesai dengan kalkulasi otomatis jumlah hari.
* **Persetujuan HRD**: Tombol setujui (*Approve*) atau tolak (*Reject*) dengan umpan balik toast instan.

### 4.5 Pengajuan Lembur & Overtime (`/overtime`)
* **Form Lembur**: Pengisian tanggal, jam mulai, jam selesai, durasi jam, dan alasan lembur.
* **Status Tracking**: Label status *Pending*, *Approved*, dan *Rejected*.

### 4.6 Data Karyawan & Staf (`/employees`)
* **Direktori Staf**: Filter pencarian nama/NIK dan tab penyaringan per outlet/cabang.
* **Modal Tambah Staf Baru**: Pengisian nama, NIK, peran/jabatan, outlet, status kerja (Tetap/Kontrak), dan shift default.

### 4.7 Laporan & Analytics HR (`/reports`)
* **Grafik Tingkat Kehadiran**: Chart batang Recharts untuk kepatuhan presensi per outlet.
* **Fitur Ekspor**: Simulator unduh laporan PDF/Excel.

### 4.8 Pengaturan Sistem & Outlet Geofencing (`/settings`)
* **Tab 1: Manajemen Outlet & GPS**: Tambah outlet baru, atur alamat, koordinat Latitude/Longitude GPS, radius geofence (50m-500m), jam operasional, dan sakelar status aktif.
* **Tab 2: Kebijakan Jam Kerja**: Batas toleransi keterlambatan (menit), wajib selfie GPS, dan batas minimum lembur.
* **Tab 3: Kebijakan Cuti**: Saldo cuti tahunan default (12 hari) & *notice period* pengajuan (H-3).
* **Tab 4: Keamanan Akun**: Form ubah password admin & preferensi notifikasi.

### 4.9 Profil Akun Saya (`/profile`)
* Profil pribadi pengguna (Admin HRD), statistik kinerja pribadi, biodata kontak, dan riwayat absensi pribadi.

---

## 📱 5. Aturan Desain UI/UX & Standar Mobile Native

1. **iOS & Android Safe-Area Insets**: Header menyertakan `pt-[env(safe-area-inset-top)]` dan BottomNav menyertakan `pb-[max(1rem,env(safe-area-inset-bottom))]`.
2. **Glassmorphism Frosted Header**: Header menggunakan `bg-slate-900/85 backdrop-blur-xl` untuk efek tembus pandang mewah saat di-scroll.
3. **Smart Virtual Keyboard Auto-Scroll**: Modal mendeteksi `window.visualViewport` API agar elemen input tidak pernah tertutupi keyboard smartphone.
4. **Desain Bebas Scrollbar**: Scrollbar visual disembunyikan secara global di `globals.css` (`::-webkit-scrollbar { display: none; }`).

---

## 🔮 6. Roadmap Integrasi Backend & Database (Future Plan)

Ketika terhubung ke database sungguhan (Supabase / PostgreSQL), sistem wajib menerapkan:
1. **Optimistic UI Updates**: Perubahan UI terjadi seketika (0ms) di client, sementara mutasi API dikirim di latar belakang.
2. **Caching & Revalidation**: Penggunaan `@tanstack/react-query` untuk caching data karyawan, outlet, dan jadwal shift.
3. **Desain Skema Database**:
   - `outlets` (id, name, code, address, latitude, longitude, radius_meters, open_time, close_time, is_active)
   - `employees` (id, nik, name, role, outlet_id, status, shift, phone, email, join_date, leave_balance)
   - `attendances` (id, employee_id, date, time_in, time_out, status, location, selfie_url, notes)
   - `schedules` (id, employee_id, date, shift_name, time_slot)
   - `leave_requests` (id, employee_id, type, start_date, end_date, total_days, reason, status)
   - `overtime_requests` (id, employee_id, date, start_time, end_time, duration_hours, reason, status)

---

**Disetujui oleh**: Tim HRD & Development Rajaklana  
**Catatan**: Dokumentasi ini wajib diperbarui jika terdapat perubahan fitur atau arsitektur di masa mendatang.
