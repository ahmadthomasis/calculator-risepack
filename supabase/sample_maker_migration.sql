-- ═══════════════════════════════════════════════════════════════════════════
-- PRODEV — ROLE BARU: SAMPLE MAKER
-- Memisahkan tugas: Layouter (role 'prodev') hanya layout;
-- Sample Maker (role 'sample_maker') yang mengerjakan rakit + isi Dummy Final.
-- Jalankan di Supabase Dashboard → SQL Editor SETELAH migration sebelumnya.
-- Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tambahkan 'sample_maker' ke daftar role yang diizinkan ────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('sales','estimator','manager','purchasing','prodev','sample_maker'));

-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBUAT / MENGUBAH USER SAMPLE MAKER:
--
-- Coba dulu lewat User Management (role "Sample Maker"). KALAU Edge Function
-- create-user / manage-user menolak role 'sample_maker' (sama seperti kasus
-- 'prodev' dulu), pakai jalur SQL berikut:
--
-- A. Kalau akun Kiki SUDAH ada (mis. saat ini role 'prodev' atau 'sales'):
--      update public.profiles
--      set role = 'sample_maker'
--      where id = (select id from auth.users where email = 'EMAIL_KIKI');
--
-- B. Kalau belum ada: buat dulu via User Management dengan role apa saja
--    (mis. 'sales'), lalu jalankan update di atas dengan email-nya.
--
-- Solusi permanen (opsional): buka Supabase → Edge Functions →
-- create-user & manage-user → tambahkan 'sample_maker' ke daftar role valid,
-- lalu deploy ulang. (Paste isinya ke chat, saya tunjukkan baris tepatnya.)
-- ═══════════════════════════════════════════════════════════════════════════
