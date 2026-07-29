# Fondasi Supabase HR Rajaklana

Folder ini berisi konfigurasi local stack dan migration database yang menjadi
sumber kebenaran schema HR Rajaklana.

## Menjalankan secara lokal

Prasyarat: Node.js 20+ dan Docker Desktop aktif.

```bash
npm install
copy .env.example .env.local
npm run supabase:start
```

Salin `API URL` dan `Publishable key` dari output Supabase CLI ke `.env.local`.
Stack ini memakai port `55320`-`55329` agar tidak berbenturan dengan project
Supabase lokal lain yang memakai port default.
Setelah itu:

```bash
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
npm run supabase:types
npm run dev
```

## Menghubungkan project hosted

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Jalankan `db pull` terlebih dahulu bila project hosted sudah memiliki schema.
Jangan menjalankan reset terhadap production.

## Keamanan

- Semua bucket bersifat private.
- Publishable key boleh digunakan browser karena akses tetap dibatasi RLS.
- Secret/service role key hanya boleh berada pada environment server.
- `auth.users` dibuat melalui alur supervisor di server, bukan sign-up publik.
- Keputusan cuti, lembur, koreksi presensi, dan validasi presensi wajib melalui
  RPC transaksional agar pemeriksaan versi, larangan self-approval, dan audit
  selalu berjalan bersama.
- Create/update/archive karyawan dan perubahan penempatan utama wajib melalui
  RPC master data agar riwayat outlet, status akun, dan audit tetap atomik.
  Koreksi tanggal efektif pada outlet yang sama memperbarui penempatan aktif
  dan menjaga batas akhir penempatan sebelumnya tetap berurutan.
- Create/update/status outlet wajib melalui RPC master data. Outlet dengan
  penempatan aktif tidak boleh dinonaktifkan dan tidak pernah di-hard-delete.
- Kebijakan kerja/cuti wajib diterbitkan melalui RPC versioned. Penerbitan
  presensi dan lembur dari satu formulir berjalan dalam satu transaksi.
- Perubahan template shift outlet wajib melalui RPC replacement. Template
  aktif lama dinonaktifkan, bukan ditimpa atau dihapus, agar jadwal historis
  tetap dapat diaudit. Client authenticated tidak memiliki hak tulis langsung
  pada kedua tabel historis tersebut.
- Impor XLSX karyawan wajib melalui `dry_run_employee_import` lalu
  `commit_employee_import`. File dibaca lokal di browser dan tidak disimpan;
  server menyimpan ringkasan, checksum payload, dan kesalahan per baris.
  Commit memvalidasi ulang payload yang sama dan berjalan atomik. Akun serta
  kata sandi tidak boleh dimasukkan ke template impor.
- Tabel historis roster tidak dapat ditulis langsung oleh client
  authenticated. Penyusunan manual, publikasi, acknowledgement, dan tukar
  shift wajib melalui RPC role-aware yang telah di-hardening dari akses
  anonymous.
- Isi jadwal massal wajib melalui `bulk_fill_manual_roster`. RPC hanya menerima
  kasir eligible/supervisor aktif, memakai outlet utama per tanggal, mendukung
  mode sel kosong atau replace, dan rollback seluruh rentang bila satu target
  tidak memiliki penempatan atau template shift aktif.
- Roster otomatis membaca snapshot melalui `get_roster_generation_input`,
  dijalankan oleh Route Handler server-side, lalu disimpan melalui
  `commit_generated_roster`. Commit memakai advisory lock dan idempotency key,
  menyimpan generation run/conflict/fairness/audit, mempertahankan shift manual
  sebagai lock, dan tidak menerapkan assignment bila hasil optimizer invalid.
- Generator tidak membuat backup outlet. Perpindahan lintas outlet tetap wajib
  dibuat manual dengan alasan; publish RPC tetap menjadi validasi akhir
  kelengkapan dan hard constraints sebelum roster aktif.
- Versi roster `published` bersifat immutable. Perubahan berikutnya membuat
  draft baru dari versi aktif; publikasi mengganti versi aktif secara atomik,
  menulis audit, dan membuat notifikasi/receipt baru.
- Off day yang dipinjam hanya boleh berasal dari pekan bersebelahan dan satu
  sumber pekan hanya dapat dialokasikan sekali per karyawan. Bulan pemilik
  jatah ditentukan oleh tanggal Senin awal pekan, sehingga pekan parsial pada
  awal bulan tidak dihitung ulang. Backup outlet
  serta minimum staffing divalidasi sebelum publikasi.
- Tukar shift dibatasi untuk kasir pada outlet dan versi roster yang sama.
  Persetujuan rekan harus selesai sebelum keputusan supervisor, dan keputusan
  pertama pada setiap tahap mengunci.
- Pengajuan cuti wajib melalui RPC. Cuti Tahunan otomatis memperoleh saldo
  sesuai kebijakan aktif, submission mereservasi saldo, dan approve/reject/
  cancel memindahkan atau melepaskan reservasi secara atomik.
- Dokumen cuti diunggah ke bucket private `leave-documents` dengan path UUID.
  Metadata hanya didaftarkan bersama pengajuan setelah objek diverifikasi;
  signed URL berlaku singkat dan file dijadwalkan retensi sampai akhir tahun.
- Pengajuan serta penugasan lembur menyimpan waktu dan durasi rencana.
  Durasi aktual dihitung dari clock-out terhadap akhir jadwal, minimal satu
  jam dan dibulatkan ke bawah dalam kelipatan 30 menit.
- Client tidak memiliki hak tulis langsung ke tabel cuti, saldo, attachment,
  atau lembur. Semua keputusan memakai expected version, first-write-wins,
  larangan self-approval, notifikasi, dan audit.
- Presensi live wajib melalui RPC `clock_in_attendance` dan
  `clock_out_attendance`; jarak Haversine, accuracy GPS, jadwal terbit,
  geofence, dan status waktu dihitung ulang di database.
- UI memakai `preview_attendance_geofence` untuk menampilkan jarak/radius
  sebelum submit. Hasil preview hanya feedback; RPC clock-in/out tetap
  menghitung dan memvalidasi ulang seluruh lokasi secara atomik.
- Selfie clock-in kasir disimpan pada bucket private `attendance-selfies`
  dengan path `<employee>/<YYYY>/<MM>/<DD>/<client-event>.jpg`. Upload yang
  belum terdaftar boleh dibersihkan pemilik, tetapi bukti yang sudah terhubung
  ke presensi tidak dapat dihapus client.
- Supervisor dapat presensi pada outlet aktif mana pun tanpa jadwal dan tanpa
  selfie; durasi dibandingkan dengan target delapan jam.
- Supervisor dapat memantau waktu dan selfie sejak clock-in melalui signed URL
  singkat. Keputusan validasi tetap menunggu clock-out dan memakai RPC
  first-write-wins. Pembuatan metadata selfie otomatis membuat deletion job
  untuk tujuh hari setelah upload; keputusan validasi tidak mempercepatnya.
  Worker server-only menghapus objek secara idempotent dan mempertahankan
  metadata.
- Endpoint cron retensi memerlukan `CRON_SECRET`. Secret hanya disimpan di
  environment Vercel dan tidak boleh memakai nilai publishable atau admin key.
- Proxy aplikasi melewatkan hanya path cron retensi yang eksplisit; Route
  Handler tetap menolak request tanpa bearer secret. Worker memulihkan lease
  processing yang macet dan memakai RPC service-role agar status job,
  metadata evidence, serta audit selesai atomik.
- Verifikasi production read-only tersedia melalui
  `npm run attendance:verify-retention -- --evidence-id <uuid>`. Tambahkan
  `--expect-deleted` hanya setelah cron pascajatuh tempo; checklist lengkap
  berada di `docs/ATTENDANCE_RETENTION_VERIFICATION.md`.
- Invocation worker berotorisasi mencatat audit persisten tanpa bearer secret
  atau path Storage. Gunakan
  `npm run attendance:verify-retention -- --cron-status` untuk memeriksa
  invocation otomatis Vercel terbaru setelah jadwal harian berjalan. Pantauan
  supervisor membaca audit yang sama dan memperingatkan invocation gagal atau
  scheduler yang tidak tercatat lebih dari 26 jam.
- Modul yang belum dimigrasikan tetap memakai `HRContext`; modul live tidak
  boleh melakukan fallback atau dual-write ke data prototype.
