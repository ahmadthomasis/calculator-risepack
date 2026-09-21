-- ═══════════════════════════════════════════════════════════════════════════
-- QUOTATIONS — KODE ORDER
-- Wajib diisi saat deal_status diubah jadi 'deal' (divalidasi di sisi aplikasi,
-- Sales & Manager dashboard). Kolom nullable karena quotation lama belum punya.
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotations
  add column if not exists kode_order text;

-- ═══════════════════════════════════════════════════════════════════════════
