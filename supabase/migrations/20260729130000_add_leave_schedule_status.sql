-- Cuti approved tetap harus mengisi satu status harian pada roster, tetapi
-- tidak boleh disamarkan sebagai off day mingguan.
alter type public.schedule_status add value if not exists 'leave' after 'off';
