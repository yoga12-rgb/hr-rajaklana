# Implementation Roadmap & Agent Handoff — HR Rajaklana

## Informasi dokumen

| Atribut | Nilai |
|---|---|
| Tujuan | Menjadi sumber acuan eksekusi untuk agent pengembang berikutnya |
| Terakhir diverifikasi | 24 Juli 2026 |
| Fase saat ini | Fondasi backend selesai; integrasi autentikasi dan data nyata belum dimulai |
| Branch utama | `main` |
| Supabase hosted | `https://ttbogurultjbporryylb.supabase.co` |
| Supabase project ref | `ttbogurultjbporryylb` |
| Dokumen produk | `PRD.md` |
| Model data | `ERD.md` |
| Aturan agent | `AGENTS.md` |

Dokumen ini adalah backlog teknis kanonis. Agent yang melanjutkan pekerjaan
wajib membaca `AGENTS.md`, `PRD.md`, `ERD.md`, dokumen ini, dan
`supabase/README.md` sebelum mengubah kode.

## Legenda status

- `DONE`: sudah diterapkan dan diverifikasi.
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
- Project hosted sudah terhubung dan empat migration berikut identik antara
  lokal dan remote:

| Migration | Fungsi |
|---|---|
| `20260724104032_initial_workforce_schema.sql` | Schema inti workforce |
| `20260724104038_secure_storage_and_rls.sql` | RLS, private Storage, RPC, dan keamanan |
| `20260724183617_enable_database_testing.sql` | Mengaktifkan pgTAP |
| `20260724183900_grant_cli_database_testing_access.sql` | Akses minimum role CLI untuk tes |

Verifikasi terakhir terhadap hosted project:

- Migration lokal dan remote cocok.
- Lint schema `public` tidak menemukan error.
- pgTAP lulus `10/10`.

### B3 — Batas baseline yang wajib dipahami

Fondasi backend sudah aktif, tetapi aplikasi belum menjadi aplikasi
multi-user:

- Seluruh halaman bisnis masih membaca dan memutasi `HRContext`.
- Belum ada halaman login, logout, perubahan kata sandi pertama, atau route
  protection.
- Belum ada akun supervisor bootstrap yang dikelola dari source code.
- Belum ada data karyawan/outlet nyata yang diimpor.
- Belum ada upload selfie nyata, worker penghapusan file, atau roster engine.
- Konfigurasi environment Vercel tidak dapat dianggap selesai hanya karena
  tersedia secara lokal; wajib diverifikasi dari deployment.

Jangan menyatakan suatu alur sudah memakai Supabase hanya karena tabel atau
client Supabase telah tersedia.

---

## 2. Lingkungan kerja

### 2.1 Stack dan lokasi penting

| Area | Lokasi |
|---|---|
| Halaman | `src/app/` |
| Komponen reusable | `src/components/ui/` |
| State prototype | `src/context/HRContext.tsx` |
| Supabase clients | `src/lib/supabase/` |
| Next.js session proxy | `src/proxy.ts` |
| Generated database types | `src/types/database.ts` |
| Migrations | `supabase/migrations/` |
| Database tests | `supabase/tests/database/` |
| E2E tests | `e2e/` |
| CI | `.github/workflows/quality.yml` |

Local Supabase memakai port `55320`–`55329` agar tidak berbenturan dengan
project lain. Jangan menghentikan container Supabase milik project lain.

### 2.2 Environment variables

Nama variabel yang diizinkan:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
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

## M1 — Environment, Authentication, dan Supervisor Pertama (`NEXT`)

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

## M2 — Data Access Layer dan Master Data (`BACKLOG`)

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

### Exit criteria

- Halaman master data pada mode live tidak membaca atau menulis `HRContext`.
- Refresh browser mempertahankan data karena berasal dari Supabase.
- Employee tidak dapat mengubah master data.
- Supervisor dapat mengelola data sesuai cakupan.
- Arsip tidak merusak relasi jadwal, presensi, atau audit.
- Quality gate aplikasi dan database lulus.

---

## M3 — Penjadwalan Manual, Off Day, dan Versi Roster (`BACKLOG`)

### Tujuan

Menyediakan fondasi jadwal nyata yang cukup untuk presensi sebelum roster
otomatis dibuat.

### Pekerjaan

- Migrasikan template shift dan jam operasional outlet, termasuk outlet yang
  tutup lebih awal.
- Implementasikan off day supervisor dan karyawan.
- Dukung peminjaman jatah off pekan berikutnya dengan ledger/audit yang jelas.
- Implementasikan draft, publish, superseded version, serta acknowledgement.
- Implementasikan perubahan manual dengan alasan wajib dan audit.
- Implementasikan backup outlet dan tukar shift dengan persetujuan atomik.
- Pastikan jadwal sebelum off adalah pagi dan setelah off adalah malam ketika
  aturan tersebut berlaku.
- Belum membuat optimizer roster otomatis pada milestone ini.

### Exit criteria

- Supervisor dapat menyusun, mengubah, dan mempublikasikan jadwal satu bulan.
- Karyawan dapat melihat jadwal seluruh kasir dengan kolom yang diizinkan.
- Perubahan setelah publish membuat versi/audit yang dapat ditelusuri.
- Backup outlet dan tukar shift memenuhi AC-16, AC-17, dan AC-18.
- Konflik jadwal dan keputusan ganda ditolak database.

---

## M4 — Cuti, Izin, dan Lembur (`BACKLOG`)

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

### Exit criteria

- AC-08, AC-09, AC-19, dan AC-20 lulus.
- Keputusan pertama mengunci walaupun dua supervisor memutuskan bersamaan.
- Saldo cuti konsisten setelah approve, reject, cancel, dan retry.
- Dokumen hanya dapat dibaca pihak yang diizinkan melalui signed URL.

---

## M5 — Presensi GPS, Geofence, dan Selfie (`BACKLOG`)

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

---

## M6 — Validasi Presensi dan Retensi File (`BACKLOG`)

### Tujuan

Membuat supervisor memvalidasi presensi dan menjaga penggunaan Storage free
tier melalui penghapusan bukti yang dapat diaudit.

### Pekerjaan

- Buat inbox presensi pending validation.
- Tampilkan selfie melalui signed URL pendek hanya kepada pihak berwenang.
- Gunakan RPC validasi; jangan update status langsung.
- Saat approve, jadwalkan penghapusan selfie segera.
- Saat reject/needs correction, pertahankan bukti sesuai retensi PRD, maksimal
  30 hari untuk bukti yang ditolak.
- Implementasikan worker idempotent untuk `file_deletion_jobs`; gunakan
  environment server-only dan retry/backoff.
- Setelah objek terhapus, isi `deleted_at` dan status retensi tanpa menghapus
  audit bisnis.
- Tambahkan monitoring sederhana untuk job gagal.

### Exit criteria

- AC-06, AC-07, AC-08, dan AC-09 lulus.
- Approve, audit, dan pembuatan deletion job terjadi atomik.
- Worker aman dijalankan berulang.
- File hilang dari Storage tetapi metadata keputusan tetap tersedia.
- Pengguna tidak dapat mengambil signed URL setelah retensi selesai.

---

## M7 — Roster Otomatis, Middle, dan Fairness (`BACKLOG`)

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

### Exit criteria

- AC-10 sampai AC-15 lulus pada fixture kecil dan fixture satu bulan.
- Generator deterministik untuk input dan seed yang sama.
- Tidak ada hard constraint yang dilanggar pada roster berstatus valid.
- Laporan fairness dapat menjelaskan distribusi pagi, malam, middle, off, dan
  pasangan kerja.
- Waktu generate memenuhi target PRD pada ukuran pilot.

---

## M8 — Notifikasi, Laporan, Offline Read, dan Pilot Produksi (`BACKLOG`)

### Tujuan

Menutup MVP dengan komunikasi, laporan operasional, ketahanan jaringan, dan
observability yang layak dipakai pilot.

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

- [ ] Project ref diperiksa: `ttbogurultjbporryylb`.
- [ ] `migration list --linked` diperiksa sebelum dan sesudah push.
- [ ] Dry-run diperiksa.
- [ ] Hosted lint dan pgTAP lulus.
- [ ] Tidak pernah melakukan reset production.

---

## 7. Input yang masih dibutuhkan dari pemilik produk

Input berikut diminta hanya ketika milestone terkait dimulai:

| Milestone | Input |
|---|---|
| M1 | Domain Vercel, identitas supervisor pertama, penempatan, password awal melalui kanal aman |
| M2 | Data karyawan, jabatan, status kerja, outlet, koordinat, radius, jam buka/tutup |
| M3 | Template shift per outlet, pengecualian outlet, off day awal, aturan perubahan/publish |
| M4 | Daftar final jenis cuti dan dokumen wajib |
| M5 | Hasil uji accuracy GPS perangkat nyata dan toleransi pilot |
| M6 | Retensi final untuk bukti reject/correction dan frekuensi worker |
| M7 | Dataset satu bulan untuk mengukur fairness dan kasus outlet kekurangan staf |
| M8 | Pengguna pilot, SOP dukungan, kebutuhan laporan/export final |

Jangan mengarang data perusahaan nyata. Gunakan fixture sintetis sampai data
diberikan atau impor disetujui.

---

## 8. Protokol handoff untuk agent berikutnya

1. Baca dokumen wajib yang disebutkan pada bagian awal.
2. Periksa `git status`, branch, commit terbaru, dan status CI.
3. Verifikasi baseline dengan perintah yang proporsional terhadap milestone.
4. Kerjakan hanya milestone pertama berstatus `NEXT`.
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
> dan mulai hanya dari milestone pertama yang berstatus `NEXT`. Pertahankan
> data prototype sampai modul tersebut benar-benar dimigrasikan, jangan
> mengekspos secret, jangan reset Supabase hosted, jalankan seluruh quality
> gate milestone, lalu perbarui status handoff.
