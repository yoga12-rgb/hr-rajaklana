# Implementation Roadmap & Agent Handoff — HR Rajaklana

## Informasi dokumen

| Atribut               | Nilai                                                           |
| --------------------- | --------------------------------------------------------------- |
| Tujuan                | Menjadi sumber acuan eksekusi untuk agent pengembang berikutnya |
| Terakhir diverifikasi | 29 Juli 2026                                                    |
| Fase saat ini         | M8 berjalan; gate pilot menunggu verifikasi waktu M6            |
| Branch utama          | `main`                                                          |
| Supabase hosted       | `https://ttbogurultjbporryylb.supabase.co`                      |
| Supabase project ref  | `ttbogurultjbporryylb`                                          |
| Dokumen produk        | `PRD.md`                                                        |
| Model data            | `ERD.md`                                                        |
| Aturan agent          | `AGENTS.md`                                                     |

Dokumen ini adalah backlog teknis kanonis. Agent yang melanjutkan pekerjaan
wajib membaca `AGENTS.md`, `PRD.md`, `ERD.md`, dokumen ini, dan
`supabase/README.md` sebelum mengubah kode.

## Legenda status

- `DONE`: sudah diterapkan dan diverifikasi.
- `IN PROGRESS`: sedang dikerjakan dan belum memenuhi seluruh exit criteria.
- `NEXT`: milestone pertama yang boleh dikerjakan.
- `BACKLOG`: belum dikerjakan dan bergantung pada milestone sebelumnya.
- `BLOCKED`: tidak boleh dilanjutkan sebelum input atau akses tersedia.

Selesaikan satu milestone secara fokus. Jangan memulai milestone berikutnya
sebelum exit criteria milestone aktif terpenuhi atau pengecualian dicatat di
dokumen ini.

---

## 1. Baseline yang sudah selesai

### B0 — Prototype UI dan quality gate (`DONE`)

Sudah tersedia:

- Next.js 16 App Router, React 19, TypeScript, dan Tailwind CSS v4.
- UI mobile-first untuk dashboard, karyawan, jadwal, presensi, cuti, lembur,
  laporan, pengumuman, profil, dan pengaturan.
- Komponen reusable dan aturan native mobile pada `AGENTS.md`.
- `HRContext` sebagai database mock dengan persistensi
  `localStorage` key `hr-rajaklana-demo-v1`.
- Playwright E2E, axe accessibility, ESLint, TypeScript, production build, dan
  GitHub Actions quality gate.

### B1 — PRD dan ERD (`DONE`)

Keputusan produk dan bisnis telah didokumentasikan:

- Tidak ada role Admin HR. Role aplikasi hanya `employee`, `supervisor`, dan
  `management`.
- Jenis supervisor adalah konteks jabatan/organisasi, bukan role akses baru.
- Tidak ada fitur payroll atau slip gaji.
- Selfie hanya wajib saat clock-in.
- Kasir memakai geofence outlet penempatan; supervisor boleh presensi di
  outlet mana pun dan jam berapa pun dengan target kerja delapan jam.
- Keputusan persetujuan pertama mengunci dan self-approval dilarang.
- Jadwal otomatis, off day, middle, backup outlet, tukar shift, cuti, lembur,
  notifikasi, serta retensi bukti telah dirinci di `PRD.md`.
- KPI ditempatkan pada fase setelah MVP.

### B2 — Fondasi Supabase hosted (`DONE`)

Sudah tersedia:

- Schema PostgreSQL versioned di `supabase/migrations/`.
- Row Level Security, private Storage, RPC persetujuan transaksional, audit,
  metadata retensi, dan tipe database terbuat.
- Supabase browser client, server client berbasis cookie, dan Next.js Proxy
  untuk refresh sesi.
- Public sign-up dan anonymous sign-in dinonaktifkan pada konfigurasi lokal.
- Project hosted sudah terhubung dan dua puluh delapan migration berikut identik antara
  lokal dan remote:

| Migration                                                          | Fungsi                                    |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `20260724104032_initial_workforce_schema.sql`                      | Schema inti workforce                     |
| `20260724104038_secure_storage_and_rls.sql`                        | RLS, private Storage, RPC, dan keamanan   |
| `20260724183617_enable_database_testing.sql`                       | Mengaktifkan pgTAP                        |
| `20260724183900_grant_cli_database_testing_access.sql`             | Akses minimum role CLI untuk tes          |
| `20260726153000_complete_password_change.sql`                      | Aktivasi akun dan audit password atomik   |
| `20260726193000_harden_auth_role_helper_privileges.sql`            | Hardening hak eksekusi helper role        |
| `20260726213000_employee_master_data_rpcs.sql`                     | CRUD/arsip karyawan dan penempatan atomik |
| `20260726230000_outlet_master_data_rpcs.sql`                       | CRUD/status outlet dan geofence atomik    |
| `20260727003000_policy_and_shift_template_rpcs.sql`                | Kebijakan versioned dan template shift    |
| `20260727013000_harden_policy_shift_write_paths.sql`               | Tutup jalur tulis langsung tabel historis |
| `20260727130000_employee_import_workflow.sql`                      | Dry-run dan commit atomik impor XLSX      |
| `20260727210000_manual_roster_workflow.sql`                        | Roster manual, off, publish, dan tukar    |
| `20260727223000_harden_roster_function_privileges.sql`             | Hardening hak eksekusi RPC roster         |
| `20260728003000_leave_overtime_workflow.sql`                       | Cuti, dokumen privat, saldo, dan lembur   |
| `20260728150000_attendance_clock_workflow.sql`                     | Clock-in/out, geofence server, dan selfie |
| `20260728153000_harden_attendance_function_privileges.sql`         | Hardening hak RPC presensi                |
| `20260728160000_attendance_geofence_preview.sql`                   | Preview jarak geofence server untuk UI    |
| `20260728170000_fix_get_monthly_roster_empty_period.sql`           | Karyawan tersedia sebelum periode roster  |
| `20260728190000_harden_attendance_retention_access.sql`            | Hardening akses selfie dan retention job  |
| `20260728200000_atomic_attendance_deletion_completion.sql`         | Finalisasi retensi dan audit atomik       |
| `20260728210000_bulk_manual_roster_fill.sql`                       | Isi rentang roster manual secara atomik   |
| `20260728220000_update_active_placement_effective_date.sql`        | Koreksi tanggal efektif penempatan aktif  |
| `20260728230000_assign_partial_week_to_starting_month.sql`         | Kepemilikan pekan parsial untuk jatah off |
| `20260729003000_preview_clock_in_and_retain_selfie_seven_days.sql` | Preview clock-in dan retensi tujuh hari   |
| `20260729130000_add_leave_schedule_status.sql`                     | Status cuti pada assignment roster        |
| `20260729131000_auto_roster_generation_workflow.sql`               | Snapshot dan commit optimizer roster      |
| `20260729150000_support_cross_month_off_days.sql`                  | Carry-over off pekan terakhir lintas bulan |
| `20260729160000_m8_communication_workflow.sql`                    | Notifikasi dan pengumuman bertarget live    |

Verifikasi terakhir terhadap hosted project:

- Migration lokal dan remote cocok.
- Lint schema `public` tidak menemukan error.
- pgTAP lulus `275/275`.

### B3 — Batas baseline yang wajib dipahami

Fondasi backend dan autentikasi sudah aktif, tetapi aplikasi belum sepenuhnya
menjadi aplikasi multi-user:

- Dashboard, komunikasi, halaman karyawan, Jadwal, Cuti/Izin, Lembur, dan
  Presensi pada mode live tidak membaca atau memutasi data bisnis `HRContext`;
  Laporan dan sebagian modul pendukung masih memakai data prototype.
- Halaman login, logout, perubahan kata sandi pertama, proteksi route, dan
  operasi akun server-only sudah tersedia.
- Supervisor pertama sudah dibuat dan alur login pertama lokal telah lulus.
- Belum ada data karyawan/outlet nyata yang diimpor.
- Upload selfie nyata, worker penghapusan file, dan optimizer roster otomatis
  deterministik sudah tersedia.
- Konfigurasi environment Vercel tidak dapat dianggap selesai hanya karena
  tersedia secara lokal; wajib diverifikasi dari deployment.

Jangan menyatakan suatu alur sudah memakai Supabase hanya karena tabel atau
client Supabase telah tersedia.

---

## 2. Lingkungan kerja

### 2.1 Stack dan lokasi penting

| Area                     | Lokasi                          |
| ------------------------ | ------------------------------- |
| Halaman                  | `src/app/`                      |
| Komponen reusable        | `src/components/ui/`            |
| State prototype          | `src/context/HRContext.tsx`     |
| Supabase clients         | `src/lib/supabase/`             |
| Next.js session proxy    | `src/proxy.ts`                  |
| Generated database types | `src/types/database.ts`         |
| Migrations               | `supabase/migrations/`          |
| Database tests           | `supabase/tests/database/`      |
| E2E tests                | `e2e/`                          |
| CI                       | `.github/workflows/quality.yml` |

Local Supabase memakai port `55320`–`55329` agar tidak berbenturan dengan
project lain. Jangan menghentikan container Supabase milik project lain.

### 2.2 Environment variables

Nama variabel yang diizinkan:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CRON_SECRET=
APP_DATA_SOURCE=demo
```

Aturan:

- `NEXT_PUBLIC_*` boleh digunakan browser dan tetap dibatasi RLS.
- `SUPABASE_SECRET_KEY` hanya boleh dibaca modul `server-only`.
- Jangan menulis secret, password awal, token, atau database URL ke source,
  migration, fixture, log, issue, commit, atau percakapan.
- Jangan meminta pengguna mengirim secret melalui chat.
- Gunakan `.env.local` untuk lokal dan Vercel Environment Variables untuk
  deployment.
- Sebelum milestone autentikasi dinyatakan selesai, verifikasi Production,
  Preview, dan Development environment yang memang diperlukan.

### 2.3 Perintah validasi

Validasi aplikasi:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Validasi database lokal:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
npm run supabase:types
npm run supabase:stop
```

Validasi hosted yang aman:

```bash
npx supabase migration list --linked
npx supabase db lint --linked --schema public --level warning
npx supabase test db --linked
```

Larangan:

- Jangan menjalankan `supabase db reset` terhadap hosted/production.
- Jangan mengedit migration yang sudah diterapkan. Buat migration baru.
- Jangan menjalankan `db push` sebelum memeriksa target project, daftar
  migration, dan dry-run.

---

## 3. Keputusan arsitektur untuk fase implementasi

### 3.1 Transisi sumber data

Transisi dilakukan per modul, bukan dengan mengganti seluruh `HRContext`
sekaligus.

1. Tambahkan batas data yang jelas berupa DAL/repository dan query hooks.
2. Gunakan mode data eksplisit, misalnya `APP_DATA_SOURCE=demo|supabase`, yang
   dibaca di server dan diteruskan ke provider.
3. Production mode tidak boleh diam-diam kembali ke data demo ketika query
   gagal atau environment salah.
4. Modul yang sudah dipindahkan ke Supabase tidak boleh melakukan dual-write
   ke `HRContext`.
5. `HRContext` tetap boleh menyediakan toast dan mode demo sampai semua modul
   selesai dimigrasikan.
6. Setelah seluruh modul MVP memakai Supabase, pecah atau hapus state bisnis
   mock dan pertahankan demo hanya sebagai fixture pengujian.

### 3.2 Akses data dan mutasi

- Server Components digunakan untuk initial read yang cocok untuk server.
- Server Actions atau Route Handlers digunakan untuk operasi yang membutuhkan
  secret/admin privilege.
- Browser Supabase client hanya menjalankan operasi yang memang diizinkan RLS.
- Otorisasi server memakai claims terverifikasi; jangan memakai `getSession()`
  sebagai dasar keputusan akses.
- Persetujuan cuti, lembur, koreksi, dan validasi presensi wajib lewat RPC
  transaksional yang telah dirancang.
- Gunakan TanStack Query saat modul pertama mulai memakai data nyata untuk
  cache, optimistic update, invalidation, dan retry yang terkontrol.

### 3.3 Akun dan password

- Tidak ada public sign-up.
- Supervisor membuat email dan password awal karyawan melalui proses
  server-only.
- `user_accounts.must_change_password` memaksa perubahan password pada login
  pertama.
- Supervisor boleh mengganti password pengguna yang lupa melalui operasi
  admin server-only dan harus menghasilkan audit log.
- Secret key tidak boleh masuk Client Component atau bundle browser.
- Akun supervisor pertama dibuat melalui script bootstrap satu kali atau
  prosedur operasional tepercaya, bukan endpoint publik.

### 3.4 UX dan keamanan

- UI harus tetap mobile-first, amber sebagai aksen utama, menggunakan
  komponen reusable, toast, feedback suara, serta haptic yang sudah ditetapkan.
- Mutasi menggunakan optimistic UI hanya jika rollback dan pesan gagal
  tersedia.
- Jangan tampilkan keberhasilan sebelum server mengonfirmasi operasi kritis.
- RLS adalah pertahanan utama; penyembunyian tombol bukan otorisasi.
- Semua bucket tetap private dan akses file memakai signed URL berumur pendek.

---

## 4. Milestone implementasi

## M1 — Environment, Authentication, dan Supervisor Pertama (`DONE`)

### Tujuan

Membuat aplikasi memiliki sesi nyata, akses berbasis role, perubahan password
pertama, serta satu supervisor bootstrap yang aman.

### Pekerjaan

- Verifikasi environment Supabase pada Vercel tanpa menyalin secret ke repo.
- Konfigurasikan Supabase Auth Site URL dan redirect URL sesuai domain
  production/preview yang benar.
- Tambahkan admin Supabase client `server-only` yang membaca
  `SUPABASE_SECRET_KEY`.
- Buat halaman login email/password, logout, loading, error, dan expired
  session state.
- Lindungi route aplikasi; pengguna tanpa sesi diarahkan ke login.
- Setelah login, baca `user_accounts` dan arahkan akun dengan
  `must_change_password=true` ke halaman perubahan password.
- Setelah password berhasil diubah, ubah flag secara atomik dan tulis audit.
- Implementasikan pembuatan akun oleh supervisor dan reset password manual
  dengan validasi role di server.
- Buat prosedur/script idempotent untuk supervisor pertama. Identitas dan
  password diperoleh saat eksekusi, tidak disimpan di Git.
- Pastikan akun `locked` atau `deactivated` tidak dapat memakai aplikasi.
- Tambahkan pengujian untuk employee, supervisor, management, anonymous,
  force-change-password, dan larangan self-approval.

### Progres terverifikasi 26 Juli 2026

Selesai:

- Environment lokal terdeteksi lengkap; pemilik produk mengonfirmasi
  environment Vercel serta Auth URL/redirect URL sudah ditambahkan.
- Admin client `server-only`, login, logout, proteksi route, status akun, dan
  halaman wajib ganti password sudah diimplementasikan.
- Aktivasi akun dan audit setelah perubahan password memakai RPC
  transaksional `complete_password_change`.
- Operasi server-only untuk membuat akun dan reset password manual tersedia
  dengan pemeriksaan role.
- Halaman Karyawan live menampilkan status akun serta modal supervisor untuk
  membuat akun dan mengganti kata sandi awal tanpa mengekspos secret admin.
- Script idempotent `npm run auth:bootstrap-supervisor` tersedia, membaca
  environment lokal, dan tidak menyimpan password.
- Supervisor pertama `RK-2026-001` sudah terverifikasi di hosted Auth dan
  `user_accounts` sebagai role `supervisor`, status `invited`, serta
  `must_change_password=true`.
- Supervisor pertama berhasil login, dipaksa mengganti password, masuk ke
  dashboard, logout, dan login ulang pada pengujian lokal.
- Role anonymous, employee, supervisor, dan management sudah diuji. Management
  dipastikan read-only dan hanya supervisor yang memperoleh otoritas mutasi.
- Migration lokal/hosted identik; reset lokal, lint lokal/hosted, pgTAP 28/28,
  lint aplikasi, typecheck, build, serta 14 E2E desktop/mobile lulus. E2E auth
  mencakup pemeriksaan posisi form tepat di tengah viewport.
- Deployment Vercel untuk commit `d4c834d` berstatus sukses. Production
  `/login` merespons 200 dan akses anonymous ke `/` merespons 307 menuju login.

Seluruh exit criteria M1 selesai pada 26 Juli 2026.

### Input pemilik produk

- Nama, email, dan NIK supervisor pertama.
- Jabatan supervisor dan penempatan awal.
- Domain Vercel production yang benar.
- Password awal dimasukkan langsung saat bootstrap, bukan melalui source.

### Exit criteria

- AC-01, AC-02, dan AC-09 pada `PRD.md` lulus.
- Anonymous tidak dapat membuka halaman aplikasi.
- Employee tidak dapat membuka aksi supervisor.
- Supervisor pertama dapat login, dipaksa mengganti password, logout, dan
  login ulang.
- Tidak ada secret pada client bundle atau Git history perubahan.
- Lint, typecheck, build, E2E, database reset/lint/test lulus.

---

## M2 — Data Access Layer dan Master Data (`DONE`)

### Tujuan

Memindahkan data karyawan, akun, outlet, penempatan, jabatan, status kerja,
template shift, serta kebijakan dari mock ke Supabase.

### Pekerjaan

- Tambahkan TanStack Query dan provider/query key factory yang konsisten.
- Buat DAL/repository bertipe untuk master data.
- Implementasikan mode sumber data eksplisit dan indikator demo/live.
- Migrasikan halaman karyawan, outlet, dan pengaturan terkait.
- Terapkan create/update/archive; hindari hard delete data historis.
- Implementasikan penempatan utama dan riwayat perpindahan outlet.
- Pastikan tampilan karyawan hanya membaca kolom yang diizinkan PRD.
- Buat template impor data dengan validasi dry-run dan laporan kesalahan.
- Tambahkan RLS tests untuk akses employee, supervisor, dan management.
- Regenerasi `src/types/database.ts` setiap schema berubah.

### Progres terverifikasi 26 Juli 2026

Selesai:

- `@tanstack/react-query`, provider global, kebijakan retry/cache, dan query
  key factory data master sudah ditambahkan.
- `APP_DATA_SOURCE=demo|supabase` divalidasi di Server Component lalu
  diteruskan ke client provider. Konfigurasi kosong ditandai jelas sebagai
  demo belum diatur; nilai tidak valid menghentikan build/render.
- Header menampilkan indikator `Live Bertahap`, `Data Demo`, atau
  `Data Demo · Belum Diatur`.
- Repository bertipe dan query hooks RLS-aware tersedia untuk karyawan,
  outlet, jabatan, serta status kerja.
- Halaman karyawan memisahkan komponen demo dan live. Query live tidak
  fallback ke `HRContext`; error Supabase ditampilkan secara jujur dan mutasi
  demo tidak tersedia pada mode live.
- RPC transaksional create/update/archive karyawan telah diterapkan lokal dan
  hosted. RPC memeriksa role supervisor, menulis audit, mempertahankan riwayat
  perpindahan outlet, mencegah supervisor mengarsipkan diri sendiri, serta
  menonaktifkan akun saat data karyawan diarsipkan.
- Form edit memuat tanggal mulai penempatan aktif. Koreksi tanggal pada outlet
  yang sama memperbarui record aktif dan menyesuaikan tanggal akhir penempatan
  sebelumnya agar riwayat tetap berurutan tanpa celah.
- UI live menampilkan aksi mutasi hanya untuk supervisor. Employee dan
  management memperoleh akses baca; RLS/RPC tetap menjadi otorisasi utama.
- Tab Lokasi & Geofencing memakai daftar dan mutasi Supabase pada mode live.
  Create/update/status outlet menulis audit; penonaktifan ditolak selama masih
  ada penempatan aktif dan tidak menghapus record historis.
- Tab kebijakan kerja/cuti dan template shift outlet memakai query/mutation
  Supabase pada mode live. Employee dan management memperoleh mode baca.
- Kebijakan diterbitkan sebagai versi baru dan menutup versi efektif
  sebelumnya. Penerbitan presensi + lembur berjalan atomik; alasan serta
  snapshot sebelum/sesudah dicatat pada audit.
- Penggantian template shift menonaktifkan template aktif lama lalu membuat
  record baru sehingga jadwal historis tidak berubah. Jam Pagi/Middle/Malam,
  toleransi terlambat, dan toleransi pulang awal dapat berbeda per outlet.
- Hak tulis langsung client pada tabel kebijakan dan template shift dicabut;
  seluruh perubahan wajib melewati RPC versioned yang diaudit.
- Supervisor dapat mengunduh template XLSX dua sheet, memilih file hingga
  2 MB/500 baris, dan memperoleh laporan dry-run per baris sebelum commit.
  File dibaca di browser dan tidak diunggah ke Storage.
- PostgreSQL memvalidasi format NIK, duplikasi file/database, tanggal, serta
  kode status kerja, jabatan, dan outlet aktif. Commit hanya menerima payload
  dengan checksum yang sama, memvalidasi ulang, lalu membuat seluruh karyawan
  dan penempatan secara atomik.
- Akun dan kata sandi tidak diimpor dari XLSX. Pembuatan akun tetap memakai
  alur supervisor server-only agar kredensial tidak masuk file atau log impor.
- `data_import_jobs` hanya dapat ditulis melalui RPC supervisor; employee dan
  management tidak dapat menjalankan dry-run/commit atau memutasi tabel job.
- Migration lokal/hosted identik. Lint lokal/hosted, pgTAP lokal dan hosted
  `93/93`, types generation, lint aplikasi, typecheck, production build, serta
  14 E2E desktop/mobile lulus.
- Audit dependensi production bersih (`0` vulnerability). Sembilan temuan
  audit yang tersisa hanya berasal dari toolchain ESLint development dan
  memerlukan upgrade mayor, sehingga tidak diperbaiki otomatis pada M2.

### Exit criteria

- Halaman master data pada mode live tidak membaca atau menulis `HRContext`.
- Refresh browser mempertahankan data karena berasal dari Supabase.
- Employee tidak dapat mengubah master data.
- Supervisor dapat mengelola data sesuai cakupan.
- Arsip tidak merusak relasi jadwal, presensi, atau audit.
- Quality gate aplikasi dan database lulus.

---

## M3 — Penjadwalan Manual, Off Day, dan Versi Roster (`DONE`)

### Tujuan

Menyediakan fondasi jadwal nyata yang cukup untuk presensi sebelum roster
otomatis dibuat.

### Pekerjaan

- Gunakan template shift per outlet yang sudah versioned untuk jadwal manual,
  termasuk outlet yang tutup lebih awal.
- Implementasikan off day supervisor dan karyawan.
- Dukung peminjaman jatah off pekan berikutnya dengan ledger/audit yang jelas.
- Implementasikan draft, publish, superseded version, serta acknowledgement.
- Implementasikan perubahan manual dengan alasan wajib dan audit.
- Implementasikan backup outlet dan tukar shift dengan persetujuan atomik.
- Pastikan jadwal sebelum off adalah pagi dan setelah off adalah malam ketika
  aturan tersebut berlaku.
- Belum membuat optimizer roster otomatis pada milestone ini.

### Progres terverifikasi 26 Juli 2026

Selesai:

- Halaman Jadwal memisahkan jalur demo dan live. Mode live memakai repository
  RPC bertipe, TanStack Query, dan tidak fallback atau dual-write ke
  `HRContext`.
- Supervisor dapat menyusun matrix roster bulanan secara manual memakai
  template shift aktif per outlet, termasuk template outlet yang tutup lebih
  awal, serta memilih assignment utama, off day, atau backup outlet.
- Jatah off memiliki ledger sumber pekan yang unik. Peminjaman dibatasi ke
  pekan bersebelahan; pelanggaran total jatah ditolak saat publikasi.
- Pekan dimiliki oleh bulan tempat hari Senin awal pekan berada. Pekan
  parsial pada awal bulan tidak dihitung ulang karena sudah menjadi jatah
  bulan sebelumnya.
- Perubahan terhadap roster aktif membuat draft versi baru dengan menyalin
  assignment dan data backup. Versi `published` bersifat immutable dan jalur
  tulis langsung ke tabel historis dicabut dari client authenticated.
- Publikasi memvalidasi kelengkapan satu bulan, jatah off, batas Middle, pola
  pagi sebelum off/malam setelah off, dan minimum staffing outlet. Override
  yang diizinkan wajib menyimpan alasan.
- Publikasi mengganti versi aktif secara atomik, menyimpan audit, serta
  membuat notifikasi dan acknowledgement. Employee hanya menerima kolom roster
  publik yang diizinkan; management tetap read-only.
- Tukar shift dibatasi untuk kasir pada outlet dan versi roster yang sama.
  Persetujuan rekan mendahului keputusan supervisor, kedua tahap memakai
  first-write-wins, dan persetujuan akhir menerbitkan versi roster baru.
- Hak eksekusi fungsi internal dan RPC roster telah di-hardening. Anonymous
  tidak dapat menjalankan fungsi roster; hanya RPC publik yang diperlukan
  diberikan kepada role authenticated.
- Pengisian dasar dapat dilakukan sekaligus untuk semua kasir/supervisor atau
  satu karyawan pada rentang tanggal. Mode aman hanya mengisi sel kosong;
  mode replace diaudit dan seluruh proses rollback bila penempatan atau
  template shift salah satu target tidak tersedia.
- Migration lokal dan hosted identik. Lint schema lokal/hosted bersih, pgTAP
  lokal/hosted lulus `130/130`, types generation, lint aplikasi, typecheck,
  production build, serta 14 E2E desktop/mobile lulus.

### Exit criteria

- Supervisor dapat menyusun, mengubah, dan mempublikasikan jadwal satu bulan.
- Karyawan dapat melihat jadwal seluruh kasir dengan kolom yang diizinkan.
- Perubahan setelah publish membuat versi/audit yang dapat ditelusuri.
- Backup outlet dan tukar shift memenuhi AC-16, AC-17, dan AC-18.
- Konflik jadwal dan keputusan ganda ditolak database.

---

## M4 — Cuti, Izin, dan Lembur (`DONE`)

### Tujuan

Mengaktifkan pengajuan dan persetujuan nyata dengan saldo, audit, serta
larangan self-approval.

### Pekerjaan

- Migrasikan leave types, entitlement, saldo, request, dan attachment privat.
- Terapkan saldo Cuti Tahunan 12 hari/tahun dan pengajuan minimal tiga hari.
- Terapkan aturan tanggal, reservasi saldo, pembatalan, serta penolakan.
- Migrasikan lembur: sumber permintaan, rencana, realisasi, dan durasi yang
  disetujui.
- Gunakan RPC persetujuan yang tersedia; jangan update status langsung.
- Tambahkan optimistic UI dengan rollback dan invalidation.
- Tambahkan notifikasi in-app minimum untuk status pengajuan.

### Progres terverifikasi 26 Juli 2026

Selesai:

- Halaman Cuti/Izin dan Lembur memisahkan jalur demo serta live. Mode live
  memakai repository RPC bertipe, TanStack Query, invalidation, optimistic
  decision/cancel, dan rollback ketika server menolak.
- Saldo Cuti Tahunan dibuat otomatis per karyawan/tahun dari kebijakan aktif
  (12 hari pada konfigurasi saat ini). Submission mereservasi saldo; approve
  memindahkan reservasi ke saldo terpakai, sedangkan reject/cancel
  melepaskannya secara atomik.
- Pengajuan memvalidasi tanggal, notice period, benturan pengajuan, saldo,
  lampiran wajib, format/ukuran dokumen, dan keberadaan objek Storage.
- Dokumen cuti disimpan pada bucket private `leave-documents`, memakai path
  UUID, signed URL singkat, metadata retensi sampai akhir tahun, serta cleanup
  objek bila transaksi pengajuan gagal.
- Supervisor dapat membuat/mengubah/menonaktifkan jenis cuti melalui RPC
  diaudit. Cuti Tahunan dilindungi sebagai jenis sistem dan tidak dapat
  dinonaktifkan atau diubah menjadi non-deducting.
- Persetujuan cuti memakai expected version, first-write-wins, dan larangan
  self-approval. Keputusan membuat audit/notifikasi; jadwal published yang
  terdampak menghasilkan notifikasi peninjauan roster dengan daftar assignment.
- Lembur mendukung pengajuan karyawan, penugasan supervisor, pembatalan,
  durasi rencana, aktual, dan disetujui. Tidak ada perhitungan pembayaran.
- Durasi aktual dihitung dari presensi selesai terhadap waktu akhir jadwal,
  mendukung zona waktu Jakarta/shift lintas tengah malam, minimal satu jam,
  dan dibulatkan ke bawah dalam kelipatan 30 menit.
- Jalur tulis langsung tabel jenis/saldo/pengajuan/dokumen/lembur dicabut dari
  client. Anonymous tidak dapat menjalankan RPC dan management tetap read-only.
- Migration lokal/hosted identik. Lint schema lokal/hosted bersih, pgTAP
  lokal/hosted lulus `192/192`, lint aplikasi, typecheck, production build,
  serta 14 E2E desktop/mobile lulus.

### Exit criteria

- AC-08, AC-09, AC-19, dan AC-20 lulus.
- Keputusan pertama mengunci walaupun dua supervisor memutuskan bersamaan.
- Saldo cuti konsisten setelah approve, reject, cancel, dan retry.
- Dokumen hanya dapat dibaca pihak yang diizinkan melalui signed URL.

---

## M5 — Presensi GPS, Geofence, dan Selfie (`DONE`)

### Tujuan

Mengganti simulasi presensi dengan clock-in/clock-out nyata yang aman dan
mobile-first.

### Pekerjaan

- Gunakan lokasi perangkat beserta accuracy; jangan hanya percaya koordinat
  yang dikirim client.
- Hitung jarak terhadap geofence outlet penempatan pada server/database.
- Wajibkan selfie portrait hanya pada clock-in kasir.
- Upload selfie ke bucket `attendance-selfies` dengan path yang ditetapkan
  ERD; simpan metadata pada `attendance_evidence`.
- Clock-out tidak meminta selfie.
- Hubungkan presensi ke jadwal bila ada dan hitung status terlambat/pulang
  lebih awal berdasarkan kebijakan aktif.
- Supervisor boleh clock-in di outlet mana pun dan jam berapa pun; durasi kerja
  tetap dihitung terhadap target delapan jam.
- Tangani izin kamera/lokasi ditolak, accuracy buruk, offline, retry, upload
  parsial, double tap, dan session terbuka.
- Pertahankan lifecycle kamera portrait dan mirroring yang sudah ditetapkan
  `AGENTS.md`.

### Exit criteria

- AC-03, AC-04, AC-05, dan aturan presensi supervisor lulus.
- Satu employee tidak dapat mempunyai dua sesi terbuka.
- Selfie tidak public dan tidak memiliki URL permanen.
- Retry tidak membuat record atau file ganda.
- Uji perangkat nyata dilakukan pada Android dan iOS/Safari bila tersedia.

### Status implementasi 28 Juli 2026

- Migration lokal/hosted menambahkan RPC workspace, clock-in idempotent, clock-out,
  Haversine server-side, batas accuracy, status jam kerja, audit, dan menutup
  jalur tulis langsung tabel presensi.
- UI live sudah dipisahkan dari mode demo; memakai Geolocation API, kamera
  portrait 480x640, selfie mirror, upload private, cleanup upload parsial, dan
  TanStack Query.
- UI menampilkan preview jarak/radius dari database, status lokasi/upload/
  penyimpanan, kondisi offline dan lokasi kedaluwarsa, pemilih outlet yang
  dapat dicari, serta riwayat berbahasa Indonesia. Retry sesudah respons
  jaringan terputus memakai event/file yang sama tanpa membuat duplikasi.
- Supervisor dapat memilih outlet aktif mana pun tanpa jadwal/selfie. Kasir
  wajib memiliki jadwal terbit, berada dalam satu jam sebelum shift, berada
  dalam geofence, dan mengambil selfie langsung dari kamera.
- pgTAP lokal/hosted `213/213` mencakup hak akses, preview geofence, accuracy buruk, luar
  geofence, selfie wajib, fleksibilitas supervisor, idempotensi, satu sesi,
  dan clock-out. Schema lint lokal/hosted, ESLint, TypeScript, production
  build, serta 14/14 E2E juga lulus setelah perbaikan UI.
- Pemilik produk mengonfirmasi alur presensi dan penyimpanan selfie berhasil
  pada perangkat yang tersedia. Pengujian iOS/Safari tetap menjadi cakupan
  pilot saat perangkat tersedia dan tidak menghalangi dimulainya retensi M6.

---

## M6 — Validasi Presensi dan Retensi File (`DEFERRED VERIFICATION`)

### Tujuan

Membuat supervisor memvalidasi presensi dan menjaga penggunaan Storage free
tier melalui penghapusan bukti yang dapat diaudit.

### Pekerjaan

- Buat pantauan clock-in dan inbox presensi pending validation.
- Tampilkan selfie melalui signed URL pendek hanya kepada pihak berwenang.
- Gunakan RPC validasi; jangan update status langsung.
- Jadwalkan setiap selfie terhapus tujuh hari setelah upload, tanpa
  mempercepatnya berdasarkan hasil validasi.
- Implementasikan worker idempotent untuk `file_deletion_jobs`; gunakan
  environment server-only dan retry/backoff.
- Setelah objek terhapus, isi `deleted_at` dan status retensi tanpa menghapus
  audit bisnis.
- Tambahkan monitoring sederhana untuk job gagal.

### Exit criteria

- AC-06, AC-07, AC-08, dan AC-09 lulus.
- Upload metadata selfie dan pembuatan deletion job terjadi atomik.
- Worker aman dijalankan berulang.
- File hilang dari Storage tetapi metadata keputusan tetap tersedia.
- Pengguna tidak dapat mengambil signed URL setelah retensi selesai.

### Status implementasi 29 Juli 2026

- Halaman Presensi live supervisor menampilkan waktu dan selfie private
  melalui signed URL dua menit sejak clock-in. Daftar diperbarui setiap 30
  detik, memisahkan jumlah sesi yang masih bekerja dan siap divalidasi, serta
  menampilkan waktu penghapusan otomatis pada detail selfie. Keputusan
  approve, reject, dan needs correction baru tersedia setelah clock-out dan
  tetap memakai RPC first-write-wins.
- Pembuatan metadata selfie otomatis membuat deletion job tepat tujuh hari
  setelah upload. Keputusan validasi tidak mempercepat jadwal tersebut.
  Vercel Cron memproses job jatuh tempo dengan claim bersyarat, backoff
  maksimal 24 jam, dan batas enam percobaan.
- Worker menandai metadata evidence sebagai deleted tanpa menghapus histori
  presensi, mencatat audit penghapusan, menganggap objek yang sudah tidak ada
  sebagai sukses idempotent. Monitoring supervisor membedakan job terjadwal,
  retry normal, jatuh tempo, lease worker tertahan, dan job yang berhenti
  setelah enam percobaan; status diperbarui setiap menit.
- Route cron dikecualikan secara spesifik dari redirect cookie aplikasi dan
  tetap menolak request tanpa bearer secret. Worker memulihkan job processing
  yang lease-nya kedaluwarsa; perubahan evidence, job, dan audit diselesaikan
  oleh RPC service-role dalam satu transaksi.
- Setiap invocation berotorisasi mencatat audit persisten
  `attendance_retention_worker` beserta status dan agregat hasil tanpa
  menyimpan secret atau path Storage. Perintah read-only
  `npm run attendance:verify-retention -- --cron-status` membedakan invocation
  otomatis melalui user agent resmi Vercel Cron.
- Pantauan supervisor membaca audit otomatis terbaru setiap menit dan
  menampilkan waktu invocation, jumlah job diperiksa/selesai, kegagalan job,
  serta peringatan bila scheduler tidak tercatat kembali lebih dari 26 jam.
- pgTAP lokal/hosted `235/235` mencakup finalisasi atomik, retry idempotent,
  hak akses isi roster massal, mode sel kosong idempotent, dan replace atomik.
  Lint, TypeScript, production build, serta 16/16 E2E desktop/mobile lulus.
- `CRON_SECRET` sudah dikonfigurasi dan deployment endpoint cron terverifikasi
  menolak request tanpa bearer dengan `401`. Isi roster massal ditambahkan
  untuk membuka jalur uji kasir tanpa mengisi seluruh bulan per sel.
- Invocation berotorisasi terhadap alias production berhasil mencapai worker
  dengan `200`. Selfie nyata yang sudah ada telah memperoleh deletion job
  tujuh hari dengan `scheduled_for = uploaded_at + 7 days`.
- Script verifikasi production read-only dan checklist operasional tersedia
  untuk memeriksa jadwal job, metadata, keberadaan objek, audit penghapusan,
  serta kegagalan akses signed URL tanpa mencetak secret atau path Storage.
- Pada 29 Juli 2026, API Vercel mengonfirmasi cron aktif pada deployment
  production untuk route `/api/internal/attendance-retention` dengan schedule
  `17 20 * * *`. Riwayat invocation 29 Juli tidak dapat diambil karena runtime
  log paket Hobby hanya disimpan satu jam; bukti persisten mulai tersedia
  setelah deployment audit invocation ini dan jadwal harian berikutnya.
- Smoke test production berotorisasi pada 29 Juli 2026 pukul 12.32 WIB
  menghasilkan HTTP `200` dengan `scanned: 0`, `completed: 0`, `failed: 0`.
  Audit `cron_completed` dengan agregat yang sama tersimpan di Supabase dan
  runtime log Vercel mencatat request GET production berstatus `200`. Bukti ini
  memvalidasi route, autentikasi, worker, serta audit persisten, tetapi tidak
  menggantikan bukti scheduler otomatis.
- Tersisa: setelah job selfie nyata jatuh tempo, verifikasi objek terhapus dan
  signed URL lama tidak dapat mengambil objek.
  Invocation otomatis Vercel berikutnya perlu dikonfirmasi melalui
  `--cron-status`. Pada paket Hobby, schedule tersebut dapat dijalankan kapan
  saja antara pukul 03.00-03.59 WIB, bukan wajib tepat pukul 03.17 WIB.
- Pada 29 Juli 2026, pemilik produk menyetujui penangguhan khusus untuk dua
  verifikasi berbasis waktu di atas agar M7 dapat dimulai. M6 belum berstatus
  selesai dan tetap menjadi gate wajib sebelum M8/pilot produksi.

---

## M7 — Roster Otomatis, Middle, dan Fairness (`DONE`)

### Tujuan

Menghasilkan roster bulanan yang valid dan seimbang, kemudian tetap dapat
diedit supervisor.

### Pekerjaan

- Pisahkan hard constraints dan soft constraints sesuai PRD.
- Terapkan satu off day per pekan dengan mekanisme peminjaman yang tercatat.
- Terapkan pagi sebelum off dan malam setelah off.
- Jika hanya tiga kasir aktif di outlet pada suatu hari, tetapkan tepat satu
  middle bila layak.
- Jatah middle maksimum satu kali per orang per pekan.
- Seimbangkan jumlah shift pagi/malam dan pertemuan pasangan kasir selama satu
  bulan.
- Hormati cuti approved, backup outlet, jam outlet, shift lock, dan perubahan
  manual.
- Simpan input, policy version, seed/tie-break, score, violations, dan output
  agar hasil dapat direproduksi.
- Jika tidak ada solusi, tampilkan alasan dan jangan mempublikasikan roster
  parsial sebagai roster valid.
- Supervisor dapat mengubah output dengan alasan dan mempublikasikan versi
  baru.

### Progres terverifikasi 29 Juli 2026

- Generator TypeScript murni `deterministic-matching-v1` menghasilkan output
  yang dapat direproduksi dari snapshot dan seed yang sama. Hard constraints
  divalidasi ulang sebelum hasil diberi status valid.
- Alokasi Middle memakai deterministic bipartite matching; Pagi/Malam memakai
  pemerataan jumlah shift dan frekuensi pasangan sebagai soft constraints.
- Snapshot supervisor dari Supabase mencakup kasir eligible, seluruh
  penempatan efektif dalam bulan, off day, cuti approved, shift manual
  terkunci, template shift, kebutuhan staf, serta policy version.
- Jatah pekan terakhir dapat memakai tanggal pada awal bulan berikutnya.
  Snapshot bulan pemilik membaca carry-out untuk validasi hak, sedangkan
  snapshot bulan berikutnya membaca tanggal aktual sebagai carry-in. Commit
  dan publish tetap memvalidasi assignment off serta pola Malam setelah off.
- Route Handler server-side menjalankan optimizer dan membentuk idempotency
  key dari input, seed, algoritma, serta output. Commit database memakai
  advisory lock dan satu transaksi untuk generation run, konflik, fairness,
  assignment, version draft, serta audit.
- Shift manual pada draft dipertahankan sebagai lock. Generator tidak membuat
  backup outlet otomatis; assignment lintas outlet hanya diterima bila sudah
  dibuat manual dengan alasan. Cuti tampil sebagai status read-only di matriks.
- Output invalid tidak mengganti assignment lama dan menampilkan konflik serta
  saran per tanggal. Output valid diterapkan sebagai draft dan tetap dapat
  dikoreksi manual sebelum publikasi.
- UI mobile-first menambahkan alur **Buat Otomatis**, ringkasan jumlah
  assignment, durasi, skor fairness, distribusi Pagi/Middle/Malam/Off per
  kasir, dan preview maksimal dua belas konflik.
- Delapan unit test mencakup fixture bulanan valid, determinisme, pola off,
  rentang carry-over lintas bulan, batas
  Middle, warning lebih dari enam hari kerja berturut-turut, konflik kapasitas,
  backup lintas outlet, perubahan penempatan efektif di tengah bulan, dan
  benchmark 200 kasir. Benchmark lokal selesai sekitar 223 ms, jauh di bawah
  target PRD 30 detik.
- Dua migration M7 dan satu migration koreksi carry-over sudah identik
  lokal/hosted. Lint schema `public` bersih, pgTAP lokal/hosted lulus
  `251/251`, lint, typecheck, build produksi, delapan unit test, serta
  `18/18` E2E desktop/mobile lulus.

### Exit criteria

- AC-10 sampai AC-15 lulus pada fixture kecil dan fixture satu bulan.
- Generator deterministik untuk input dan seed yang sama.
- Tidak ada hard constraint yang dilanggar pada roster berstatus valid.
- Laporan fairness dapat menjelaskan distribusi pagi, malam, middle, off, dan
  pasangan kerja.
- Waktu generate memenuhi target PRD pada ukuran pilot.

---

## M8 — Notifikasi, Laporan, Offline Read, dan Pilot Produksi (`IN PROGRESS`)

### Tujuan

Menutup MVP dengan komunikasi, laporan operasional, ketahanan jaringan, dan
observability yang layak dipakai pilot.

### Gate pilot dan pengecualian implementasi

M7 sudah selesai. Pada 29 Juli 2026 pemilik produk menyetujui implementasi
bagian non-pilot M8 dilanjutkan sementara koreksi/verifikasi cron ditunda.
Pengecualian ini tidak menghapus gate: M8 tidak boleh berstatus `DONE` dan
pilot produksi tidak boleh dinyatakan siap sampai M6 membuktikan:

1. invocation otomatis Vercel Cron tercatat oleh audit persisten; dan
2. satu selfie nyata yang melewati tujuh hari benar-benar hilang dari Storage,
   metadata/audit tetap tersedia, serta signed URL tidak lagi dapat mengambil
   objek.

Pemeriksaan `--cron-status` pada 29 Juli 2026 masih menghasilkan `WAIT`.

### Progres terverifikasi

- Migration `20260729160000_m8_communication_workflow.sql` identik lokal dan
  hosted.
- Pusat komunikasi live memakai RPC security-definer yang role-aware,
  target penerima termaterialisasi, read receipt tahan-refresh,
  acknowledgement, audit, dan Supabase Realtime dengan polling fallback.
- Supervisor dapat membuat pengumuman untuk seluruh perusahaan, satu outlet,
  atau satu karyawan. Management dapat melihat agregat tetapi seluruh mutasi
  komunikasi tetap ditolak.
- Header live memakai notifikasi Supabase; dashboard live membaca identitas,
  scope karyawan, status/riwayat presensi, pengajuan, dan validasi dari DAL
  Supabase tanpa fallback ke mock.
- Lint schema lokal/hosted bersih; pgTAP lokal/hosted `275/275`, lint,
  typecheck, build live/demo, delapan unit test, dan 18 E2E desktop/mobile
  lulus.
- Pekerjaan berikutnya: migrasi Laporan, export job besar, offline read yang
  menjaga privasi perangkat, observability/SOP, lalu pilot setelah gate M6.

### Pekerjaan

- Migrasikan pengumuman, target, read receipt, dan acknowledgement.
- Aktifkan notifikasi in-app/realtime untuk perubahan jadwal, keputusan,
  presensi pending, dan pengumuman.
- Migrasikan dashboard dan laporan ke view/query Supabase yang aman.
- Tambahkan export job untuk laporan besar; jangan membebani request interaktif.
- Cache jadwal dan data terakhir untuk offline read.
- Mutasi offline tetap ditolak dengan pesan jelas kecuali antrean aman telah
  dirancang dan diuji idempotensinya.
- Tambahkan error monitoring, audit review, backup/restore drill, dan panduan
  operasional.
- Jalankan pilot dengan data terbatas sebelum impor seluruh perusahaan.

### Exit criteria

- AC-21 dan AC-22 lulus.
- Role hanya menerima data dan notifikasi yang diizinkan.
- Dashboard tidak membaca mock data dalam mode live.
- Aplikasi memberikan state loading, empty, error, offline, dan retry yang
  jelas.
- Checklist keamanan, privasi, retensi, performa, dan rollback pilot disetujui.

---

## M9 — KPI Fase 2 (`BACKLOG`)

Milestone ini tidak boleh menghambat MVP. Mulai hanya setelah M8 stabil.

- Definisikan formula KPI sebagai policy versioned, bukan angka hard-coded.
- Gunakan data roster, presensi, validasi, lembur, cuti, dan audit dari MVP.
- Pisahkan data faktual, agregasi, target, score, dan override.
- Jelaskan asal setiap nilai KPI kepada pengguna.
- Jangan menambahkan payroll atau kalkulasi gaji.

---

## 5. Urutan dependensi

```text
B0–B2 selesai
    |
    v
M1 Auth & supervisor
    |
    v
M2 DAL & master data
    |
    v
M3 Jadwal manual ----------+
    |                       |
    v                       v
M4 Cuti/lembur         M5 Presensi
    |                       |
    +-----------+-----------+
                |
                v
        M6 Validasi & retensi
                |
                v
        M7 Roster otomatis
                |
                v
        M8 Pilot produksi
                |
                v
          M9 KPI Fase 2
```

M4 dan M5 boleh dikerjakan pada branch terpisah setelah M2/M3 stabil, tetapi
jangan menggabungkan migration atau perubahan halaman yang saling tumpang
tindih tanpa koordinasi.

---

## 6. Quality gate setiap milestone

Sebelum commit final milestone:

- [ ] Baca panduan Next.js 16 yang relevan di `node_modules/next/dist/docs/`.
- [ ] Gunakan CodeGraph sebelum membaca/mengubah kode yang terindeks.
- [ ] Pastikan `git status` dan perubahan milik pengguna tidak tertimpa.
- [ ] Migration baru dapat diterapkan dari database kosong.
- [ ] RLS diuji sebagai anonymous, employee, supervisor, dan management.
- [ ] Tidak ada secret/password/token pada diff atau output yang akan dibagikan.
- [ ] `npm run supabase:reset` lulus.
- [ ] `npm run supabase:lint` lulus.
- [ ] `npm run supabase:test` lulus.
- [ ] `npm run supabase:types` dijalankan bila schema berubah.
- [ ] `npm run lint` lulus.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run build` lulus.
- [ ] `npm run test:e2e` lulus.
- [ ] Alur mobile, keyboard, safe-area, loading, empty, error, dan retry diuji.
- [ ] `AGENTS.md`, README terkait, serta status dokumen ini diperbarui.
- [ ] Commit fokus dan branch/remote sinkron.

Untuk perubahan hosted:

- [x] Project ref diperiksa: `ttbogurultjbporryylb`.
- [x] `migration list --linked` diperiksa sebelum dan sesudah push.
- [x] Dua migration M7 dan satu koreksi carry-over diterapkan tanpa reset
  production.
- [x] Hosted lint dan pgTAP `251/251` lulus.
- [x] Tidak pernah melakukan reset production.

---

## 7. Input yang masih dibutuhkan dari pemilik produk

Input berikut diminta hanya ketika milestone terkait dimulai:

| Milestone | Input                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| M1        | Domain Vercel, identitas supervisor pertama, penempatan, password awal melalui kanal aman |
| M2        | Data karyawan, jabatan, status kerja, outlet, koordinat, radius, jam buka/tutup           |
| M3        | Template shift per outlet, pengecualian outlet, off day awal, aturan perubahan/publish    |
| M4        | Daftar final jenis cuti dan dokumen wajib                                                 |
| M5        | Hasil uji accuracy GPS perangkat nyata dan toleransi pilot                                |
| M6        | Bukti scheduler otomatis dan evidence nyata pascajatuh tempo tujuh hari                    |
| M8        | Pengguna pilot, SOP dukungan, kebutuhan laporan/export final                              |

Jangan mengarang data perusahaan nyata. Gunakan fixture sintetis sampai data
diberikan atau impor disetujui.

---

## 8. Protokol handoff untuk agent berikutnya

1. Baca dokumen wajib yang disebutkan pada bagian awal.
2. Periksa `git status`, branch, commit terbaru, dan status CI.
3. Verifikasi baseline dengan perintah yang proporsional terhadap milestone.
4. Bila belum ada `NEXT`, tutup gate verifikasi yang masih menahan milestone
   `BLOCKED`; jangan melewati bukti berbasis waktu dengan asumsi.
5. Ubah milestone itu menjadi `DONE` hanya setelah seluruh exit criteria lulus.
6. Ubah milestone berikutnya dari `BACKLOG` menjadi `NEXT`.
7. Catat keputusan baru, migration baru, risiko, dan pengujian yang benar-benar
   dijalankan.
8. Perbarui tanggal verifikasi dokumen ini.
9. Commit dan push hanya bila diminta atau sudah menjadi bagian eksplisit dari
   alur kerja pengguna.

Prompt singkat yang dapat diberikan kepada agent baru:

> Pelajari `AGENTS.md`, `PRD.md`, `ERD.md`,
> `IMPLEMENTATION_ROADMAP.md`, dan `supabase/README.md`. Periksa kondisi repo
> dan lanjutkan M8 dari migrasi Laporan/export serta rancangan offline read
> yang menjaga privasi perangkat. Implementasi non-pilot boleh berjalan,
> tetapi jangan nyatakan M6/M8 `DONE` atau mulai pilot sampai invocation cron
> otomatis dan penghapusan evidence nyata tujuh hari terverifikasi.
> Pertahankan data prototype sampai modul tersebut benar-benar dimigrasikan,
> jangan mengekspos secret, jangan reset Supabase hosted, jalankan seluruh
> quality gate milestone, lalu perbarui status handoff.
