-- ═══════════════════════════════════════════════════════════════════════════
-- PRODEV — URUTAN ANTRIAN DITENTUKAN INNERSALES
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════
-- Innersales (dan manager) menggeser order naik/turun di Antrian Prodev.
-- Posisi hasil geseran disimpan di sini, terpisah per tahap:
--   urutan_layout : posisi di antrian layout milik layouter order itu
--   urutan_rakit  : posisi di antrian rakit (satu antrian untuk semua sample maker)
-- NULL = belum pernah digeser → ditaruh setelah yang sudah diurutkan,
-- di antaranya diurutkan otomatis (deadline terdekat, lalu yang masuk duluan).
-- Policy update prodev_orders sudah membolehkan semua user login, jadi tidak
-- perlu policy baru.

alter table public.prodev_orders add column if not exists urutan_layout integer;
alter table public.prodev_orders add column if not exists urutan_rakit  integer;
