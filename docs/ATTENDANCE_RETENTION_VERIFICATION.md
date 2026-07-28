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
evidence pilot 28 Juli 2026, pemeriksaan final dilakukan setelah cron
5 Agustus 2026 pukul 03.17 WIB:

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

Pada dashboard Vercel:

1. Buka project production HR Rajaklana.
2. Buka **Logs** dan filter route
   `/api/internal/attendance-retention`.
3. Pastikan invocation otomatis memiliki status `200` dan waktu sekitar
   03.17 WIB.
4. Jangan menyalin nilai header `Authorization` atau `CRON_SECRET`.

Respons worker yang sehat dapat berisi `scanned: 0` ketika belum ada job jatuh
tempo. Ini tetap membuktikan scheduler dan autentikasi cron berjalan.
