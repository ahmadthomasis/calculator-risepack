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

-- Perlu buat sync script hapus data lama sebelum insert ulang (full refresh).
drop policy if exists "erp_orders_delete" on public.erp_orders;
create policy "erp_orders_delete" on public.erp_orders
  for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════════════
