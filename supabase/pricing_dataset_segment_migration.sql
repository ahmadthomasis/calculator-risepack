-- ═══════════════════════════════════════════════════════════════════════════
-- PRICING DATASET — SEGMENT KEUANGAN
-- Tambah kolom segment_keuangan ke raw_materials untuk klasifikasi laporan
-- keuangan per material (dropdown ~44 pilihan, dikelola di sisi aplikasi).
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.raw_materials
  add column if not exists segment_keuangan text;

create index if not exists raw_materials_segment_keuangan_idx on public.raw_materials (segment_keuangan);

-- ═══════════════════════════════════════════════════════════════════════════
