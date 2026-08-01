# Verifikasi Kesiapan Pilot

`npm run operations:verify-pilot` adalah pemeriksaan production read-only untuk
mencegah pilot dimulai hanya berdasarkan asumsi bahwa fitur sudah tersedia.
Script mengunci target ke project Supabase yang benar dan tidak mengubah
database maupun Storage.

## Cakupan

Pemeriksaan mengagregasi:

- supervisor aktif, outlet aktif, dan kasir eligible roster;
- akun karyawan yang aktif serta sudah menyelesaikan perubahan kata sandi;
- outlet kandidat dengan minimal tiga kasir siap, penempatan utama efektif,
  serta template dan kebutuhan staf Pagi/Middle/Malam yang cocok dengan jumlah
  kasir siap di outlet;
- policy attendance, leave, overtime, dan roster yang efektif;
- job retensi jatuh tempo/retry habis/lease tertahan;
- job ekspor laporan yang menghabiskan retry; dan
- audit invocation otomatis Vercel Cron terbaru.

Script tidak mencetak nama, email, UUID, path Storage, error mentah, bearer
token, publishable key, atau service-role key. Gunakan `--json` bila output
akan dibaca oleh agent atau otomasi internal.

## Interpretasi

- `PASS`: pemeriksaan tersebut memenuhi syarat.
- `WAIT`: menunggu bukti berbasis waktu atau pemeriksaan manual; command tetap
  berakhir sukses.
- `BLOCKED`: ada prasyarat teknis yang belum terpenuhi; command berakhir gagal.

Hasil keseluruhan tidak pernah menjadi `PASS` sebelum backup hosted, bukti
retensi selfie tujuh hari, dan pilihan scope pilot dicatat melalui checklist.
Verifier tidak menggantikan pemeriksaan khusus berikut:

```bash
npm run attendance:verify-retention -- --cron-status
npm run attendance:verify-retention -- --evidence-id <uuid> --expect-deleted
```

## Baseline 1 Agustus 2026

- Supervisor aktif: 1 (`PASS`).
- Outlet aktif: 1 (`PASS`).
- Kasir eligible roster: 4 (`PASS`).
- Akun karyawan siap: 4 (`PASS`).
- Outlet kandidat pilot: 0 (`BLOCKED`; kebutuhan staf efektif belum diatur).
- Empat policy aktif dan antrean operasional sehat (`PASS`).
- Cron otomatis tercatat 1 Agustus 2026 pukul 03.59 WIB (`PASS`).
- Evidence terbaru jatuh tempo 7 Agustus 2026 pukul 11.08 WIB (`WAIT`).
- Backup hosted dan persetujuan scope pilot (`WAIT`).

Jangan menambahkan akun atau memilih pengguna pilot melalui script ini.
Pembuatan akun tetap dilakukan supervisor dari UI, dan scope pilot tetap
memerlukan persetujuan pemilik produk.

Kebutuhan staf dapat diatur oleh supervisor melalui **Pengaturan → Kebijakan
Kerja → Kebutuhan Staf Outlet**. Untuk kondisi empat kasir, konfigurasi awal
yang aman adalah minimum satu orang pada Pagi, Middle, dan Malam; satu kasir
tersisa dapat dipakai optimizer untuk pemerataan atau backup.
