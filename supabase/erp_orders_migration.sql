-- ═══════════════════════════════════════════════════════════════════════════
-- ERP ORDERS — cache dari database ERP eksternal (MySQL, via Apps Script)
--
-- Diisi/di-refresh berkala oleh Apps Script terpisah (JDBC ke MySQL ERP),
-- bukan oleh aplikasi ini. sko = Kode Order, dipakai buat join ke
-- quotations.kode_order di Dashboard Pantau.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.erp_orders (
  sko text primary key,
  nama_customer text,
  sales_name text,
  nama_produk text,
  jumlah_produk numeric,
  tgl_order date,
  status_deal text,
  flag_dummy text,
  jenis_bahan text,
  modal_sales numeric,
  tgl_faw date,
  synced_at timestamptz not null default now()
);

alter table public.erp_orders enable row level security;

drop policy if exists "erp_orders_select" on public.erp_orders;
create policy "erp_orders_select" on public.erp_orders
  for select to authenticated using (true);

drop policy if exists "erp_orders_insert" on public.erp_orders;
create policy "erp_orders_insert" on public.erp_orders
  for insert to authenticated with check (true);

drop policy if exists "erp_orders_update" on public.erp_orders;
create policy "erp_orders_update" on public.erp_orders
  for update to authenticated using (true);

-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ POLICY DELETE SENGAJA DIHAPUS 15 Okt 2026 — JANGAN DIHIDUPKAN LAGI    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- Dulu ada policy "erp_orders_delete" (for delete to authenticated using
-- (true)) dengan alasan: "Perlu buat sync script hapus data lama sebelum
-- insert ulang (full refresh)". Desain hapus-lalu-isi-ulang itu sudah
-- ditinggalkan 12 Okt 2026, diganti upsert-then-prune.
--
-- Policy itu dicabut karena ternyata dipakai script sync LAMA milik akun
-- Google lain yang menghapus SELURUH tabel tiap menit :09/:39 lewat
-- DELETE ?sko=not.is.null -- itulah penyebab keluhan "Nama Vendor hilang
-- lalu kembali lagi" selama berminggu-minggu.
--
-- PENTING: PostgREST membalas 204 (seolah berhasil) untuk DELETE yang
-- ditolak RLS. Jadi kalau policy ini dihidupkan lagi, kerusakannya kembali
-- TANPA error atau peringatan apa pun di mana-mana.
--
-- Penghapusan yang sah sekarang lewat fungsi public.prune_erp_orders(),
-- lihat supabase/erp_orders_blokir_delete_migration.sql.
--
-- Kalau file ini dijalankan ulang, pastikan blok di bawah tetap komentar:
-- drop policy if exists "erp_orders_delete" on public.erp_orders;
-- create policy "erp_orders_delete" on public.erp_orders
--   for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════════════
