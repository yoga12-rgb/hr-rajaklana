# Product Requirements Document — HR Rajaklana

## Informasi dokumen

| Atribut | Nilai |
| --- | --- |
| Produk | HR Rajaklana |
| Versi PRD | 2.0 |
| Tanggal | 24 Juli 2026 |
| Status | Draft untuk review pemilik produk |
| Platform | Mobile-first Progressive Web App (PWA) |
| Backend target | Supabase PostgreSQL, Auth, Storage, dan Realtime |
| Deployment target | Vercel |
| Sumber kebutuhan | Sesi discovery bisnis bersama pemilik produk |

## 1. Ringkasan produk

HR Rajaklana adalah sistem HR dan workforce operations terpadu untuk mengelola karyawan, roster kasir, presensi berbasis geofence, cuti, lembur, komunikasi operasional, serta laporan lintas outlet.

Produk dirancang untuk 6–15 outlet dan maksimal sekitar 200 pengguna pada tahap awal. Karyawan menggunakan PWA melalui ponsel, sedangkan supervisor dan manajemen dapat menggunakan ponsel maupun desktop.

HR Rajaklana tidak mempunyai peran Admin HR. Pengelolaan operasional dilakukan oleh tiga jenis supervisor yang memiliki wewenang sistem setara:

- Supervisor Penjualan & SDM.
- Supervisor Sarana & Prasarana.
- Supervisor Stock Outlet.

Manajemen memiliki akses laporan yang bersifat read-only.

## 2. Visi

Menyediakan satu sumber data operasional yang:

- Mempercepat penyusunan roster bulanan.
- Membagi shift kasir secara adil.
- Memastikan presensi dilakukan di lokasi yang sah.
- Membuat setiap keputusan supervisor transparan dan dapat diaudit.
- Mengurangi pekerjaan administrasi manual.
- Tetap mudah digunakan melalui ponsel di lingkungan operasional.

## 3. Sasaran produk

1. Menghasilkan draft roster bulanan otomatis berdasarkan kebutuhan outlet dan off day.
2. Menyeimbangkan distribusi shift Pagi, Middle, Malam, serta pertemuan kerja antarkasir.
3. Memvalidasi presensi menggunakan GPS geofence dan selfie clock-in.
4. Menyediakan alur persetujuan yang cepat tanpa persetujuan diri sendiri.
5. Menyediakan laporan operasional yang dapat diekspor ke PDF dan Excel.
6. Menjaga penggunaan Supabase Storage tetap rendah melalui retensi file otomatis.
7. Menyediakan data historis yang siap digunakan oleh modul KPI pada fase berikutnya.

## 4. Di luar cakupan MVP

- Penggajian, slip gaji, remunerasi, atau perhitungan pembayaran lembur.
- Modul persediaan atau stok outlet.
- Modul sarana, prasarana, dan aset.
- Pengenalan wajah biometrik.
- Rekomendasi otomatis kandidat backup lintas outlet.
- Penggunaan penuh ketika offline.
- Modul KPI; KPI ditempatkan pada Fase 2.
- Dukungan multibahasa.
- Dukungan banyak perusahaan atau multi-tenant.

## 5. Peran pengguna

### 5.1 Karyawan/Kasir

Karyawan dapat:

- Melihat dan memperbarui data pribadi yang diizinkan.
- Melihat jadwal seluruh kasir.
- Melihat presensi, saldo cuti, pengajuan, dan notifikasi milik sendiri.
- Melakukan clock-in dan clock-out.
- Mengajukan koreksi presensi.
- Mengajukan cuti dan lembur.
- Menerima penugasan lembur.
- Mengajukan pertukaran shift dengan kasir dari outlet yang sama.
- Mengonfirmasi bahwa perubahan roster sudah dibaca.

Karyawan tidak dapat melihat presensi, saldo cuti, dokumen, kontak pribadi, atau pengajuan milik karyawan lain.

### 5.2 Supervisor

Ketiga jenis supervisor memiliki hak akses sistem yang setara. Supervisor dapat:

- Mengelola data karyawan, status kerja, outlet, shift, dan kebijakan.
- Membuat akun serta kata sandi awal pengguna.
- Mengganti kata sandi pengguna yang lupa dengan kata sandi sementara.
- Menentukan dan memindahkan off day.
- Membuat, meninjau, memublikasikan, dan mengubah roster.
- Menetapkan kasir sebagai backup outlet lain secara manual.
- Memutuskan pengajuan, validasi presensi, dan koreksi.
- Membuat pengumuman.
- Melihat seluruh laporan dan audit trail.
- Mengimpor data awal dan mengunduh arsip.

Supervisor tidak dapat:

- Menyetujui presensi atau pengajuannya sendiri.
- Melihat kata sandi aktif pengguna.
- Mengubah keputusan yang sudah dikunci tanpa membuat peristiwa koreksi baru.

### 5.3 Manajemen/Pimpinan

Manajemen mempunyai akses read-only untuk:

- Dashboard.
- Laporan.
- Statistik.
- Audit trail.

Manajemen tidak dapat mengubah data atau memutuskan pengajuan.

### 5.4 Matriks hak akses

| Kapabilitas | Karyawan | Supervisor | Manajemen |
| --- | :---: | :---: | :---: |
| Melihat data pribadi | Ya | Ya, semua | Ya, read-only |
| Melihat jadwal seluruh kasir | Ya | Ya | Ya |
| Mengelola data karyawan | Tidak | Ya | Tidak |
| Mengelola outlet dan kebijakan | Tidak | Ya | Tidak |
| Mengatur off day | Tidak | Ya | Tidak |
| Generate/publish roster | Tidak | Ya | Tidak |
| Clock-in/clock-out | Ya | Ya | Tidak |
| Memvalidasi presensi orang lain | Tidak | Ya | Tidak |
| Mengajukan cuti/lembur/koreksi | Ya | Ya | Tidak |
| Memutuskan pengajuan orang lain | Tidak | Ya | Tidak |
| Menyetujui pengajuan sendiri | Tidak | Tidak | Tidak |
| Membuat pengumuman | Tidak | Ya | Tidak |
| Mengekspor laporan | Tidak | Ya | Ya |
| Melihat audit trail | Tidak | Ya | Ya |

## 6. Struktur organisasi dan outlet

- Sistem digunakan oleh satu perusahaan dengan banyak outlet.
- Setiap karyawan mempunyai satu penempatan utama.
- Riwayat perpindahan penempatan harus disimpan.
- Karyawan dapat ditugaskan sementara sebagai backup outlet lain oleh supervisor.
- Supervisor dapat presensi di outlet resmi mana pun.
- Setiap outlet menyimpan alamat, koordinat, radius geofence, jam operasional, template shift, serta kebutuhan minimum staf.
- Outlet dapat memiliki jam tutup dan template shift yang berbeda.
- Hari libur nasional tidak mengubah operasional atau algoritma roster.

## 7. Kebutuhan fungsional

### 7.1 Autentikasi dan akun

1. Login menggunakan email dan kata sandi melalui Supabase Auth.
2. Supervisor membuat email dan kata sandi awal.
3. Pengguna wajib mengganti kata sandi pada login pertama.
4. Jika pengguna lupa kata sandi, supervisor dapat menetapkan kata sandi sementara baru.
5. Pengguna wajib mengganti kata sandi setelah login menggunakan hasil reset.
6. Sistem tidak boleh menyimpan kata sandi dalam tabel aplikasi.
7. Supervisor tidak dapat melihat kata sandi aktif.
8. Pembuatan akun, reset kata sandi, penonaktifan akun, dan perubahan peran dicatat tanpa menyimpan nilai kata sandi.

### 7.2 Data karyawan

Data karyawan minimum:

- NIK.
- Nama lengkap.
- Email login.
- Nomor telepon.
- Tanggal lahir.
- Alamat.
- Tanggal masuk.
- Status kerja.
- Jabatan.
- Outlet utama.
- Kontak darurat.

Aturan:

- NIK dibuat otomatis dengan format `RK-TAHUN-NOMOR`, contoh `RK-2026-001`.
- NIK dapat dikoreksi supervisor dan harus unik.
- Status kerja dapat dibuat, dinonaktifkan, dan diurutkan supervisor.
- Data awal status kerja: Tetap, Kontrak, dan Magang.
- Karyawan yang keluar dinonaktifkan dan diarsipkan menggunakan soft delete.
- Riwayat operasional karyawan nonaktif tetap tersedia.
- Data awal dapat diimpor dari template Excel/XLSX dan divalidasi sebelum disimpan.

### 7.3 Template shift dan kebutuhan outlet

Template umum:

- Pagi: 07.00–15.00.
- Middle: 12.00–20.00.
- Malam: 15.00–23.00.

Setiap outlet dapat mengganti waktu ketiga kategori tersebut agar sesuai jam operasionalnya.

Setiap outlet dapat mengatur kebutuhan minimum per shift. Nilai awal:

| Kasir tersedia | Komposisi awal |
| ---: | --- |
| 2 | 1 Pagi + 1 Malam |
| 3 | 1 Pagi + 1 Middle + 1 Malam |
| 4 | 2 Pagi + 2 Malam |

Kebutuhan outlet yang dikonfigurasi mempunyai prioritas lebih tinggi daripada nilai awal.

### 7.4 Off day

1. Setiap kasir memperoleh satu off day per pekan.
2. Supervisor menentukan off day sebelum roster dibuat.
3. Off day dapat dipindahkan antara pekan berjalan dan pekan berikutnya dalam bulan yang sama.
4. Pemindahan dapat menghasilkan dua off day pada satu pekan dan nol pada pekan berikutnya.
5. Total hak off day tetap harus dipertahankan.
6. Sistem memberi peringatan jika hasilnya menyebabkan lebih dari enam hari kerja berturut-turut.
7. Supervisor dapat melanjutkan setelah mengisi alasan.
8. Supervisor juga mempunyai jadwal off day yang dapat diubah.

### 7.5 Roster otomatis

Roster otomatis hanya berlaku bagi karyawan dengan jabatan Kasir. Jadwal supervisor dikelola melalui aturan presensi dan off day yang terpisah.

#### 7.5.1 Input algoritma

- Periode satu bulan.
- Karyawan kasir aktif.
- Outlet utama dan penempatan backup sementara.
- Template shift setiap outlet.
- Kebutuhan minimum staf setiap outlet dan shift.
- Off day.
- Cuti yang sudah disetujui.
- Jadwal atau pengecualian manual yang dikunci.
- Riwayat distribusi shift dan pasangan kerja.

#### 7.5.2 Aturan wajib

1. Satu kasir hanya dapat memiliki satu status utama per tanggal: satu shift, off, atau cuti.
2. Karyawan nonaktif tidak boleh dijadwalkan.
3. Off day dan cuti yang disetujui tidak boleh diisi shift.
4. Kebutuhan minimum outlet harus dipenuhi sebelum optimasi keseimbangan.
5. Seorang kasir memperoleh maksimal satu shift Middle dalam satu pekan.
6. Sehari sebelum off day, kasir dijadwalkan Pagi.
7. Sehari setelah off day, kasir dijadwalkan Malam.
8. Aturan sebelum/sesudah off hanya dapat dilanggar melalui override supervisor dengan alasan.
9. Penempatan lintas outlet hanya terjadi melalui penugasan backup manual.
10. Jam shift mengikuti template outlet untuk tanggal penugasan.

#### 7.5.3 Prioritas optimasi

Jika beberapa jadwal valid tersedia, sistem menggunakan urutan prioritas:

1. Kebutuhan minimum staf setiap outlet.
2. Off day.
3. Aturan Pagi sebelum off dan Malam setelah off.
4. Maksimal satu Middle per kasir per pekan.
5. Keseimbangan jumlah shift Pagi dan Malam.
6. Keseimbangan pertemuan kerja antarkasir.

Dua kasir dianggap bertemu jika berada pada outlet dan shift yang sama di tanggal yang sama.

Keseimbangan menggunakan skor optimasi, bukan batas selisih mutlak. Bobot skor harus dapat dikalibrasi melalui hasil pilot tanpa mengubah data historis.

#### 7.5.4 Kegagalan generate

Jika tidak ada roster yang memenuhi aturan:

- Sistem tidak boleh otomatis mengambil kasir dari outlet lain.
- Sistem menampilkan tanggal, outlet, shift, dan aturan yang konflik.
- Sistem menyarankan perubahan off day atau penambahan backup.
- Supervisor menentukan tindakan berikutnya.

#### 7.5.5 Siklus roster

1. Supervisor memasukkan off day.
2. Sistem membuat draft roster satu bulan.
3. Sistem menampilkan skor keseimbangan dan konflik.
4. Supervisor meninjau dan dapat mengubah draft.
5. Supervisor memublikasikan roster minimal tujuh hari sebelum bulan dimulai.
6. Karyawan menerima push notification.
7. Karyawan menandai perubahan sebagai Sudah Dibaca.
8. Supervisor dapat melihat penerima yang belum mengonfirmasi.

Perubahan setelah publikasi:

- Membutuhkan alasan.
- Membuat versi roster baru.
- Tidak menghapus versi sebelumnya.
- Mengirim notifikasi kepada pengguna terdampak.
- Dicatat dalam audit trail.

### 7.6 Penugasan backup outlet

1. Supervisor memilih kasir backup secara manual.
2. Sistem memeriksa konflik shift, off day, cuti, dan kebutuhan minimum outlet asal.
3. Penugasan menyimpan outlet asal, outlet tujuan, tanggal, shift, supervisor, dan alasan.
4. Izin geofence sementara hanya aktif untuk tanggal dan shift backup.
5. Karyawan menerima notifikasi dan wajib mengonfirmasi telah membaca.
6. Penugasan backup diperhitungkan dalam laporan serta skor keseimbangan.

### 7.7 Pertukaran shift

1. Pertukaran hanya dapat dilakukan antarkasir dalam outlet yang sama.
2. Pemohon memilih jadwal miliknya, rekan, jadwal tujuan, dan alasan.
3. Rekan yang dipilih harus menyetujui.
4. Supervisor memberikan keputusan akhir.
5. Keputusan supervisor pertama mengunci pengajuan.
6. Sistem memeriksa konflik, off day, cuti, batas Middle, dan kebutuhan staf.
7. Jika disetujui, sistem membuat versi roster baru dan mengirim notifikasi.

### 7.8 Presensi kasir

#### 7.8.1 Clock-in

- Hanya tersedia mulai satu jam sebelum jadwal.
- Harus berada dalam geofence outlet penugasan pada tanggal tersebut.
- Radius dapat dikonfigurasi per outlet antara 50–500 meter.
- Harus menggunakan kamera langsung; unggah dari galeri tidak diperbolehkan.
- Wajib mengambil satu selfie.
- Sistem menyimpan koordinat, akurasi GPS, timestamp, outlet, dan referensi jadwal.
- Status terlambat dihitung dari jadwal dan toleransi outlet/shift.
- Nilai awal toleransi keterlambatan adalah 15 menit.

#### 7.8.2 Clock-out

- Harus dilakukan di dalam geofence outlet penugasan.
- Tidak memerlukan selfie.
- Toleransi pulang lebih awal dapat dikonfigurasi per outlet/shift.
- Nilai awal toleransi pulang lebih awal adalah 15 menit.
- Clock-out di luar toleransi diberi status Pulang Lebih Awal.
- Clock-out melewati jadwal tanpa persetujuan diberi status Potensi Lembur.

#### 7.8.3 GPS gagal atau mencurigakan

- GPS yang tidak cukup akurat menyebabkan presensi ditolak sementara.
- Pengguna diminta mencoba ulang.
- Jika tetap gagal, pengguna dapat mengajukan koreksi presensi.
- Indikasi mock location atau perpindahan tidak wajar diberi flag Risiko Lokasi.
- Flag risiko harus ditinjau supervisor dan tidak otomatis menjadi penolakan final.

### 7.9 Presensi supervisor

- Supervisor mempunyai off day yang dapat diubah.
- Supervisor dapat clock-in pada jam berapa pun.
- Supervisor dapat presensi di outlet resmi mana pun.
- Supervisor wajib memenuhi delapan jam kerja.
- Supervisor tidak menggunakan status terlambat berdasarkan jam masuk.
- Durasi kurang dari delapan jam diberi flag Kekurangan Jam.
- Durasi lebih dari delapan jam diberi flag Potensi Lembur.
- Catatan bermasalah harus divalidasi supervisor lain.

### 7.10 Validasi presensi dan selfie

1. Presensi harian siap divalidasi setelah clock-out.
2. Supervisor mempunyai waktu maksimal tiga hari untuk memvalidasi.
3. Sistem mengirim pengingat sebelum tenggat.
4. Supervisor pertama yang memutuskan mengunci proses.
5. Supervisor tidak dapat memvalidasi presensinya sendiri.
6. Selfie diperiksa secara visual tanpa face matching.
7. Jika disetujui, selfie langsung dihapus dari Supabase Storage.
8. Jika ditolak, selfie disimpan sampai kasus selesai dengan batas maksimal 30 hari.
9. Sistem memberi peringatan sebelum penghapusan selfie yang belum selesai.
10. Metadata, keputusan, dan audit trail tidak ikut terhapus.
11. Kegagalan penghapusan file harus masuk antrean retry dan terlihat oleh supervisor.

### 7.11 Koreksi presensi

1. Karyawan atau supervisor mengajukan koreksi terhadap presensinya sendiri.
2. Pengajuan memuat nilai awal, nilai yang diminta, alasan, dan lampiran opsional.
3. Supervisor lain menyetujui atau menolak.
4. Jika disetujui, catatan asli tidak ditimpa tanpa jejak.
5. Sistem menyimpan nilai sebelum dan sesudah koreksi.
6. Keputusan pertama mengunci pengajuan.

### 7.12 Cuti dan izin

- Jenis cuti/izin dapat dibuat dan dinonaktifkan supervisor.
- Data awal: Cuti Tahunan, Sakit, Izin Penting, Cuti Melahirkan, Cuti Ayah, dan Cuti Tanpa Bayaran.
- Semua karyawan memperoleh 12 hari Cuti Tahunan per tahun.
- Saldo tersisa hangus pada akhir tahun.
- Cuti Tahunan diajukan minimal tiga hari sebelum tanggal mulai.
- Sakit dan keadaan darurat dapat diajukan pada hari yang sama.
- Sakit lebih dari satu hari wajib memiliki surat dokter.
- Jenis izin lain dapat meminta lampiran sesuai konfigurasi.
- Surat dokter dan dokumen izin disimpan sampai akhir tahun berjalan, lalu file dihapus.
- Metadata dokumen dan pengajuan tetap disimpan.

Alur:

1. Pengguna memilih jenis, rentang tanggal, alasan, dan lampiran.
2. Sistem memeriksa saldo, notice period, benturan jadwal, dan lampiran wajib.
3. Supervisor pertama menyetujui atau menolak.
4. Supervisor tidak dapat menyetujui pengajuannya sendiri.
5. Jika disetujui, saldo dikurangi dan karyawan ditandai tidak tersedia.
6. Sistem menyusun ulang jadwal terdampak.
7. Supervisor meninjau dan mengonfirmasi hasil penjadwalan ulang.

### 7.13 Lembur

Lembur dapat berasal dari:

- Pengajuan karyawan.
- Penugasan supervisor.
- Potensi Lembur dari clock-out melewati jadwal.

Aturan:

- Tidak ada perhitungan pembayaran.
- Pengajuan menyimpan waktu rencana.
- Durasi aktual dihitung dari presensi.
- Perbedaan rencana dan aktual harus divalidasi supervisor.
- Durasi minimum adalah satu jam.
- Durasi berikutnya dibulatkan dalam kelipatan 30 menit.
- Supervisor tidak dapat menyetujui lemburnya sendiri.

### 7.14 Pengumuman dan notifikasi

Supervisor dapat membuat pengumuman untuk:

- Seluruh perusahaan.
- Outlet tertentu.
- Pengguna tertentu.

Pengumuman dapat disematkan dan dapat mewajibkan konfirmasi baca.

Kanal notifikasi MVP:

- Pusat notifikasi dalam aplikasi.
- Push notification PWA.

Pemicu minimum:

- Roster dipublikasikan.
- Roster diubah.
- Penugasan backup.
- Permintaan pertukaran shift.
- Keputusan pengajuan.
- Presensi menunggu validasi atau melewati tenggat.
- GPS/presensi bermasalah.
- Pengingat perubahan yang belum dibaca.
- Pengumuman baru.

### 7.15 Dashboard

Dashboard supervisor dan manajemen menampilkan:

- Tingkat kehadiran.
- Keterlambatan.
- Pulang lebih awal.
- Presensi belum divalidasi.
- Risiko lokasi.
- Karyawan cuti.
- Lembur rencana dan aktual.
- Kecukupan staf per outlet.
- Distribusi Pagi, Middle, dan Malam.
- Skor keseimbangan roster.
- Penugasan backup.
- Perbandingan antaroutlet.

### 7.16 Laporan

Laporan minimum:

- Presensi.
- Keterlambatan dan pulang lebih awal.
- Validasi dan koreksi presensi.
- Cuti dan saldo.
- Lembur.
- Distribusi shift.
- Off day.
- Middle mingguan.
- Pertemuan pasangan kasir.
- Pertukaran shift.
- Penugasan backup.
- Perbandingan outlet.

Filter:

- Periode.
- Outlet.
- Karyawan.
- Status.
- Jenis aktivitas.

Ekspor:

- PDF.
- Excel/XLSX.

## 8. Aturan persetujuan umum

1. Ketiga supervisor memiliki wewenang yang sama.
2. Supervisor mana pun dapat memutuskan pengajuan pengguna lain.
3. Keputusan valid pertama mengunci pengajuan secara atomik.
4. Keputusan menyimpan supervisor, waktu, status, catatan, dan versi data.
5. Supervisor tidak dapat menyetujui pengajuan, koreksi, lembur, cuti, atau presensinya sendiri.
6. Koreksi terhadap keputusan terkunci harus dibuat sebagai aktivitas baru dan tidak menghapus riwayat.

## 9. Kebutuhan nonfungsional

### 9.1 Keamanan

- Gunakan Supabase Auth.
- Terapkan Row Level Security pada seluruh tabel yang dapat diakses klien.
- Bucket selfie dan dokumen harus private.
- Gunakan signed URL berumur pendek untuk peninjauan file.
- Validasi peran harus dilakukan di server/database, bukan hanya menyembunyikan tombol.
- Operasi persetujuan memakai transaksi atau fungsi database untuk mencegah keputusan ganda.
- Tidak ada kata sandi mentah di database aplikasi, log, atau analytics.
- Service role key tidak boleh dikirim ke browser.

### 9.2 Privasi dan retensi

| Data | Retensi |
| --- | --- |
| Selfie presensi disetujui | Hapus segera setelah validasi |
| Selfie presensi ditolak | Sampai kasus selesai, maksimal 30 hari |
| Surat dokter/dokumen izin | Sampai akhir tahun berjalan |
| Audit trail | 2 tahun |
| Riwayat karyawan nonaktif | Tetap disimpan selama diperlukan untuk laporan |

### 9.3 Performa

- Navigasi dari cache harus terasa instan dan tidak bergantung pada spinner penuh halaman.
- Mutasi menggunakan optimistic UI jika aman, dengan rollback ketika server menolak.
- Generate roster satu bulan untuk 200 pengguna ditargetkan selesai maksimal 30 detik.
- Daftar panjang menggunakan pagination atau virtualisasi.
- Query laporan wajib menggunakan indeks tanggal, outlet, karyawan, dan status.

### 9.4 Keandalan

- Backup database otomatis mingguan.
- Arsip bulanan dapat diunduh supervisor.
- Penghapusan file memakai retry queue dan idempotency key.
- Operasi generate/publish roster harus idempotent.
- Setiap perubahan roster mempunyai nomor versi.

### 9.5 Offline

- Jadwal dan data terakhir dapat dibaca dari cache.
- Presensi, pengajuan, persetujuan, dan mutasi lain membutuhkan koneksi.
- UI harus menjelaskan bahwa data yang tampil mungkin berasal dari cache.

### 9.6 Aksesibilitas dan UX

- Mobile-first dengan dukungan safe area iOS/Android.
- Desain dark mode dengan aksen amber.
- Target WCAG 2.1 AA untuk kontras, keyboard, focus management, dan screen reader.
- Semua dialog menggunakan komponen modal yang aksesibel.
- Tidak menggunakan browser `alert()`.
- Berikan status loading, sukses, gagal, dan retry yang jelas.

### 9.7 Lokalisasi

- Bahasa Indonesia.
- Tampilan waktu WIB/Asia Jakarta.
- Timestamp database disimpan sebagai UTC `timestamptz` dan dikonversi saat ditampilkan.

### 9.8 Skala

- Target awal 6–15 outlet.
- Target awal maksimal 200 pengguna.
- Skema tidak boleh mengikat nama ketiga supervisor ke kode; jabatan disimpan sebagai master data.

## 10. Acceptance criteria utama

### AC-01 — Login pertama

- **Given** supervisor membuat akun dan kata sandi awal,
- **when** pengguna login pertama kali,
- **then** pengguna tidak dapat membuka aplikasi sebelum membuat kata sandi baru.

### AC-02 — Reset kata sandi

- **Given** pengguna lupa kata sandi,
- **when** supervisor menetapkan kata sandi sementara,
- **then** pengguna wajib menggantinya pada login berikutnya dan supervisor tidak dapat melihat kata sandi aktif.

### AC-03 — Clock-in kasir valid

- **Given** waktu sudah berada dalam satu jam sebelum shift dan pengguna berada di geofence penugasan,
- **when** pengguna mengambil selfie dari kamera langsung,
- **then** clock-in tersimpan bersama koordinat, akurasi GPS, outlet, jadwal, dan referensi file private.

### AC-04 — Clock-in di luar geofence

- **Given** pengguna berada di luar radius outlet,
- **when** pengguna mencoba clock-in,
- **then** sistem menolak sementara dan tidak membuat presensi valid.

### AC-05 — Clock-out

- **Given** pengguna memiliki clock-in terbuka,
- **when** pengguna clock-out di geofence penugasan,
- **then** sistem menutup presensi tanpa meminta selfie dan menghitung durasi kerja.

### AC-06 — Validasi dan penghapusan selfie

- **Given** presensi sudah clock-out,
- **when** supervisor lain menyetujui,
- **then** status terkunci, metadata audit tersimpan, dan selfie masuk antrean penghapusan segera.

### AC-07 — Presensi ditolak

- **Given** supervisor menolak presensi,
- **when** kasus belum selesai,
- **then** selfie tetap tersedia secara private hingga kasus selesai atau mencapai 30 hari.

### AC-08 — Keputusan bersamaan

- **Given** dua supervisor membuka pengajuan yang sama,
- **when** keduanya memutuskan hampir bersamaan,
- **then** hanya keputusan pertama yang diterima dan keputusan kedua mendapat informasi bahwa data sudah berubah.

### AC-09 — Larangan self-approval

- **Given** pengajuan atau presensi dibuat oleh supervisor,
- **when** supervisor tersebut mencoba menyetujui datanya sendiri,
- **then** server menolak operasi.

### AC-10 — Generate roster

- **Given** master outlet, kasir, kebutuhan staf, template shift, off day, cuti, dan pengecualian lengkap,
- **when** supervisor membuat draft roster,
- **then** sistem menghasilkan satu bulan jadwal atau daftar konflik yang dapat ditindaklanjuti.

### AC-11 — Middle mingguan

- **Given** kebutuhan outlet memerlukan shift Middle,
- **when** roster dibuat,
- **then** seorang kasir tidak memperoleh lebih dari satu Middle dalam pekan yang sama kecuali override beralasan.

### AC-12 — Off day

- **Given** supervisor memindahkan off day ke pekan bersebelahan dalam bulan yang sama,
- **when** roster dihitung ulang,
- **then** total off day tetap terjaga dan risiko lebih dari enam hari kerja memunculkan peringatan.

### AC-13 — Aturan sekitar off

- **Given** seorang kasir mempunyai off day,
- **when** roster dibuat,
- **then** hari sebelumnya Pagi dan hari setelahnya Malam, kecuali supervisor membuat override dengan alasan.

### AC-14 — Roster tidak layak

- **Given** kebutuhan staf tidak dapat dipenuhi,
- **when** algoritma selesai,
- **then** sistem tidak memindahkan karyawan otomatis dan menampilkan konflik serta saran perbaikan.

### AC-15 — Publikasi dan versi

- **Given** draft telah ditinjau,
- **when** supervisor memublikasikan,
- **then** versi resmi tersimpan, notifikasi dikirim, dan perubahan berikutnya membuat versi baru.

### AC-16 — Konfirmasi baca

- **Given** jadwal pengguna berubah,
- **when** notifikasi diterima,
- **then** pengguna dapat menandai Sudah Dibaca dan supervisor melihat status penerimaan.

### AC-17 — Backup outlet

- **Given** supervisor menetapkan backup manual,
- **when** penugasan disimpan,
- **then** sistem memeriksa konflik dan geofence outlet tujuan hanya aktif pada tanggal/shift tersebut.

### AC-18 — Tukar shift

- **Given** dua kasir dari outlet yang sama menyetujui pertukaran,
- **when** supervisor menyetujui,
- **then** roster berubah melalui versi baru setelah seluruh validasi lolos.

### AC-19 — Cuti

- **Given** saldo dan notice period memenuhi syarat,
- **when** supervisor lain menyetujui cuti,
- **then** saldo berkurang dan sistem membuat usulan jadwal ulang untuk tanggal terdampak.

### AC-20 — Lembur aktual

- **Given** ada rencana lembur dan catatan presensi,
- **when** pengguna clock-out,
- **then** sistem menghitung durasi aktual minimal satu jam dengan pembulatan 30 menit dan meminta validasi bila berbeda.

### AC-21 — Akses karyawan

- **Given** pengguna berperan sebagai karyawan,
- **when** membuka jadwal seluruh kasir,
- **then** hanya nama, outlet, tanggal, shift, jam, off day, dan status backup yang terlihat.

### AC-22 — Akses manajemen

- **Given** pengguna berperan sebagai manajemen,
- **when** mencoba mengubah data,
- **then** server menolak semua mutasi.

## 11. Ukuran keberhasilan

- Waktu penyusunan roster bulanan berkurang secara nyata dibanding proses manual.
- Seluruh perubahan roster memiliki alasan, versi, dan status baca.
- Tidak ada supervisor yang dapat menyetujui data miliknya sendiri.
- Tidak ada selfie yang tertinggal melewati kebijakan retensi tanpa status retry/peringatan.
- Konflik kebutuhan staf diketahui sebelum roster dipublikasikan.
- Distribusi Pagi/Malam dan pertemuan pasangan menunjukkan skor lebih baik dibanding draft acak.
- Validasi presensi selesai maksimal tiga hari untuk mayoritas catatan.
- Pilot satu outlet dapat berjalan tanpa pencatatan paralel yang membingungkan pengguna.

## 12. Arsitektur produk

| Lapisan | Keputusan |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Hosting | Vercel |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth email/password |
| File | Private Supabase Storage |
| Realtime | Supabase Realtime |
| Push | Web Push/PWA |
| Lingkungan | Development, Staging, Production |
| Pengujian | Lint, typecheck, production build, Playwright E2E, accessibility |

## 13. Strategi peluncuran

1. Lengkapi backend dan RLS di lingkungan Development.
2. Validasi algoritma roster menggunakan data sintetis.
3. Uji alur end-to-end di Staging.
4. Impor data pilot dari Excel.
5. Jalankan pilot pada satu outlet.
6. Bandingkan roster sistem dengan roster manual.
7. Kalibrasi bobot keseimbangan.
8. Perluas secara bertahap setelah kriteria pilot terpenuhi.

Tidak ada tenggat tetap; kualitas dan ketepatan algoritma menjadi prioritas.

## 14. Roadmap

### MVP

- Seluruh fitur yang didefinisikan dalam dokumen ini.

### Fase 2

- KPI karyawan dan outlet.
- Konfigurasi formula KPI.
- Sasaran per periode.
- Dashboard capaian dan tren.

Data presensi, roster, lembur, cuti, validasi, serta audit dari MVP harus dapat menjadi sumber KPI tanpa migrasi besar.

## 15. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Algoritma tidak menemukan roster valid | Jelaskan konflik; jangan melakukan perpindahan outlet otomatis |
| Skor keseimbangan belum sesuai persepsi operasional | Kalibrasi bobot saat pilot dan simpan versi konfigurasi |
| GPS browser tidak akurat | Ambang akurasi, retry, flag risiko, dan koreksi presensi |
| Mock location tidak dapat dideteksi pasti | Jadikan indikator risiko, bukan keputusan otomatis |
| Supervisor memutus data bersamaan | Persetujuan atomik dengan version check |
| Storage free tier penuh | Retensi selfie/dokumen, retry penghapusan, dan dashboard penggunaan |
| Push notification tidak diizinkan pengguna | Pusat notifikasi dalam aplikasi tetap menjadi sumber utama |
| Perubahan roster tidak terbaca | Wajibkan acknowledgement dan tampilkan daftar belum membaca |
| Kehilangan data | Backup mingguan dan arsip bulanan |

## 16. Keputusan yang perlu dikalibrasi saat pilot

Keputusan berikut bukan pertanyaan cakupan, tetapi parameter teknis yang perlu diuji dengan data nyata:

- Bobot skor keseimbangan Pagi/Malam.
- Bobot skor pasangan kerja.
- Ambang akurasi GPS yang dianggap layak.
- Jumlah retry dan jeda penghapusan file.
- Waktu pengiriman pengingat validasi sebelum tenggat tiga hari.
- Ambang performa generate roster pada perangkat dan data produksi.

Perubahan parameter tersebut harus memiliki versi agar roster lama tetap dapat dijelaskan.
