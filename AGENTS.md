<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Agent Guide & Repository Architecture Documentation

Dokumen ini berisi informasi arsitektur, konvensi desain, dan petunjuk penting untuk AI Agent yang membantu pengembangan aplikasi **HR Rajaklana (`hr-app`)**.

---

## Status Saat Ini & Handoff Wajib

> [!IMPORTANT]
> Baca `IMPLEMENTATION_ROADMAP.md`, `PRD.md`, `ERD.md`, dan
> `supabase/README.md` sebelum mengerjakan integrasi backend.

- Supabase hosted sudah terhubung ke project ref `ttbogurultjbporryylb`.
- Tiga puluh delapan migration sudah diterapkan dan cocok antara lokal/remote.
- Local/hosted lint schema `public` bersih dan pgTAP lulus 337/337 pada
  1 Agustus 2026.
- Client browser/server dan proxy refresh sesi sudah tersedia.
- Batas sumber data `APP_DATA_SOURCE=demo|supabase`, provider TanStack Query,
  query key factory, dan repository bertipe data master sudah tersedia.
- Halaman karyawan sudah memiliki jalur baca serta create/update/archive
  Supabase terpisah. Perubahan outlet mempertahankan riwayat penempatan dan
  koreksi tanggal efektif menyesuaikan batas riwayat sebelumnya. Arsip
  menutup penempatan serta menonaktifkan akun terkait.
- Tab Lokasi & Geofencing pada Pengaturan sudah memakai Supabase untuk
  read/create/update/activate/deactivate. Outlet dengan penempatan aktif tidak
  dapat dinonaktifkan.
- Tab kebijakan kerja/cuti, template shift, dan kebutuhan staf outlet sudah
  memakai Supabase.
  Kebijakan diterbitkan sebagai versi baru; penggantian template shift
  mempertahankan record lama untuk referensi jadwal historis. Kebutuhan staf
  adalah override opsional per jumlah kasir bekerja, weekday/weekend, dan
  tanggal efektif. Default Middle hanya berlaku weekday saat tepat tiga kasir
  bekerja; histori tidak dapat ditulis langsung oleh client.
- Modul selain Dashboard, komunikasi, Laporan, data karyawan, Jadwal,
  Cuti/Izin, Lembur, Presensi, dan Pengaturan master data masih memakai
  `HRContext` dan `localStorage`.
- Login, logout, route protection, wajib ganti password, operasi akun
  server-only, UI akun pada halaman Karyawan, dan script bootstrap supervisor
  sudah diimplementasikan.
- Supervisor pertama sudah dibuat; login pertama, wajib ganti password,
  logout, dan login ulang telah berhasil diuji secara lokal.
- Otorisasi anonymous, employee, supervisor, dan management telah diuji;
  management wajib read-only dan tidak boleh menjalankan aksi supervisor.
- Impor XLSX karyawan sudah memiliki template, validasi dry-run per baris,
  checksum payload, dan commit atomik. File diproses di browser, tidak
  diunggah ke Storage, dan akun pengguna tetap dibuat terpisah.
- Jadwal live sudah mendukung roster manual bulanan berversi, isi jadwal
  massal atomik, off day, backup outlet, publikasi, acknowledgement, dan
  tukar shift dua tahap. Pekan dimiliki oleh bulan tempat hari Senin awal
  pekan berada sehingga pekan parsial tidak dihitung ulang. Off pekan terakhir
  boleh jatuh pada awal bulan berikutnya, tetapi ledger tetap dimiliki bulan
  asal dan dibaca sebagai carry-in oleh generator bulan berikutnya.
  Validator publish bulan pemilik hanya memeriksa pola shift untuk off yang
  tanggal aktualnya berada dalam bulan tersebut; off carry-out diperiksa oleh
  guard carry-in saat roster bulan berikutnya dipublikasikan.
- Cuti/Izin live sudah mendukung saldo tahunan, reservasi, dokumen privat,
  pembatalan, jenis cuti dinamis, serta keputusan atomik. Cuti approved
  otomatis ditulis ke draft roster tanpa memutasi versi published; jadwal kerja
  yang membuat outlet tersisa kurang dari dua kasir memicu notifikasi backup
  berisi tanggal/outlet/shift dan membuka formulir backup manual yang sudah
  terisi konteks. Approval lama sudah direkonsiliasi secara idempotent dan
  publikasi ditolak bila jadwal kerja masih bertabrakan dengan cuti approved.
  UI supervisor membedakan saldo akun sendiri dari saldo pemohon, menandai
  jenis yang mengurangi saldo tahunan, dan memproyeksikan ledger sebelum
  keputusan dikonfirmasi.
  Lembur live mendukung
  pengajuan, penugasan, durasi rencana/aktual/disetujui, dan keputusan atomik.
- Presensi live GPS/geofence dan upload selfie private sudah diimplementasikan.
  UI menampilkan preview jarak server, status proses, kondisi offline, serta
  retry upload idempotent. Supervisor dapat memantau waktu dan selfie sejak
  clock-in, melihat jumlah sesi aktif/siap validasi dan batas waktu retensi;
  keputusan tetap menunggu clock-out. Selfie dijadwalkan terhapus tujuh hari
  setelah upload. Signed URL singkat, deletion worker idempotent, pemulihan
  lease, finalisasi metadata/audit atomik, retry cron, dan monitoring job gagal
  sudah tersedia. Monitoring retensi membedakan job terjadwal, retry, jatuh
  tempo, lease tertahan, dan percobaan yang habis. Invocation cron mencatat
  audit persisten tanpa secret/path Storage; UI supervisor menampilkan
  invocation terakhir dan memperingatkan scheduler yang tidak tercatat lebih
  dari 26 jam. Invocation otomatis Vercel Cron pertama sudah terverifikasi
  melalui audit persisten pada 1 Agustus 2026 pukul 03.59 WIB. Script
  verifikasi read-only mendukung pemeriksaan evidence dan `--cron-status` di
  `scripts/verify-attendance-retention.mjs`; checklist berada di
  `docs/ATTENDANCE_RETENTION_VERIFICATION.md`.
- Optimizer roster deterministik sudah diimplementasikan server-side. Snapshot
  input Supabase mencakup kasir eligible, penempatan efektif, off day, cuti,
  shift manual terkunci, template, kebutuhan staf, dan policy version. Hasil
  valid disimpan atomik sebagai draft beserta run, score, seed, dan audit;
  hasil invalid hanya menyimpan konflik. UI supervisor menampilkan preview
  konflik dan fairness sebelum publikasi, shortcut koreksi off, serta pilihan
  cepat tanggal carry-over untuk pekan terakhir.
- Dashboard live tidak lagi membaca data demo. Ringkasan identitas, presensi,
  karyawan sesuai scope RLS, pengajuan, validasi, dan riwayat memakai DAL
  Supabase. Pusat notifikasi live memiliki unread badge tahan-refresh,
  realtime dengan polling fallback, read receipt milik pengguna, serta tautan
  kontekstual. Pengumuman mendukung target seluruh perusahaan/outlet/karyawan,
  pin, kategori, acknowledgement wajib, dan statistik penerima untuk
  supervisor/management; management tetap hanya-baca.
- Laporan live tersedia untuk supervisor dan management melalui RPC
  role-aware dengan filter periode maksimal 92 hari, outlet, dan karyawan.
  Ringkasan mencakup presensi, keterlambatan/pulang awal, cuti, lembur,
  distribusi shift, dan perbandingan outlet. Ekspor XLSX multi-sheet dibuat
  lokal dari snapshot query yang sama; PDF memakai print browser. Ekspor
  periode panjang hingga 366 hari memakai job asynchronous, worker server-only,
  private Storage, checksum, retry terbatas, dan signed URL singkat.
- Offline read roster live menyimpan maksimal tiga bulan selama 24 jam per
  akun. Snapshot hanya memuat kolom jadwal yang diizinkan, dibersihkan dari
  alasan/peristiwa sensitif, dan cache akun sebelumnya dihapus saat akun
  berganti. Service worker hanya meng-cache shell/asset same-origin, bukan API.
  Seluruh TanStack mutation ditolak segera ketika perangkat offline.
- Kesehatan operasional live tersedia di halaman Laporan untuk supervisor dan
  management. RPC hanya mengembalikan agregat retensi, ekspor, generator
  roster, artefak backup aplikasi, dan timeline audit yang sudah disensor;
  actor ID, payload audit, error mentah, path Storage, dan secret tidak boleh
  dikirim ke client. Runbook insiden, backup/restore drill lokal disposable,
  dan checklist pilot berada di `docs/`.
- Milestone **M1 — Environment, Authentication, dan Supervisor Pertama**
  sudah selesai.
- Milestone **M2 — Data Access Layer dan Master Data** sudah selesai.
- Milestone **M3 — Penjadwalan Manual, Off Day, dan Versi Roster** sudah
  selesai.
- Milestone **M4 — Cuti, Izin, dan Lembur** sudah selesai.
- Milestone **M7 — Roster Otomatis, Middle, dan Fairness** sudah selesai.
- **M6 — Validasi Presensi dan Retensi File** tetap berstatus
  `DEFERRED VERIFICATION`; invocation otomatis sudah lulus, sedangkan
  penghapusan evidence nyata setelah tujuh hari masih menunggu jatuh tempo.
- **M8 — Notifikasi, Laporan, Offline Read, dan Pilot Produksi** berstatus
  `IN PROGRESS`. Implementasi non-pilot boleh dilanjutkan, tetapi pilot
  produksi dan status `DONE` tetap dilarang sampai bukti penghapusan evidence
  nyata M6, backup hosted, dan scope pilot selesai diverifikasi.

---

## 🚀 Arsitektur & Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (Mobile-first, Premium Dark Mode UI)
- **State Management**: TanStack Query untuk data Supabase; React Context API (`HRProvider` & `useHR()` di `@/context/HRContext.tsx`) dengan persistensi versi di `localStorage` untuk modul prototype
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
│   ├── api/roster/generate/ # Route server-side generator roster supervisor
│   ├── api/reports/exports/ # Route antrean worker ekspor laporan server-only
│   ├── template.tsx      # Global Page Transition wrapper (Framer Motion)
│   ├── layout.tsx        # App layout with Header, Sidebar & BottomNav
│   ├── page.tsx          # Mobile HR Dashboard (Home)
│   ├── attendance/       # Presensi & Kehadiran Page
│   ├── login/            # Login email/password Supabase
│   ├── change-password/  # Wajib ganti password pada login pertama
│   ├── employees/        # Data Karyawan Page
│   ├── leaves/           # Pengajuan Cuti & Izin Page
│   ├── overtime/         # Pengajuan Lembur & Overtime Page
│   ├── reports/          # Laporan & Analytics HR Page
│   └── schedule/         # Jadwal Shift Staf Page
├── components/
│   ├── employees/
│   │   └── EmployeeImportModal.tsx # Template, parsing lokal, dry-run, dan commit impor XLSX
│   ├── communications/
│   │   ├── LiveAnnouncementBoard.tsx # Pengumuman bertarget dan acknowledgement live
│   │   └── LiveNotificationBell.tsx # Pusat notifikasi, read receipt, realtime/polling
│   ├── dashboard/
│   │   └── LiveDashboardPage.tsx # Dashboard live sesuai scope RLS tanpa data mock
│   ├── reports/
│   │   └── LiveReportsPage.tsx # Laporan live role-aware dan export XLSX/PDF
│   ├── schedule/
│   │   └── LiveSchedulePage.tsx # Roster live, publish, acknowledgement, dan tukar shift
│   ├── leaves/
│   │   └── LiveLeavesPage.tsx # Saldo, dokumen privat, pengajuan, dan keputusan cuti
│   ├── overtime/
│   │   └── LiveOvertimePage.tsx # Pengajuan, penugasan, durasi, dan keputusan lembur
│   ├── providers/
│   │   ├── AppProviders.tsx # Query, data-source, dan provider prototype
│   │   └── OfflineReadProvider.tsx # Cache roster per akun dan status offline
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
│   ├── DataSourceContext.tsx # Mode data demo/live tervalidasi server
│   └── HRContext.tsx     # Mock database & provider modul prototype + Toast
├── lib/master-data/
│   ├── query-keys.ts     # Query key factory data master
│   ├── queries.ts        # TanStack Query hooks data master
│   └── repository.ts     # Repository Supabase bertipe dan dibatasi RLS
├── lib/attendance/
│   ├── query-keys.ts     # Query key factory workspace presensi
│   ├── queries.ts        # TanStack Query hooks clock-in dan clock-out
│   ├── repository.ts     # RPC presensi, validasi, dan selfie private
│   ├── actions.ts        # Pemicu cleanup segera setelah keputusan
│   └── retention-worker.ts # Worker idempotent penghapusan bukti
├── lib/communications/
│   ├── query-keys.ts     # Query key factory komunikasi
│   ├── queries.ts        # Query/mutation dan invalidasi realtime
│   └── repository.ts     # RPC workspace, publish, read, dan acknowledgement
├── lib/reports/
│   ├── query-keys.ts     # Filter dan query key laporan
│   ├── queries.ts        # Query workspace laporan live
│   ├── repository.ts     # RPC laporan bertipe dan role-aware
│   ├── workbook.ts       # Sheet XLSX bersama untuk browser/worker
│   └── export-worker.ts  # Worker server-only, checksum, dan private upload
├── lib/offline/
│   └── roster-cache.ts   # Sanitasi snapshot roster untuk perangkat
├── lib/operations/
│   ├── query-keys.ts     # Query key kesehatan operasional
│   ├── queries.ts        # Polling status read-only setiap 60 detik
│   └── repository.ts     # RPC agregat dan audit yang disensor
├── lib/roster/
│   ├── query-keys.ts     # Query key factory roster
│   ├── queries.ts        # TanStack Query hooks roster dan tukar shift
│   ├── repository.ts     # Repository RPC roster bertipe dan role-aware
│   ├── optimizer.ts      # Generator roster deterministik tanpa I/O
│   └── generation.ts     # Snapshot parser dan commit atomik server-side
├── lib/workforce-requests/
│   ├── query-keys.ts     # Query key factory cuti dan lembur
│   ├── queries.ts        # Query/mutation hooks dengan optimistic rollback
│   ├── leave-balance.ts  # Proyeksi ledger saldo saat keputusan cuti
│   └── repository.ts     # Repository RPC cuti, dokumen privat, dan lembur
├── lib/supabase/
│   ├── client.ts         # Supabase client untuk Client Components
│   ├── server.ts         # Supabase client berbasis cookies untuk server
│   ├── admin.ts          # Admin client server-only
│   └── proxy.ts          # Refresh sesi dan proteksi route
├── lib/auth/             # Session DAL, Server Actions, dan validasi password
├── proxy.ts              # Entry point Next.js 16 Proxy; tetap pasif tanpa env Supabase
├── types/
│   └── database.ts       # Tipe database; regenerasi melalui npm run supabase:types
└── utils/
    └── clickSound.ts     # Audio feedback + Haptic Feedback (navigator.vibrate) utility
scripts/
├── verify-attendance-retention.mjs # Verifikasi read-only metadata, Storage, audit, dan signed URL
├── verify-pilot-readiness.mjs # Agregat kesiapan pilot production tanpa PII/secret
└── run-local-backup-restore-drill.mjs # Restore disposable Supabase lokal
docs/
├── ATTENDANCE_RETENTION_VERIFICATION.md # Checklist penutupan exit criteria M6
├── ROSTER_OPTIMIZER.md # Kontrak, aturan, dan tahap integrasi optimizer M7
├── OPERATIONS_RUNBOOK.md # Triase, respons, pemulihan, dan penutupan insiden
├── BACKUP_RESTORE_DRILL.md # Prosedur drill lokal dan verifikasi hosted
├── PILOT_READINESS_VERIFICATION.md # Interpretasi verifier pilot read-only
└── PILOT_ROLLOUT_CHECKLIST.md # Gate dan smoke test pilot terbatas
public/
└── sw.js                 # Runtime cache shell/asset, tanpa cache API
```

Roadmap teknis, milestone, quality gate, dan handoff agent berada di
`IMPLEMENTATION_ROADMAP.md` pada root repository.

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
   - **WAJIB** menggunakan komponen `Modal` dari `@/components/ui/Modal`.
   - Contoh: `<Modal isOpen={isOpen} onClose={handleClose} title="Title" icon={LucideIcon}>...content...</Modal>`

2. **Ringkasan Kartu Statistik (Metrics)**:
   - **WAJIB** menggunakan komponen `StatCard` dari `@/components/ui/StatCard`.
   - Contoh: `<StatCard title="Total" value="10" icon={Users} />`

3. **Grafik Analytics**:
   - Gunakan atau tambahkan komponen terpisah di `src/components/ui/` jika membuat jenis grafik baru.

4. **State Data**:
   - Modul prototype yang belum dimigrasikan wajib tetap memakai `useHR()` dari `@/context/HRContext`.
   - Modul yang sudah dimigrasikan ke Supabase wajib memakai DAL/query hooks
     bertipe dan tidak boleh melakukan dual-write ke `HRContext`.
   - Ikuti urutan migrasi dan mode sumber data eksplisit pada
     `IMPLEMENTATION_ROADMAP.md`.

5. **Pengecualian Fitur (Fitur yang Dilarang)**:
   - **DILARANG EKSPLISIT** menyarankan, membuat, atau menambahkan fitur **Slip Gaji / Payroll / Ringkasan Gaji** dalam bentuk apa pun. Pengguna telah mengonfirmasi bahwa aplikasi ini difokuskan pada HR (Karyawan, Presensi, Cuti, Shift, Laporan) tanpa pengelolaan gaji.

6. **Prinsip Mobile-First & Best Practice Industri**:
   - **WAJIB Mobile-First**: Semua komponen dan halaman baru harus dirancang dan dioptimalkan untuk layar smartphone (`< 640px`) terlebih dahulu, lalu disesuaikan secara responsif untuk desktop.
   - **UX Native & Bebas `alert()`**: Wajib gunakan `showToast()` dari `useHR()` untuk notifikasi. Dilarang menggunakan `alert()` browser. Gunakan animasi mikro Framer Motion dan feedback suara `playClickSound()`.

7. **Pemeliharaan Dokumentasi Otomatis (Self-Documentation Rule)**:
   - **WAJIB** memperbarui file `AGENTS.md` (bagian struktur direktori / aturan) dan menambahkan komentar JSDoc pada file komponen setiap kali membuat komponen reusable baru, merombak arsitektur, atau menambah fitur besar. Dokumen tidak boleh dibiarkan usang.

8. **General Domain Rule (Aplikasi HR & Operasional Umum)**:
   - **WAJIB General**: Aplikasi ini adalah **Sistem HRD & Workforce Operations Umum** yang serbaguna untuk bidang perusahaan operasional apa pun. **DILARANG EKSPLISIT** menggunakan istilah spesifik seperti _resto, resort, kitchen, waiter_ secara kaku. Gunakan istilah umum seperti _Perusahaan, Rajaklana HQ, Area Operasional, Produksi & Operasional, Layanan & Lapangan, Team Lead, Supervisor_.

9. **Aturan Standar Mobile PWA & Native UX (Wajib Dipatuhi)**:
   - **iOS & Android Safe-Area Insets**: Komponen `Header` wajib menyertakan `pt-[env(safe-area-inset-top)]` dan `h-[calc(4rem+env(safe-area-inset-top))]`, serta `BottomNav` menyertakan `pb-[max(1rem,env(safe-area-inset-bottom))]` untuk menghindari bentrokan dengan _notch_, _status bar_, dan _iOS Home Bar_. Metadata `viewport` wajib menggunakan `viewportFit: "cover"`.
   - **Header Glassmorphism Translucent**: Header wajib menggunakan `bg-slate-900/85 backdrop-blur-xl` sehingga saat halaman di-_scroll_, konten di bawahnya samar terpotong (_frosted glass_) dengan mewah.
   - **Robust Body Scroll Lock (Modal / Bottom Sheet)**: Komponen `Modal` wajib menggunakan teknik `position: fixed` pada `document.body` saat terbuka untuk mematikan _background scrolling_ pada iOS Safari.
   - **Smart Virtual Keyboard Auto-Scroll**: Komponen `Modal` wajib memanfaatkan `window.visualViewport` API & focus listener (`handleFocusIn`) untuk menyuntikkan padding dinamik (`pb-64`) dan memanggil `scrollIntoView({ block: 'center' })` agar elemen input (`input`, `textarea`, `select`, `Combobox`, `DatePicker`, `TimePicker`) tidak pernah tertutupi keyboard HP.
   - **Toast Notification Mobile Standard**: Komponen `Toast` diposisikan secara melayang di bawah header (`top-[calc(4.25rem+env(safe-area-inset-top))]`) dengan bentuk _Floating Capsule Pill_ (`rounded-2xl`), _Glassmorphism Blur_, dan ikon dalam wadah transparan (`w-7 h-7 bg-amber-500/15`).
   - **Desain Bebas Scrollbar**: Semua _scrollbar_ visual disembunyikan secara global di `globals.css` (`::-webkit-scrollbar { display: none; }`) untuk estetika aplikasi _native_.
   - **Kamera Selfie Presensi Portrait**: Kamera presensi wajib menggunakan rasio _Portrait_ (`480x640`, `aspectRatio: 0.75`), container bingkai tegak (`h-72 sm:h-80`), dan transformasi cermin `ctx.scale(-1, 1)` agar pratinjau dan foto selfie konsisten.

---

## 🔮 Panduan Integrasi Data Nyata

Fondasi Supabase sudah tersedia, tetapi UI masih menggunakan data prototype.
Urutan implementasi wajib mengikuti `IMPLEMENTATION_ROADMAP.md`. Saat setiap
modul dipindahkan ke data nyata, AI Agent **WAJIB** mematuhi rencana arsitektur
_Instant UX / Zero-Latency_ berikut:

1. **Optimistic UI Updates**:
   - Aksi pengguna (seperti Absen Masuk, Tambah Karyawan, Setujui Cuti, Tukar Shift) harus **langsung mengubah UI secara instan (0ms)** di client, sementara proses mutasi API dikirim di latar belakang secara asinkron.
2. **Caching & Stale-While-Revalidate (`@tanstack/react-query`)**:
   - Gunakan TanStack Query (React Query) untuk menangani _data fetching_ dan _caching_ agar navigasi antar menu menggunakan data cache (terbuka seketika tanpa loading spinner yang mengganggu).
3. **Prefetching & React Suspense**:
   - Manfaatkan _prefetching_ data pada tombol navigasi dan tampilkan `Skeleton` loader saat data awal memuat.
4. **Offline-First / Local Storage Persistence**:
   - Pertimbangkan penyimpan data lokal (IndexedDB / LocalStorage) agar aplikasi tetap responsif jika digunakan di area operasional dengan sinyal HP terbatas.
