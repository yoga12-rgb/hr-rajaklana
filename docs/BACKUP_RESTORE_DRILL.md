# Backup dan Restore Drill

## Batas keselamatan

Drill otomatis hanya bekerja pada container Supabase lokal yang label
project-nya cocok dengan `supabase/config.toml`. Script membuat logical backup
di dalam container, memulihkannya ke database disposable bernama
`hr_restore_drill_<timestamp>`, membandingkan tabel/fungsi/migration, lalu
menghapus database dan dump tersebut.

Script **tidak** terhubung ke project hosted, tidak membaca environment key,
dan tidak memulihkan data ke database `postgres` aktif.

## Menjalankan drill lokal

Pastikan local Supabase dan Docker aktif, lalu jalankan:

```bash
npm run operations:restore-drill
```

Hasil lulus wajib menampilkan:

- jumlah tabel `public` sumber dan hasil restore sama;
- jumlah fungsi `public` sama;
- ledger `supabase_migrations.schema_migrations` sama; dan
- checksum SHA-256 dump tercatat pada output.

Jalankan minimal sebelum pilot, setelah perubahan schema besar, dan secara
berkala selama pilot. Simpan tanggal, commit SHA, operator, serta hasil
PASS/FAIL—bukan file dump atau data pribadi—pada catatan operasional.

## Verifikasi backup hosted

Backup provider berbeda dari ekspor laporan aplikasi. Panel aplikasi sengaja
tidak pernah mengklaim backup provider sudah aktif.

Sebelum pilot:

1. Buka pengaturan database/backup pada Supabase Dashboard untuk project yang
   benar.
2. Verifikasi mekanisme backup yang tersedia pada paket aktif, waktu backup
   terakhir, retensi, dan prosedur restore yang ditawarkan.
3. Catat tanggal verifikasi, operator, dan bukti non-sensitif.
4. Jika paket aktif tidak menyediakan pemulihan yang memenuhi kebutuhan,
   tetapkan logical backup terenkripsi ke penyimpanan privat dengan akses
   terbatas dan uji restore di lingkungan terisolasi.

Jangan mengunduh atau menyimpan dump production di repository, folder sinkron
publik, atau perangkat yang tidak terenkripsi.

## Kriteria lulus sebelum pilot

- Drill lokal PASS pada commit yang akan dipilotkan.
- Mekanisme backup hosted dan retensinya sudah diverifikasi manual.
- Satu prosedur restore hosted sudah ditinjau tanpa menimpa project aktif.
- Pemilik operasi dan teknis memahami runbook insiden.
- Gate retensi selfie M6 tetap lulus secara terpisah; backup tidak menggantikan
  bukti cron otomatis dan penghapusan selfie tujuh hari.

## Hasil terbaru

Drill lokal 1 Agustus 2026 lulus setelah koreksi kebutuhan staf harian:
42 tabel, 79 fungsi, dan 35 ledger migration identik pada
database disposable. Artefak dump dan database drill sudah dibersihkan.
