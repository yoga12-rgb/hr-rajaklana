# Checklist Pilot Produksi

Status saat ini: **BELUM BOLEH DIMULAI**. Invocation cron otomatis sudah
terverifikasi, tetapi penghapusan evidence nyata M6, backup hosted, kesiapan
akun karyawan, dan persetujuan scope pilot belum selesai.

## Gate wajib

- [x] Invocation otomatis Vercel Cron tercatat pada audit persisten pada
      1 Agustus 2026 pukul 03.59 WIB.
- [ ] Satu selfie nyata melewati tujuh hari, object Storage terhapus,
      metadata/audit tetap tersedia, dan signed URL lama tidak berlaku.
- [x] Restore drill lokal lulus pada schema yang akan dipilotkan.
- [ ] Mekanisme backup hosted, retensi, dan prosedur restore diverifikasi.
- [ ] Quality Gate commit pilot lulus di GitHub Actions.
- [ ] Pemilik produk menyetujui outlet dan pengguna pilot.
- [ ] Runbook dukungan serta jalur eskalasi dibagikan ke supervisor pilot.

## Pemeriksaan read-only

Jalankan dari environment operator yang memiliki konfigurasi hosted:

```bash
npm run operations:verify-pilot
```

Hasil `WAIT` berarti bukti manual atau berbasis waktu belum lengkap. Hasil
`BLOCKED` berarti prasyarat teknis harus diperbaiki sebelum pilot. Pemeriksaan
1 Agustus 2026 menemukan empat akun karyawan siap dan satu outlet kandidat
teknis. Override kebutuhan staf tidak wajib karena komposisi default memakai
jumlah kasir bekerja setelah off/cuti/backup dan jenis hari. Detail kontrak
output berada di
`docs/PILOT_READINESS_VERIFICATION.md`.

## Scope awal

- Gunakan satu outlet dan kelompok kecil pengguna yang disetujui.
- Jangan mengimpor seluruh perusahaan pada tahap pertama.
- Catat versi policy, template shift, radius geofence, dan bobot optimizer.
- Management menguji seluruh halaman sebagai read-only.
- Employee menguji bahwa roster hanya menampilkan nama, outlet, tanggal, shift,
  jam, off day, dan status backup.

## Smoke test sebelum membuka pilot

1. Login pertama dan perubahan kata sandi.
2. Buat satu akun karyawan pilot dan verifikasi scope RLS.
3. Susun/generate draft roster, koreksi konflik, publish, dan acknowledgement.
4. Clock-in employee dengan GPS+selfie, preview supervisor, clock-out, dan
   validasi.
5. Ajukan dan putuskan cuti/izin serta lembur dengan akun berbeda.
6. Terima notifikasi/pengumuman dan simpan acknowledgement.
7. Buka dashboard/laporan live, ekspor pendek dan panjang.
8. Buka roster saat offline; pastikan mutasi ditolak dengan pesan jelas.
9. Buka **Laporan → Kesehatan Operasional** dan pastikan tidak ada indikator
   kritis yang tidak dijelaskan.

## Observasi selama pilot

Catat tanpa data pribadi:

- waktu penyusunan roster dibanding proses manual;
- konflik optimizer dan koreksi supervisor;
- skor Pagi/Malam, Middle, dan pasangan kerja;
- keberhasilan/akurasi GPS pada perangkat nyata;
- waktu validasi presensi;
- job retensi/ekspor tertunda atau retry;
- kebingungan pengguna dan kebutuhan laporan final.

## Kriteria stop

Hentikan pilot bila ada kebocoran lintas akun, mutasi management berhasil,
presensi/roster gagal secara luas, data published hilang, atau backup/restore
tidak dapat dipastikan. Ikuti `docs/OPERATIONS_RUNBOOK.md`.

## Penutupan pilot

Pilot baru dapat diperluas setelah temuan ditriase, bobot/ambang yang berubah
diterbitkan sebagai versi baru, seluruh insiden P1/P2 ditutup, dan pemilik
produk menyetujui hasil pilot.
