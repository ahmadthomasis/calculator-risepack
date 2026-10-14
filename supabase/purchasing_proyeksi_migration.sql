-- ═══════════════════════════════════════════════════════════════════════════
-- PURCHASING — PISAHKAN "STATUS PROYEKSI" DARI "KEPUTUSAN"
--
-- Sebelumnya satu kolom (purchasing_status) mencampur dua hal yang berbeda:
-- apakah purchasing sudah mengerjakan proyeksi biayanya, DAN apakah hasilnya
-- disetujui/hold/cancel. Akibatnya tidak ada cara melihat mana order yang
-- sudah diproyeksikan dan mana yang belum.
--
-- Sekarang dua dimensi terpisah:
--
--   1. STATUS PROYEKSI  -> purchasing_projected_at (kolom baru di bawah)
--      Belum / Sudah Diproyeksi. Terisi otomatis saat purchasing menekan
--      tombol "Save Proyeksi" di halaman validasi.
--
--   2. STATUS PURCHASING -> purchasing_status (kolom lama, dipertahankan)
--      pending = Belum Diputuskan, lalu approved / hold / cancelled.
--      Dipilih lewat dropdown di halaman Antrian Purchasing, mengikuti pola
--      dropdown status deal di dashboard Sales.
--
-- Keputusan desain 14 Okt 2026: order dianggap "Sudah Diproyeksi" begitu
-- tombol Save Proyeksi ditekan -- purchasing sendiri yang tahu kapan
-- pekerjaannya selesai, bukan sistem yang menebak dari kelengkapan isian
-- (sebagian order memang wajar punya area kosong).
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotations
  add column if not exists purchasing_projected_at timestamptz;

alter table public.quotations
  add column if not exists purchasing_projected_by uuid references public.profiles(id) on delete set null;

create index if not exists quotations_purchasing_projected_at_idx
  on public.quotations (purchasing_projected_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- ── BACKFILL DATA LAMA (SUDAH DIJALANKAN 14 Okt 2026) ─────────────────────
-- Quotation yang sudah ada tidak punya purchasing_projected_at, padahal
-- sebagian sudah dikerjakan purchasing sebelum kolom ini ada. Asumsi yang
-- dipakai: kalau sebuah quotation punya baris di purchasing_comparisons,
-- berarti seseorang pernah mengerjakan proyeksinya.
--
-- Stempel waktunya TIDAK diisi now() -- itu akan mencatat semuanya seolah
-- diproyeksikan pada hari backfill. Dipakai max(updated_at) dari baris
-- pembandingnya, yaitu waktu proyeksi itu benar-benar terakhir disimpan.
--
-- Hasil nyata saat dijalankan: 28 ditandai Sudah Diproyeksi, 38 tetap Belum
-- (memang kosong sama sekali), dari 66 quotation yang pernah masuk antrean.
-- Rentang stempel waktu: 23 Jun 2026 s/d 14 Okt 2026.
--
-- Aman dijalankan ulang: klausa `purchasing_projected_at is null` membuatnya
-- hanya menyentuh baris yang belum ditandai.

update public.quotations q
set purchasing_projected_at = pc.terakhir
from (
  select quotation_id, max(updated_at) as terakhir
  from public.purchasing_comparisons
  group by quotation_id
) pc
where pc.quotation_id = q.id
  and q.purchasing_status is not null
  and q.purchasing_projected_at is null;

-- ═══════════════════════════════════════════════════════════════════════════
