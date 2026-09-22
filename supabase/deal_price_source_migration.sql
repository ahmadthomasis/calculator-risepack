-- ═══════════════════════════════════════════════════════════════════════════
-- DEAL — SUMBER HARGA (Vendor vs Estimator/Internal)
--
-- Saat quotation ditandai Deal, kalau ada perbandingan vendor, Sales/Manager
-- wajib pilih harga mana yang jadi acuan final: harga vendor (dipakai apa
-- adanya) atau harga estimator (dipakai sebagai harga proyeksi internal).
-- Kalau tidak ada perbandingan vendor, otomatis 'internal'.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotations
  add column if not exists deal_price_source text check (deal_price_source in ('vendor','internal'));

-- Kalau sumber harga = vendor, cost-nya tidak perlu dipecah ke segment
-- Kertas/Upah/dst — otomatis di-tag "Vendor" (diisi dari sisi app).
alter table public.quotations
  add column if not exists deal_segment_keuangan text;

-- ═══════════════════════════════════════════════════════════════════════════
