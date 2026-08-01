# Verifikasi Retensi Selfie Presensi

Dokumen ini adalah checklist operasional read-only untuk menutup exit criteria
M6. Script tidak mengubah database atau Storage, tidak menjalankan worker, dan
tidak mencetak secret maupun path objek.

## Prasyarat

- `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SECRET_KEY` tersedia hanya pada
  environment lokal tepercaya.
- Target project harus `ttbogurultjbporryylb`.
- Jangan menyalin output yang memuat ID operasional ke kanal publik.

## Pemeriksaan sebelum jatuh tempo

Periksa evidence terbaru:

```bash
npm run attendance:verify-retention -- --latest
```

Atau kunci pemeriksaan pada satu evidence:

```bash
npm run attendance:verify-retention -- --evidence-id <uuid>
```

Hasil yang diharapkan:

- metadata presensi tersedia;
- deletion job `attendance_selfie_seven_day_retention` tersedia;
- `scheduled_for` tepat tujuh hari setelah `uploaded_at`;
- objek masih tersimpan privat selama masa retensi;
- keputusan boleh masih pending atau sudah tersimpan.

Status `WAIT` sebelum tenggat bukan kegagalan.

## Pemeriksaan setelah cron pascajatuh tempo

Jalankan setelah jadwal cron pertama yang terjadi sesudah batas retensi. Untuk
evidence production terbaru yang diunggah 31 Juli 2026 pukul 11.08 WIB,
pemeriksaan final dilakukan setelah cron 8 Agustus 2026 dalam jendela pukul
03.00-03.59 WIB karena batas retensinya 7 Agustus 2026 pukul 11.08 WIB:

```bash
npm run attendance:verify-retention -- --evidence-id <uuid> --expect-deleted
```

Seluruh pemeriksaan berikut harus `PASS`:

- job berstatus `completed` dan mempunyai `completed_at`;
- evidence berstatus `deleted` dan mempunyai `deleted_at`;
- objek tidak lagi ditemukan di bucket private;
- audit `delete_storage_object` tetap tersedia;
- metadata presensi dan keputusan final tetap tersedia;
- signed URL baru tidak dapat mengambil objek.

Script keluar dengan kode `1` bila menemukan inkonsistensi. Jangan memperbaiki
baris database secara manual. Simpan ringkasan error, periksa monitoring
supervisor dan log Vercel Cron, lalu perbaiki worker melalui migration/kode
versioned.

## Konfirmasi Vercel Cron

Setelah deployment yang mencatat audit invocation aktif, tunggu jadwal harian
berikutnya lalu jalankan:

```bash
npm run attendance:verify-retention -- --cron-status
```

Hasil `PASS` membuktikan request memakai user agent resmi `vercel-cron/1.0`,
berhasil melewati autentikasi route, menjalankan worker, dan menyimpan agregat
hasil secara persisten. Audit tidak menyimpan bearer secret maupun path
Storage. `scanned: 0` tetap sehat ketika belum ada job jatuh tempo.

Sebagai pemeriksaan tambahan pada dashboard Vercel:

1. Buka project production HR Rajaklana.
2. Buka **Logs** dan filter route
   `/api/internal/attendance-retention`.
3. Pastikan invocation otomatis memiliki status `200` dan waktu antara
   03.00-03.59 WIB.
4. Jangan menyalin nilai header `Authorization` atau `CRON_SECRET`.

Paket Hobby hanya menyimpan runtime log selama satu jam dan dapat menjalankan
cron kapan saja dalam jam yang dijadwalkan. Karena itu, audit persisten adalah
bukti utama setelah jendela log dashboard berakhir.

### Bukti smoke test terakhir

Pada 29 Juli 2026 pukul 12.32 WIB, invocation manual berotorisasi terhadap
alias production menghasilkan HTTP `200` dengan `scanned: 0`, `completed: 0`,
dan `failed: 0`. Audit `cron_completed` tersimpan dengan agregat yang sama dan
runtime log Vercel mencatat request GET production berstatus `200`.

Smoke test ini membuktikan route, bearer authentication, worker, koneksi
Supabase, dan audit persisten bekerja.

### Bukti scheduler otomatis

Pada 1 Agustus 2026 pukul 03.59 WIB, invocation otomatis Vercel Cron tercatat
oleh audit persisten dengan `scanned: 0`, `completed: 0`, dan `failed: 0`.
Perintah `--cron-status` menghasilkan `PASS`, sehingga bukti scheduler
otomatis M6 sudah terpenuhi. Gate M6 yang tersisa hanya penghapusan evidence
nyata setelah jatuh tempo beserta metadata, audit, dan kegagalan signed URL.
