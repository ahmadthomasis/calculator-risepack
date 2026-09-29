-- ═══════════════════════════════════════════════════════════════════════════
-- ERP ORDERS — tambah kolom nama_vendor
--
-- Dipakai Dashboard Pantau buat nentuin Status Pengerjaan (Vendor/Workshop)
-- langsung dari data ERP, bukan dari deal_price_source di quotations kita
-- (yang cuma keisi kalau Sales/Estimator sudah proses order-nya). Aturan:
-- nama_vendor = 'Risepack/WO' -> Workshop, selain itu -> Vendor.
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.erp_orders add column if not exists nama_vendor text;

-- ═══════════════════════════════════════════════════════════════════════════
