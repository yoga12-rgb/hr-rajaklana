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
- UI prototype tetap memakai `HRContext` sampai setiap modul dipindahkan dan
  diuji secara bertahap.
