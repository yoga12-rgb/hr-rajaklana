<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Guide & Repository Architecture Documentation

Dokumen ini berisi informasi arsitektur, konvensi desain, dan petunjuk penting untuk AI Agent yang membantu pengembangan aplikasi **HR Rajaklana (`hr-app`)**.

---

## 🚀 Arsitektur & Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (Mobile-first, Premium Dark Mode UI)
- **State Management**: React Context API (`HRProvider` & `useHR()` di `@/context/HRContext.tsx`) dengan persistensi versi di `localStorage` untuk data prototype
- **Backend Foundation**: Supabase PostgreSQL, Auth SSR, private Storage, RLS, dan migration versioned di `supabase/`
- **Animation**: Framer Motion (`framer-motion`) untuk transisi halaman & modal pop-up
- **Analytics & Data Vis**: Recharts (`recharts`) untuk grafik batang & tren line
- **Codebase Indexing**: CodeGraph (direktori `.codegraph/` di root proyek) untuk navigasi simbol & call graph cepat
- **Quality Gate**: ESLint, TypeScript, production build, Playwright E2E, dan axe accessibility dijalankan lewat GitHub Actions

---

## 🎨 Design System & Token Warna

> [!IMPORTANT]
> Aksen utama aplikasi ini adalah **Warna Kuning (Amber)** (`amber-500`, `amber-400`). **JANGAN** menggunakan warna hijau/emerald untuk aksen utama.

- **Background Utama**: `bg-slate-950`
- **Container / Card Background**: `bg-slate-900`
- **Border**: `border-slate-800` / `border-slate-700`
- **Aksen Utama**: `text-amber-400`, `bg-amber-500`, `border-amber-500/30`
- **Teks**: Utama (`text-slate-100`), Sekunder (`text-slate-400`), Muted (`text-slate-500`)

---

## 📁 Struktur Direktori Komponen

```text
src/
├── app/                  # Next.js App Router Pages
│   ├── template.tsx      # Global Page Transition wrapper (Framer Motion)
│   ├── layout.tsx        # App layout with Header, Sidebar & BottomNav
│   ├── page.tsx          # Mobile HR Dashboard (Home)
│   ├── attendance/       # Presensi & Kehadiran Page
│   ├── employees/        # Data Karyawan Page
│   ├── leaves/           # Pengajuan Cuti & Izin Page
│   ├── overtime/         # Pengajuan Lembur & Overtime Page
│   ├── reports/          # Laporan & Analytics HR Page
│   └── schedule/         # Jadwal Shift Staf Page
├── components/
│   ├── Header.tsx        # Header navigasi desktop/mobile dengan Pusat Notifikasi HR (Bell Icon)
│   ├── Sidebar.tsx       # Sidebar navigasi desktop
│   ├── BottomNav.tsx     # Mobile Bottom Navigation (5 Menu Ergonomis + Center FAB Presensi + More Menu Bottom Sheet ⋯)
│   └── ui/               # REUSABLE UI COMPONENTS (WAJIB DIPAKAI)
│       ├── Modal.tsx             # Universal responsive Modal / Mobile Bottom Sheet (Portal, Esc Key, Swipe-to-Dismiss, A11y)
│       ├── StatCard.tsx          # Universal metric/statistics card
│       ├── DepartmentChart.tsx   # Recharts Bar Chart untuk departemen
│       ├── Toast.tsx             # Animated Toast Notification
│       ├── Skeleton.tsx          # Shimmering loading placeholder
│       ├── SwipeableCard.tsx     # Swipe-to-Action Card (Approve/Reject gestures + Haptic)
│       ├── Combobox.tsx          # Universal Searchable Dropdown Select
│       ├── DatePicker.tsx        # Universal Custom Single Date Picker
│       ├── DateRangePicker.tsx   # Universal Custom Date Range Picker
│       └── TimePicker.tsx        # Universal Custom Dual-Wheel Scroll Picker (Jam 00-23 & Menit 00-59 with Snap & Shift Presets)
├── context/
│   └── HRContext.tsx     # Mock database & State Provider utama (Employees, Attendance, Leaves, Schedules, Announcements, Toast)
├── lib/supabase/
│   ├── client.ts         # Supabase client untuk Client Components
│   ├── server.ts         # Supabase client berbasis cookies untuk server
│   └── proxy.ts          # Refresh sesi Supabase melalui Next.js Proxy
├── proxy.ts              # Entry point Next.js 16 Proxy; tetap pasif tanpa env Supabase
├── types/
│   └── database.ts       # Tipe database; regenerasi melalui npm run supabase:types
└── utils/
    └── clickSound.ts     # Audio feedback + Haptic Feedback (navigator.vibrate) utility
```

---

## 🗄️ Fondasi Supabase

- Migration, konfigurasi local stack, RLS, dan private bucket disimpan di `supabase/` serta wajib masuk version control.
- Salin `.env.example` menjadi `.env.local`; jangan pernah commit publishable key produksi, secret key, service role key, atau password database.
- Gunakan `createClient()` dari `@/lib/supabase/client` hanya pada Client Components dan dari `@/lib/supabase/server` pada Server Components, Server Actions, atau Route Handlers.
- Jangan memakai `getSession()` sebagai dasar otorisasi server. Gunakan claims terverifikasi dan tetap jadikan RLS sebagai garis pertahanan utama.
- `src/proxy.ts` hanya menyegarkan cookie sesi. Otorisasi tetap diperiksa dekat sumber data melalui RLS/DAL.
- Selama migrasi bertahap, `HRContext` tetap menjadi sumber data prototype. Jangan menampilkan mutasi Supabase sebagai berhasil bila environment belum terkonfigurasi.
- Setelah schema berubah, jalankan `npm run supabase:reset`, `npm run supabase:lint`, `npm run supabase:test`, dan `npm run supabase:types`.

---

## 🧪 Data Demo & Pengujian Prototype

- Seluruh mutasi prototype disimpan pada `localStorage` melalui `HRContext` dengan key versi `hr-rajaklana-demo-v1`.
- Pengguna harus selalu melihat penanda **Data Demo** dan dapat mengembalikan kondisi awal melalui **Pengaturan → Keamanan & Akses → Reset Semua Data Demo**.
- Aksi yang membutuhkan backend atau autentikasi tidak boleh menampilkan keberhasilan palsu; tampilkan sebagai belum tersedia atau simpan secara jujur sebagai simulasi lokal.
- Pengujian E2E berada di `e2e/`, konfigurasi runner di `playwright.config.ts`, dan quality gate CI di `.github/workflows/quality.yml`.
- Setiap perubahan alur inti wajib menjaga `npm run lint`, `npm run typecheck`, `npm run build`, dan `npm run test:e2e` tetap lulus.

---

## 🛠️ Aturan Komponen Reusable (Guidelines for AI Agents)

1. **Pop-up / Modal Dialog**: 
   * **WAJIB** menggunakan komponen `Modal` dari `@/components/ui/Modal`.
   * Contoh: `<Modal isOpen={isOpen} onClose={handleClose} title="Title" icon={LucideIcon}>...content...</Modal>`

2. **Ringkasan Kartu Statistik (Metrics)**:
   * **WAJIB** menggunakan komponen `StatCard` dari `@/components/ui/StatCard`.
   * Contoh: `<StatCard title="Total" value="10" icon={Users} />`

3. **Grafik Analytics**:
   * Gunakan atau tambahkan komponen terpisah di `src/components/ui/` jika membuat jenis grafik baru.

4. **State Data**:
   * Selalu gunakan `useHR()` dari `@/context/HRContext` untuk membaca atau memanipulasi data karyawan, absensi, atau cuti.

5. **Pengecualian Fitur (Fitur yang Dilarang)**:
   * **DILARANG EKSPLISIT** menyarankan, membuat, atau menambahkan fitur **Slip Gaji / Payroll / Ringkasan Gaji** dalam bentuk apa pun. Pengguna telah mengonfirmasi bahwa aplikasi ini difokuskan pada HR (Karyawan, Presensi, Cuti, Shift, Laporan) tanpa pengelolaan gaji.

6. **Prinsip Mobile-First & Best Practice Industri**:
   * **WAJIB Mobile-First**: Semua komponen dan halaman baru harus dirancang dan dioptimalkan untuk layar smartphone (`< 640px`) terlebih dahulu, lalu disesuaikan secara responsif untuk desktop.
   * **UX Native & Bebas `alert()`**: Wajib gunakan `showToast()` dari `useHR()` untuk notifikasi. Dilarang menggunakan `alert()` browser. Gunakan animasi mikro Framer Motion dan feedback suara `playClickSound()`.

7. **Pemeliharaan Dokumentasi Otomatis (Self-Documentation Rule)**:
   * **WAJIB** memperbarui file `AGENTS.md` (bagian struktur direktori / aturan) dan menambahkan komentar JSDoc pada file komponen setiap kali membuat komponen reusable baru, merombak arsitektur, atau menambah fitur besar. Dokumen tidak boleh dibiarkan usang.

8. **General Domain Rule (Aplikasi HR & Operasional Umum)**:
   * **WAJIB General**: Aplikasi ini adalah **Sistem HRD & Workforce Operations Umum** yang serbaguna untuk bidang perusahaan operasional apa pun. **DILARANG EKSPLISIT** menggunakan istilah spesifik seperti *resto, resort, kitchen, waiter* secara kaku. Gunakan istilah umum seperti *Perusahaan, Rajaklana HQ, Area Operasional, Produksi & Operasional, Layanan & Lapangan, Team Lead, Supervisor*.

9. **Aturan Standar Mobile PWA & Native UX (Wajib Dipatuhi)**:
   * **iOS & Android Safe-Area Insets**: Komponen `Header` wajib menyertakan `pt-[env(safe-area-inset-top)]` dan `h-[calc(4rem+env(safe-area-inset-top))]`, serta `BottomNav` menyertakan `pb-[max(1rem,env(safe-area-inset-bottom))]` untuk menghindari bentrokan dengan *notch*, *status bar*, dan *iOS Home Bar*. Metadata `viewport` wajib menggunakan `viewportFit: "cover"`.
   * **Header Glassmorphism Translucent**: Header wajib menggunakan `bg-slate-900/85 backdrop-blur-xl` sehingga saat halaman di-*scroll*, konten di bawahnya samar terpotong (*frosted glass*) dengan mewah.
   * **Robust Body Scroll Lock (Modal / Bottom Sheet)**: Komponen `Modal` wajib menggunakan teknik `position: fixed` pada `document.body` saat terbuka untuk mematikan *background scrolling* pada iOS Safari.
   * **Smart Virtual Keyboard Auto-Scroll**: Komponen `Modal` wajib memanfaatkan `window.visualViewport` API & focus listener (`handleFocusIn`) untuk menyuntikkan padding dinamik (`pb-64`) dan memanggil `scrollIntoView({ block: 'center' })` agar elemen input (`input`, `textarea`, `select`, `Combobox`, `DatePicker`, `TimePicker`) tidak pernah tertutupi keyboard HP.
   * **Toast Notification Mobile Standard**: Komponen `Toast` diposisikan secara melayang di bawah header (`top-[calc(4.25rem+env(safe-area-inset-top))]`) dengan bentuk *Floating Capsule Pill* (`rounded-2xl`), *Glassmorphism Blur*, dan ikon dalam wadah transparan (`w-7 h-7 bg-amber-500/15`).
   * **Desain Bebas Scrollbar**: Semua *scrollbar* visual disembunyikan secara global di `globals.css` (`::-webkit-scrollbar { display: none; }`) untuk estetika aplikasi *native*.
   * **Kamera Selfie Presensi Portrait**: Kamera presensi wajib menggunakan rasio *Portrait* (`480x640`, `aspectRatio: 0.75`), container bingkai tegak (`h-72 sm:h-80`), dan transformasi cermin `ctx.scale(-1, 1)` agar pratinjau dan foto selfie konsisten.

---

## 🔮 Roadmap & Panduan Integrasi Database (Masa Depan)

Ketika proyek ini mulai terhubung dengan **Database / Backend sungguhan** (seperti Supabase, PostgreSQL, atau Firebase), AI Agent **WAJIB** mematuhi rencana arsitektur *Instant UX / Zero-Latency* berikut:

1. **Optimistic UI Updates**:
   * Aksi pengguna (seperti Absen Masuk, Tambah Karyawan, Setujui Cuti, Tukar Shift) harus **langsung mengubah UI secara instan (0ms)** di client, sementara proses mutasi API dikirim di latar belakang secara asinkron.
2. **Caching & Stale-While-Revalidate (`@tanstack/react-query`)**:
   * Gunakan TanStack Query (React Query) untuk menangani *data fetching* dan *caching* agar navigasi antar menu menggunakan data cache (terbuka seketika tanpa loading spinner yang mengganggu).
3. **Prefetching & React Suspense**:
   * Manfaatkan *prefetching* data pada tombol navigasi dan tampilkan `Skeleton` loader saat data awal memuat.
4. **Offline-First / Local Storage Persistence**:
   * Pertimbangkan penyimpan data lokal (IndexedDB / LocalStorage) agar aplikasi tetap responsif jika digunakan di area operasional dengan sinyal HP terbatas.
