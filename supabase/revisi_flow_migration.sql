-- ═══════════════════════════════════════════════════════════════════════════
-- PRODEV — ALUR REVISI
-- 1) Revisi Prodev (dari sample maker): order balik ke Proses Layout.
-- 2) Revisi Konsumen (FPS Ulang dari innersales): buat order baru ber-tag Revisi N.
-- Jalankan di Supabase Dashboard → SQL Editor SETELAH migration sebelumnya.
-- Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.prodev_orders
  add column if not exists revisi_dari uuid references public.prodev_orders(id) on delete set null;

alter table public.prodev_orders
  add column if not exists revisi_ke smallint not null default 0;      -- 0 = order asli, 1/2/3 = putaran revisi konsumen

alter table public.prodev_orders
  add column if not exists keterangan_revisi text;                     -- instruksi/keluhan revisi konsumen (di order revisi)

alter table public.prodev_orders
  add column if not exists catatan_revisi_prodev text;                 -- catatan sample maker saat balikkan layout ke prodev

create index if not exists prodev_orders_revisi_dari_idx on public.prodev_orders (revisi_dari);

-- Catatan: kolom counter revisi_konsumen & revisi_prodev sudah ada dari migration awal.
-- ═══════════════════════════════════════════════════════════════════════════
