-- ═══════════════════════════════════════════════════════════════════════════
-- TARGET HPP PER QTY
-- Jalankan di Supabase Dashboard → SQL Editor SEBELUM merge kodenya.
-- Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════
-- requests.target_prices : target HPP per pcs (SEBELUM margin), satu angka per
--                          qty, urutannya sama dengan requests.quantities.
--                          Wajib diisi sales/innersales untuk request baru.
-- quotations.target_hpp  : target yang berlaku saat perhitungan disimpan.
-- quotations.target_dikejar : true kalau HPP disimpan DI ATAS target dan
--                          estimator mencentang "sudah dikejar".

alter table public.requests   add column if not exists target_prices  numeric[];
alter table public.quotations add column if not exists target_hpp     numeric;
alter table public.quotations add column if not exists target_dikejar boolean not null default false;

notify pgrst, 'reload schema';
