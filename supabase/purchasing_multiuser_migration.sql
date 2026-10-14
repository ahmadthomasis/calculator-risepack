-- ═══════════════════════════════════════════════════════════════════════════
-- PURCHASING — IZIN UBAH STATUS + DUA AKUN BISA KERJA BARENGAN
--
-- Memperbaiki dua bug yang ditemukan 14 Okt 2026:
--
-- (1) Role 'purchasing' (Hamam/Nisa) TIDAK BISA mengubah status
--     Validasi/Hold/Cancel. Penyebabnya: tabel quotations tidak punya policy
--     UPDATE untuk role purchasing sama sekali -- yang ada cuma SELECT
--     ("purchasing read sent") dan tulis ke purchasing_comparisons.
--     Akibatnya update purchasing_status mengenai 0 baris, PostgreSQL tidak
--     menganggap itu error, dan aplikasi mengira berhasil lalu menutup
--     halaman. Catatan Purchasing (purchasing_notes) juga diam-diam gagal.
--
-- (2) Dua akun purchasing saling menimpa. PurchasingReview.jsx dulu
--     MENGHAPUS SEMUA baris purchasing_comparisons milik 1 quotation lalu
--     insert ulang isi layarnya sendiri -- tanpa membedakan area. Jadi saat
--     Hamam menyimpan Material Cost, baris Cetak Cost milik Nisa ikut
--     terhapus. Perbaikan di sisi aplikasi memakai UPSERT per baris, dan
--     itu butuh unique constraint di bawah ini.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Unique key per baris pembanding ──────────────────────────────────────
-- Satu quotation hanya boleh punya SATU baris pembanding per
-- (section, row_index). Dicek 14 Okt 2026: 833 baris, 833 kombinasi unik,
-- 0 duplikat -- jadi constraint ini aman dipasang tanpa bersih-bersih data.
-- Dipakai sebagai target onConflict untuk upsert dari aplikasi.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchasing_comparisons'::regclass
      and conname = 'purchasing_comparisons_quotation_section_row_key'
  ) then
    alter table public.purchasing_comparisons
      add constraint purchasing_comparisons_quotation_section_row_key
      unique (quotation_id, section, row_index);
  end if;
end $$;

-- ── 2. Purchasing boleh UPDATE quotation yang sudah dikirim ke mereka ───────
-- Dibatasi ke baris yang purchasing_status-nya sudah terisi, yaitu quotation
-- yang memang sudah dikirim Manager lewat tombol "Kirim ke Purchasing".
-- Quotation yang belum dikirim tetap tidak bisa disentuh purchasing.
--
-- CATATAN KEWENANGAN (keputusan sadar, 14 Okt 2026 -- "versi sederhana"):
-- RLS mengunci per BARIS, bukan per KOLOM. Jadi secara teknis purchasing
-- bisa mengubah kolom lain di baris yang sama, bukan hanya purchasing_*.
-- Aplikasi hanya pernah mengirim kolom purchasing_*, jadi dalam pemakaian
-- normal ini tidak jadi soal. Kalau nanti perlu penguncian ketat per kolom,
-- tambahkan trigger BEFORE UPDATE yang menolak perubahan di luar
-- purchasing_status / purchasing_notes / purchasing_reviewed_at /
-- purchasing_reviewed_by saat get_my_role() = 'purchasing'.
drop policy if exists "quotations: purchasing update sent" on public.quotations;
create policy "quotations: purchasing update sent" on public.quotations
  for update to authenticated
  using      (get_my_role() = 'purchasing' and purchasing_status is not null)
  with check (get_my_role() = 'purchasing' and purchasing_status is not null);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFIKASI SETELAH DIJALANKAN:
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='quotations' and cmd='UPDATE';
-- Harus muncul 3: manager write, sales update own deal status,
-- dan purchasing update sent.
-- ═══════════════════════════════════════════════════════════════════════════
