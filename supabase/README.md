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
- Versi roster `published` bersifat immutable. Perubahan berikutnya membuat
  draft baru dari versi aktif; publikasi mengganti versi aktif secara atomik,
  menulis audit, dan membuat notifikasi/receipt baru.
- Off day yang dipinjam hanya boleh berasal dari pekan bersebelahan dan satu
  sumber pekan hanya dapat dialokasikan sekali per karyawan. Backup outlet
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
- Modul yang belum dimigrasikan tetap memakai `HRContext`; modul live tidak
  boleh melakukan fallback atau dual-write ke data prototype.
