# 📱 HR Rajaklana — Mobile-First Workforce Operations Platform

![Next.js 16](https://img.shields.io/badge/Next.js-16_App_Router-000000?style=for-the-badge&logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwindcss)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=for-the-badge&logo=framer)

Sistem Informasi HRD & Operasional Karyawan modern yang dirancang dengan pendekatan **Mobile-First UX**. Aplikasi ini mengedepankan performa tinggi, animasi *smooth*, serta aksesibilitas tinggi untuk penggunaan harian staf dan manajemen di lapangan maupun di kantor (*Rajaklana HQ*).

---

## Status Pengembangan

Fondasi Supabase PostgreSQL, Auth SSR, private Storage, RLS, migration, dan
pengujian database sudah tersedia. Antarmuka saat ini masih berjalan sebagai
prototype menggunakan `HRContext` dan `localStorage`; login dan data multi-user
nyata belum diaktifkan.

Dokumen pengembangan:

- [Product Requirements](PRD.md)
- [Entity Relationship Diagram](ERD.md)
- [Implementation Roadmap & Agent Handoff](IMPLEMENTATION_ROADMAP.md)
- [Panduan Supabase](supabase/README.md)
- [Aturan Agent](AGENTS.md)

Milestone aktif berikutnya adalah autentikasi, proteksi route, dan bootstrap
supervisor pertama. Detail acceptance criteria dan quality gate berada pada
`IMPLEMENTATION_ROADMAP.md`.

---

## ✨ Fitur-Fitur Utama

- 📱 **Mobile-First Bottom Navigation**: 5 menu ergonomis yang ramah jempol (*Thumb-Driven UX*) dengan *Center Floating Action Button (FAB)* presensi dan *More Menu Bottom Sheet*.
- ⏱️ **Presensi Geotagging & GPS**: Check-in dan Check-out instan dilengkapi simulasi pengujian radius lokasi (<= 50 Meter).
- 👥 **Direktori Data Karyawan**: Manajemen staf lengkap dengan NIK, status kerja (Tetap/Kontrak/Magang), departemen, serta integrasi Numpad WhatsApp.
- 📅 **Pengajuan Cuti & Izin**: Sistem *Date Range Picker* kustom dengan kalkulasi jumlah hari otomatis yang bebas dari bug zona waktu.
- ⏰ **Lembur & Overtime**: Formulir permohonan lembur instan dengan penghitungan estimasi durasi jam otomatis dan persetujuan HRD.
- 🔄 **Jadwal & Tukar Shift**: Manajemen jadwal shift staf operasional dan fitur pengajuan tukar shift antar-rekan kerja.
- 📣 **Papan Pengumuman HRD**: Publikasi pengumuman penting (Operasional, K3, Kebijakan HR) lengkap dengan fitur penyematan (*Pin*).
- 📊 **Laporan & Analytics**: Grafik visualisasi komposisi departemen dan tren kehadiran karyawan menggunakan Recharts.
- 🔊 **Haptic & Sound Feedback**: Mikro-interaksi audio dan getaran (*vibration*) saat tombol ditekan untuk memberikan pengalaman layaknya aplikasi *Native Mobile*.

---

## 🎨 Design System & Palette Warna

Aksen visual menggunakan tema **Dark Mode Premium** dengan skema warna yang elegan:

- **Background Utama**: Slate 950 (`bg-slate-950`)
- **Kartu & Container**: Slate 900 (`bg-slate-900`)
- **Border & Pembatas**: Slate 800 (`border-slate-800`)
- **Aksen Utama / Highlight**: Amber 400 & Amber 500 (`text-amber-400`, `bg-amber-500`)
- **Teks**: Utama (`text-slate-100`), Sekunder (`text-slate-400`), Muted (`text-slate-500`)

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI & Logic**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend Foundation**: [Supabase](https://supabase.com/) PostgreSQL, Auth SSR, private Storage, dan RLS
- **Animasi & Transisi**: [Framer Motion](https://www.framer.com/motion/)
- **Ikon**: [Lucide React](https://lucide.dev/)
- **Visualisasi Data**: [Recharts](https://recharts.org/)
- **Portal & Accessibility**: React Portal + ARIA Modal Standards

---

## 🚀 Panduan Memulai (Getting Started)

### Prasyarat
Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (versi 18.x atau yang lebih baru).

### 1. Kloning Repository
```bash
git clone https://github.com/yoga12-rgb/hr-rajaklana.git
cd hr-rajaklana
```

### 2. Instalasi Dependencies
```bash
npm install
```

### 3. Menjalankan Server Pengembang (Development)
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) pada browser Anda (gunakan mode responsif mobile di Developer Tools untuk pengalaman terbaik).

### 4. Build untuk Produksi (Production Build)
```bash
npm run build
npm run start
```

---

## 📁 Struktur Direktori Utama

```text
hr-rajaklana/
├── src/
│   ├── app/                  # Route Pages (App Router Next.js 16)
│   │   ├── attendance/       # Halaman Presensi & Kehadiran
│   │   ├── employees/        # Halaman Direktori Data Karyawan
│   │   ├── leaves/           # Halaman Pengajuan Cuti & Izin
│   │   ├── overtime/         # Halaman Pengajuan Lembur
│   │   ├── profile/          # Halaman Profil Akun
│   │   ├── reports/          # Halaman Laporan & Grafik Analytics
│   │   ├── schedule/         # Halaman Jadwal & Tukar Shift
│   │   ├── layout.tsx        # App Shell Layout (Header, Sidebar, BottomNav)
│   │   └── page.tsx          # Mobile HR Dashboard Utama
│   ├── components/
│   │   ├── BottomNav.tsx     # Navigation Bar Mobile (Thumb-Driven UX)
│   │   ├── Header.tsx        # Top Header Mobile & Desktop Search
│   │   ├── Sidebar.tsx       # Desktop Navigation Sidebar
│   │   └── ui/               # Reusable UI Components
│   │       ├── Combobox.tsx        # Dropdown Searchable dengan Auto-Flip
│   │       ├── DatePicker.tsx      # Pemilih Tanggal dengan Quick Month/Year Select
│   │       ├── DateRangePicker.tsx # Pemilih Rentang Tanggal Cuti
│   │       ├── Modal.tsx           # Universal Modal & Drag-to-Dismiss Bottom Sheet
│   │       ├── StatCard.tsx        # Kartu Ringkasan Metric Statistik
│   │       ├── TimePicker.tsx      # Pemilih Waktu dengan Preset Shift & Auto-Flip
│   │       └── Toast.tsx           # Animated Notification Toast
│   ├── context/
│   │   └── HRContext.tsx     # Mock Database & Global State Provider
│   └── utils/
│       └── clickSound.ts     # Sound Audio Feedback & Haptic Utility
├── AGENTS.md                 # Panduan Arsitektur & Aturan AI Agent
└── README.md                 # Dokumentasi Resmi Proyek
```

---

## 📱 Optimasi UI/UX Khusus Mobile

1. **Proteksi Auto-Zoom iOS**: Seluruh input dan textarea menggunakan ukuran font `text-base` di layar sentuh untuk mencegah browser iOS melakukan *zoom-in* secara paksa saat mengetik.
2. **Keyboard Numpad Angka Murni**: Kolom input nomor telepon menggunakan `inputMode="numeric"` dan `pattern="[0-9]*"` agar langsung memanggil Numpad angka murni di smartphone.
3. **Smart Alignment Popover (Auto-Flip)**: Dropdown dan TimePicker secara otomatis mendeteksi sisa ruang layar bawah. Jika berada di ujung bawah modal, posisi popup akan meluncur ke atas (*Auto-Flip*) sehingga tidak pernah terpotong.
4. **Drag-to-Dismiss Bottom Sheet**: Modal mobile dapat ditutup dengan cara ditarik (di-swipe) ke bawah secara alami menggunakan gestures Framer Motion.

---

## 📄 Lisensi & Hak Cipta

© 2026 **Rajaklana Group**. Seluruh hak cipta dilindungi undang-undang.
