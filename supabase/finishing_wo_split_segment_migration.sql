-- ═══════════════════════════════════════════════════════════════════════════
-- FINISHING WO SPLIT — SEGMENT KEUANGAN PER KOMPONEN
--
-- Satu baris Finishing WO (mis. "Pond - Board") punya 1 harga tapi pecah jadi
-- 3 komponen biaya (Upah/Bahan Baku/Mesin) via finishing_wo_split_rules.
-- Karena itu segment_keuangan-nya juga tidak bisa 1 per baris material —
-- dipindah ke level rumus split (per proses), 1 segment per komponen.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.finishing_wo_split_rules
  add column if not exists segment_upah text,
  add column if not exists segment_bahan text,
  add column if not exists segment_mesin text;

-- ═══════════════════════════════════════════════════════════════════════════
