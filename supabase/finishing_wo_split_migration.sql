-- ═══════════════════════════════════════════════════════════════════════════
-- FINISHING WO — SPLIT BIAYA (Upah Pekerja / Bahan Baku / Charge Mesin)
--
-- Estimator: split OTOMATIS dari % rumus per jenis proses (Pond, Grooving, dst),
--   diset manager di Pricing Dataset, disimpan di finishing_wo_split_rules.
-- Purchasing: split MANUAL (3 input per baris), dijumlah jadi purchasing_price
--   yang sudah ada — disimpan di kolom baru purchasing_upah/bahan/mesin.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.finishing_wo_split_rules (
  proses text primary key,
  pct_upah numeric not null default 0,
  pct_bahan numeric not null default 0,
  pct_mesin numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.finishing_wo_split_rules enable row level security;

drop policy if exists "finishing_wo_split_rules_select" on public.finishing_wo_split_rules;
create policy "finishing_wo_split_rules_select" on public.finishing_wo_split_rules
  for select to authenticated using (true);

drop policy if exists "finishing_wo_split_rules_insert" on public.finishing_wo_split_rules;
create policy "finishing_wo_split_rules_insert" on public.finishing_wo_split_rules
  for insert to authenticated with check (true);

drop policy if exists "finishing_wo_split_rules_update" on public.finishing_wo_split_rules;
create policy "finishing_wo_split_rules_update" on public.finishing_wo_split_rules
  for update to authenticated using (true);

alter table public.purchasing_comparisons
  add column if not exists purchasing_upah numeric,
  add column if not exists purchasing_bahan numeric,
  add column if not exists purchasing_mesin numeric;

-- ═══════════════════════════════════════════════════════════════════════════
