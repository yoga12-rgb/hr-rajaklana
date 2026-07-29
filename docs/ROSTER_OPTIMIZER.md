# Roster Optimizer M7

## Status

Fondasi algoritma M7 tersedia sebagai fungsi TypeScript murni di
`src/lib/roster/optimizer.ts`. Fungsi ini belum membaca atau menulis database;
integrasi input Supabase, commit atomik, dan UI supervisor masih menjadi tahap
berikutnya.

## Kontrak deterministik

- Input terdiri dari bulan, seed, kasir eligible, penempatan outlet, off day,
  cuti approved, shift yang dikunci, template shift, dan kebutuhan staf.
- Input yang sama dengan seed yang sama harus menghasilkan output, urutan
  konflik, dan fairness report yang sama.
- Snapshot aturan menyimpan versi algoritma, seed, hard constraints, dan bobot
  fairness agar satu hasil dapat dijelaskan serta direproduksi.
- Output berstatus `invalid` jika ada konflik blocking. Output invalid tidak
  boleh dipublikasikan sebagai roster valid.

## Aturan yang sudah dicakup

- tepat satu status per kasir aktif per hari;
- off dan cuti tidak dapat diberi shift;
- satu jatah off untuk setiap pekan yang dimiliki bulan tersebut;
- peminjaman off hanya dari pekan bersebelahan dalam bulan pemilik yang sama;
- Pagi sebelum off dan Malam setelah off;
- tepat satu Middle saat tiga kasir tersedia, jika kapasitas memungkinkan;
- maksimum satu Middle per kasir per pekan;
- kebutuhan minimum dan template shift outlet;
- perpindahan lintas outlet hanya melalui backup manual;
- pemerataan Pagi/Malam, distribusi Middle, dan pasangan kerja.

## Strategi

1. Normalisasi status tetap: off, cuti, dan shift terkunci.
2. Bentuk kebutuhan per outlet dan tanggal.
3. Alokasikan Middle mingguan dengan deterministic bipartite matching.
4. Terapkan pola wajib di sekitar off day.
5. Isi Pagi/Malam secara greedy berdasarkan jumlah shift, frekuensi pasangan,
   dan seeded tie-break.
6. Keluarkan konflik blocking serta fairness report per kasir.

Pendekatan matching dipakai untuk Middle agar generator tidak gagal hanya
karena urutan greedy ketika sebenarnya masih ada kombinasi yang valid.

## Pengujian

Jalankan:

```bash
npm run test:unit
```

Fixture saat ini memeriksa roster bulanan empat kasir, reproduktibilitas,
aturan off, batas Middle, keterbatasan kapasitas, backup outlet, input yang
tidak valid, konsistensi fairness report, serta target performa 200 kasir
dalam 30 detik. Unit test menjadi bagian dari GitHub Quality Gate.

## Tahap integrasi berikutnya

1. Bentuk snapshot input dari Supabase melalui operasi khusus supervisor.
2. Jalankan optimizer di server agar output tidak dapat dimanipulasi client.
3. Commit generation run, konflik, score detail, dan draft assignment secara
   atomik.
4. Tambahkan preview hasil/conflict/fairness mobile-first sebelum supervisor
   mengganti draft.
5. Tambahkan fixture multi-outlet, perubahan penempatan efektif, cuti, dan
   ukuran pilot untuk menutup exit criteria M7.
