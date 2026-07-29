# Runbook Operasional

Dokumen ini adalah panduan respons insiden untuk pilot HR Rajaklana. Semua
waktu operasional menggunakan zona `Asia/Jakarta`.

## Peran

- **Pelapor**: karyawan yang menemukan gangguan dan mengirim waktu, halaman,
  serta langkah yang dilakukan. Jangan mengirim selfie, kata sandi, token,
  atau screenshot yang memperlihatkan data orang lain.
- **Penanggung jawab operasional**: supervisor yang meninjau **Laporan →
  Kesehatan Operasional**, mencatat dampak, dan menjalankan langkah aman.
- **Penanggung jawab teknis**: pengelola repository/Supabase/Vercel yang dapat
  membaca log platform, menjalankan verifikasi read-only, dan melakukan
  rollback deployment.

Management hanya membaca status dan audit; management tidak menjalankan
mutasi supervisor.

## Tingkat insiden

| Tingkat | Contoh | Target respons |
| --- | --- | --- |
| P1 | Login seluruh pengguna gagal, data lintas akun terlihat, database tidak dapat diakses | Hentikan pilot dan respons segera |
| P2 | Presensi/roster/persetujuan gagal untuk banyak pengguna, job retensi atau ekspor kehabisan retry | Respons pada hari kerja yang sama |
| P3 | Gangguan satu akun, ekspor tertunda, tampilan tidak menghambat proses utama | Catat dan jadwalkan perbaikan |

## Triase pertama

1. Catat waktu mulai, peran pengguna, halaman, dan luas dampak.
2. Buka **Laporan → Kesehatan Operasional**, tekan refresh, lalu catat status
   tanpa menyalin payload sensitif.
3. Periksa deployment Vercel terakhir dan log fungsi terkait. Jangan menyalin
   cookie, bearer token, environment variable, atau body yang berisi data
   pribadi ke tiket.
4. Periksa Supabase Dashboard: kesehatan database, Auth, Storage, dan log API.
5. Tentukan apakah gangguan hanya UI, koneksi pengguna, atau mutasi database.

## Prosedur per area

### Retensi selfie

Jalankan pemeriksaan read-only:

```bash
npm run attendance:verify-retention -- --cron-status
npm run attendance:verify-retention -- --latest
```

Jika job `processing` tertahan atau retry habis, jangan menghapus object
Storage secara manual. Simpan bukti metadata, periksa invocation cron/worker,
kemudian gunakan jalur worker idempoten yang sudah tersedia. Checklist lengkap
ada di `docs/ATTENDANCE_RETENTION_VERIFICATION.md`.

### Ekspor laporan

- `scheduled` lebih dari 15 menit: periksa log route ekspor dan deployment.
- `processing` lebih dari 15 menit: perlakukan sebagai worker tertahan.
- `failed` dengan attempt di bawah tiga: pengguna dapat menekan **Ulangi**.
- Attempt tiga: jangan memaksa status database; catat job ID dari UI/log aman
  dan perbaiki penyebab worker terlebih dahulu.

### Generator roster

Generator berjalan sinkron dan idempoten. Run `scheduled`/`processing` lebih
dari 15 menit atau status `failed` menandakan anomali. Jangan menghapus
generation run; pertahankan snapshot aturan untuk audit dan buat draft baru
setelah penyebab diperbaiki.

### Otorisasi atau kebocoran data

1. Hentikan pilot untuk P1.
2. Jangan mengubah RLS langsung melalui Table Editor.
3. Catat role, RPC/halaman, dan waktu; hindari menyimpan payload pribadi.
4. Perbaiki lewat migration versioned, jalankan seluruh pgTAP, lalu deploy.
5. Review audit setelah perbaikan dan konfirmasi scope employee, supervisor,
   dan management secara terpisah.

## Pemulihan deployment

- Untuk regresi UI/server tanpa perubahan schema, rollback ke deployment
  Vercel terakhir yang diketahui sehat.
- Migration database bersifat maju. Jangan menjalankan rollback SQL ad-hoc di
  production. Buat migration korektif yang idempoten dan uji lokal.
- Setelah pemulihan, verifikasi login, dashboard, roster published, presensi,
  persetujuan, laporan, dan panel kesehatan operasional.

## Penutupan insiden

Catat kronologi, dampak, akar masalah, tindakan, hasil verifikasi, dan pemilik
tindak lanjut. Jangan menaruh secret, selfie, dokumen cuti, path Storage, atau
payload audit mentah di laporan insiden.
