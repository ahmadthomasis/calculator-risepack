-- ═══════════════════════════════════════════════════════════════════════════
-- PRODEV — IZINKAN HAPUS ORDER KAPAN SAJA (termasuk yang sudah selesai)
-- Sebelumnya hapus hanya boleh selama layout belum dikerjakan.
-- Sekarang: pembuat boleh hapus order-nya kapan saja; manager boleh hapus apa saja.
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
--
-- CATATAN: hard delete = permanen. Order yang dihapus juga hilang dari data KPI.
-- Kalau nanti mau ganti ke "arsip" (soft delete), kabari — pakai kolom is_cancelled.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "prodev_orders_delete" on public.prodev_orders;
create policy "prodev_orders_delete" on public.prodev_orders
  for delete to authenticated
  using (created_by = auth.uid() or public.is_manager());
