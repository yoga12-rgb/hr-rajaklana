# Roster Optimizer M7

## Status

M7 selesai. Algoritma murni berada di `src/lib/roster/optimizer.ts`, sedangkan
`src/lib/roster/generation.ts` membentuk input bertipe dari snapshot Supabase,
menjalankan optimizer di server, dan mengirim hasil ke commit atomik. UI
supervisor tersedia melalui tombol **Buat Otomatis** pada halaman Jadwal.

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
- warning ketika penempatan off menimbulkan lebih dari enam hari kerja
  berturut-turut;
- Pagi sebelum off dan Malam setelah off;
- tepat satu Middle saat tiga kasir bekerja pada weekday, jika kapasitas
  memungkinkan; dua kasir atau weekend tidak membutuhkan Middle;
- maksimum satu Middle per kasir per pekan;
- kebutuhan minimum dan template shift outlet;
- perpindahan lintas outlet hanya melalui backup manual;
- pemerataan Pagi/Malam, distribusi Middle, dan pasangan kerja.

## Strategi

1. Normalisasi status tetap: off, cuti, dan shift terkunci.
2. Bentuk kebutuhan per outlet dan tanggal setelah off, cuti, dan backup;
   pilih target weekday/weekend berdasarkan jumlah kasir yang bekerja.
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

Sembilan fixture memeriksa roster bulanan empat kasir, reproduktibilitas, aturan
off, warning lebih dari enam hari kerja, batas Middle, keterbatasan kapasitas,
backup outlet, input yang tidak valid, perubahan penempatan efektif di tengah
bulan, konsistensi fairness report, serta target performa 200 kasir dalam 30
detik. Unit test menjadi bagian dari GitHub Quality Gate.

## Integrasi Supabase

1. `get_roster_generation_input` hanya dapat dipakai pengguna authenticated
   dan menolak peran selain supervisor di dalam fungsi.
2. `POST /api/roster/generate` menjalankan optimizer server-side; client hanya
   mengirim bulan.
3. `commit_generated_roster` memakai advisory lock dan idempotency key untuk
   menyimpan run, konflik, score detail, assignment, serta audit dalam satu
   transaksi.
4. Hasil invalid menyimpan konflik tanpa mengganti jadwal. Hasil valid
   mengganti assignment generator sebelumnya, tetapi mempertahankan perubahan
   manual sebagai shift terkunci.
5. UI menampilkan konflik, saran, fairness, jumlah assignment, dan durasi.

## Batas operasional

- Supervisor wajib menetapkan off day sebelum generate.
- Template shift aktif dan penempatan efektif tidak boleh memiliki jeda.
- Backup outlet tetap dibuat manual dengan alasan.
- Generator membuat draft, bukan mempublikasikan roster.
- Publish RPC tetap menjadi validasi database terakhir untuk kelengkapan dan
  seluruh hard constraint.
