-- ═══════════════════════════════════════════════════════════════════════════
-- TAHAP 4-5 — REVISI PURCHASING, IZIN ESTIMATOR, AUTO-KIRIM KE PURCHASING
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang.
-- Dibuat 14 Okt 2026.
--
-- Empat hal yang saling berkaitan:
--   1. Jalur permintaan revisi Purchasing -> Estimator
--   2. Catatan saat keputusan purchasing direset karena perhitungan berubah
--   3. Izin role estimator mengirim quotation ke purchasing
--   4. Auto-kirim ke purchasing untuk order DEAL ber-vendor Risepack/WO
--
-- BAGIAN 6 (backfill) MENGUBAH DATA. Jalankan SELECT-nya dulu, lihat
-- jumlahnya, baru jalankan UPDATE-nya. Jangan di-run sekaligus.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. JALUR PERMINTAAN REVISI: PURCHASING -> ESTIMATOR
-- ───────────────────────────────────────────────────────────────────────────
-- MASALAH
-- Estimator mengisi baris biaya, purchasing mengisi harga pembanding per
-- baris. Tapi purchasing TIDAK BISA menambah baris item -- hanya estimator
-- yang bisa. Jadi kalau estimator lupa satu item dan purchasing sudah
-- selesai memproyeksikan, purchasing mentok: tidak ada cara memberi tahu
-- estimator selain lewat WhatsApp, dan tidak ada jejaknya di aplikasi.
--
-- Sebelum ini, badge "Revisi Purchasing" di Antrian Estimator cuma melihat
-- purchasing_notes terisi atau tidak. Itu keliru: purchasing_notes adalah
-- catatan biasa yang ikut tersimpan SETIAP kali purchasing menekan Save
-- Proyeksi, jadi badge-nya menyala terus walau tidak ada yang perlu
-- direvisi, dan tidak pernah bisa dimatikan.
--
-- CARA SELESAINYA -- tidak ada tombol "tandai selesai" yang bisa lupa
-- ditekan. Setiap kali estimator menyimpan ulang perhitungan,
-- Calculator.jsx meng-INSERT baris quotation BARU dan menonaktifkan yang
-- lama. Baris baru itu tidak ikut membawa needs_revision, jadi nilainya
-- kembali ke default false -- revisi dianggap beres oleh perbuatan
-- memperbaikinya, bukan oleh klik.

alter table public.quotations
  add column if not exists needs_revision        boolean not null default false,
  add column if not exists revision_note         text,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_requested_by uuid references public.profiles(id);

-- Partial index: hanya baris yang benar-benar minta revisi yang diindeks.
create index if not exists quotations_needs_revision_idx
  on public.quotations (needs_revision, revision_requested_at desc)
  where needs_revision = true;

comment on column public.quotations.needs_revision is
  'Purchasing meminta estimator memperbaiki/menambah item. Kembali false sendiri saat estimator menyimpan ulang (INSERT baris quotation baru).';
comment on column public.quotations.revision_note is
  'Isi permintaan revisi dari purchasing. Berbeda dari purchasing_notes yang merupakan catatan biasa pada proyeksi.';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. CATATAN RESET KEPUTUSAN PURCHASING
-- ───────────────────────────────────────────────────────────────────────────
-- Keputusan purchasing (Disetujui/Hold/Cancelled) diberikan untuk SATU versi
-- perhitungan. Begitu estimator mengubah perhitungannya, keputusan itu basi:
-- "Disetujui" mengacu ke angka yang sudah tidak ada lagi.
--
-- Aturan yang dipakai (keputusan pemilik, 14 Okt 2026): keputusan direset ke
-- 'pending' (Belum Diputuskan), TAPI disertai catatan yang menyebut status
-- sebelumnya dan kapan direset -- supaya purchasing tahu ini bukan order
-- baru, melainkan order yang pernah mereka putuskan lalu berubah.
--
-- Yang TIDAK direset: purchasing_projected_at. Harga pembanding yang sudah
-- diisi tetap terbawa (dicocokkan per nama item, bukan per posisi baris),
-- jadi order ini bukan "belum diproyeksi" -- cuma item barunya yang kosong,
-- dan itu sudah ditandai badge "Item Kurang" di aplikasi.

alter table public.quotations
  add column if not exists decision_reset_note text,
  add column if not exists decision_reset_at   timestamptz,
  add column if not exists decision_reset_from text;

comment on column public.quotations.decision_reset_note is
  'Kalimat siap tampil: kenapa keputusan purchasing direset. Diisi Calculator.jsx saat estimator menyimpan ulang perhitungan yang sudah diputuskan purchasing.';
comment on column public.quotations.decision_reset_from is
  'Status purchasing sebelum direset (approved/hold/cancelled), supaya purchasing tahu keputusan apa yang hilang.';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. IZIN ESTIMATOR MENGIRIM KE PURCHASING
-- ───────────────────────────────────────────────────────────────────────────
-- Sampai sekarang tombol "Kirim ke Purchasing" hanya ada di ManagerDashboard.
-- Pemilik minta tombol itu ada juga di Antrian Estimator.
--
-- Tabel quotations punya tiga policy UPDATE: "manager write", "sales update
-- own deal status", dan "purchasing update sent" -- tidak ada yang untuk
-- role estimator. Tanpa policy di bawah, tombolnya akan KELIHATAN jalan
-- tapi tidak menyimpan apa pun: PostgREST tidak menganggap UPDATE yang
-- ditolak RLS sebagai error, baris yang kena 0, dan aplikasi mengira
-- berhasil. Bug yang sama persis dengan yang kena Hamam/Nisa.
--
-- Dibatasi ke purchasing_status IS NULL pada klausa USING: estimator boleh
-- MENGIRIM, tapi tidak bisa menyentuh quotation yang sudah dipegang
-- purchasing -- jadi keputusan purchasing tidak bisa ditimpa dari sisi
-- estimator.
--
-- WITH CHECK sengaja tidak mengulang syarat itu. USING menyaring baris
-- SEBELUM diubah (harus belum pernah dikirim); WITH CHECK menyaring baris
-- SESUDAH diubah -- dan baris sesudahnya justru HARUS boleh punya
-- purchasing_status = 'pending', karena itu memang tujuan update-nya.
--
-- CATATAN KEWENANGAN: RLS mengunci per BARIS, bukan per KOLOM. Secara
-- teknis estimator jadi bisa mengubah kolom lain pada baris yang
-- purchasing_status-nya masih null. Itu baris yang memang miliknya sendiri
-- (belum diserahkan ke purchasing), jadi dalam pemakaian normal tidak jadi
-- soal -- sejalan dengan keputusan sadar yang sama untuk policy purchasing
-- di supabase/purchasing_multiuser_migration.sql.
drop policy if exists "quotations: estimator send to purchasing" on public.quotations;
create policy "quotations: estimator send to purchasing" on public.quotations
  for update to authenticated
  using      (get_my_role() = 'estimator' and purchasing_status is null)
  with check (get_my_role() = 'estimator');


-- ───────────────────────────────────────────────────────────────────────────
-- 4. PEMBANDING NAMA VENDOR
-- ───────────────────────────────────────────────────────────────────────────
-- ATURAN BISNIS: hanya order yang dikerjakan di workshop sendiri (vendor
-- Risepack/WO) yang perlu biaya proyeksi purchasing. Order di luar
-- Risepack/WO memakai modal sales sebagai HPP Sales sekaligus COGS Proyeksi.
--
-- Dibuat tahan beda spasi, tanda hubung, dan huruf besar/kecil karena nilai
-- di ERP pernah ditemukan tidak konsisten. nama_vendor juga bisa NULL saat
-- SCM belum mengisinya -- itu yang jadi filter "Belum Ada Data Vendor" di
-- Dashboard Pantau. NULL sengaja TIDAK dianggap Risepack/WO.
--
-- PERIKSA DULU nilai yang benar-benar ada di ERP sebelum percaya daftar ini:
--   select nama_vendor, count(*) from public.erp_orders
--    group by nama_vendor order by count(*) desc;
create or replace function public.is_vendor_workshop(v text)
returns boolean
language sql
immutable
as $$
  select v is not null
     and upper(replace(replace(trim(v), ' ', ''), '-', '/'))
         in ('RISEPACK/WO', 'RISEPACK/WORKSHOP')
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. AUTO-KIRIM KE PURCHASING
-- ───────────────────────────────────────────────────────────────────────────
-- KENAPA DI DATABASE, BUKAN DI HALAMAN
-- Kondisi "deal + sudah ditagging kode order + vendor Risepack/WO" bisa jadi
-- benar dari beberapa arah, dan urutannya tidak tetap:
--   - sales menagging kode order di SalesDashboard
--   - estimator menyimpan HPP untuk order yang sudah deal
--   - SCM mengisi nama_vendor di ERP SETELAH kedua hal di atas terjadi
-- Kalau aturannya ditulis di frontend, ia harus diulang di setiap tempat itu
-- -- dan satu yang kelewat berarti order deal yang tidak pernah sampai ke
-- purchasing. Itu persis masalah yang membuat kartu "Deal belum diproyeksi"
-- perlu ada. Di sini aturannya satu, dan tidak bisa dilewati lewat jalan
-- mana pun.
--
-- SYARAT "HPP SALES SUDAH ADA" otomatis terpenuhi: purchasing_status
-- menempel di baris quotation itu sendiri, jadi barisnya pasti sudah ada.
--
-- SECURITY DEFINER: auto-kirim adalah aturan sistem, bukan aksi user, jadi
-- tidak boleh bergantung pada role siapa yang kebetulan memicunya.
create or replace function public.auto_send_deal_to_purchasing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quot_id uuid := null;
  v_sko     text := null;
begin
  -- NEW punya bentuk berbeda tergantung tabel pemicunya, jadi kuncinya
  -- diambil lebih dulu ke variabel. Menyebut new.sko langsung di dalam
  -- query akan error "record new has no field sko" saat trigger ini
  -- dijalankan dari tabel quotations.
  if tg_table_name = 'quotations' then
    v_quot_id := new.id;
  elsif tg_table_name = 'erp_orders' then
    v_sko := new.sko;
  else
    return null;
  end if;

  update public.quotations q
     set purchasing_status     = 'pending',
         sent_to_purchasing_at = now(),
         sent_to_purchasing_by = null   -- null = dikirim otomatis oleh sistem
   where q.purchasing_status is null
     and q.is_draft  = false
     and q.is_active = true
     and q.deal_status = 'deal'
     and q.kode_order is not null
     and exists (
       select 1 from public.erp_orders e
        where e.sko = q.kode_order
          and public.is_vendor_workshop(e.nama_vendor)
     )
     -- Dibatasi ke baris yang relevan dengan kejadian pemicu, supaya satu
     -- perubahan kecil tidak menyapu seluruh tabel.
     and (
       (v_quot_id is not null and q.id = v_quot_id)
       or
       (v_sko is not null and q.kode_order = v_sko)
     );

  return null;  -- AFTER trigger: nilai kembalian diabaikan
end $$;

comment on function public.auto_send_deal_to_purchasing() is
  'Mengirim quotation ke purchasing begitu syaratnya terpenuhi: deal + kode_order terisi + vendor ERP Risepack/WO + belum pernah dikirim. Dipicu dari dua sisi karena urutan pengisiannya bisa terbalik.';

-- Sisi 1: perubahan pada quotation itu sendiri.
--
-- Daftar kolom pada "update of" juga yang mencegah trigger ini memicu
-- dirinya sendiri: UPDATE di dalam fungsi hanya menyentuh
-- purchasing_status / sent_to_purchasing_at / sent_to_purchasing_by, yang
-- TIDAK ada di daftar ini, jadi tidak ada rekursi.
drop trigger if exists quotations_auto_send_purchasing on public.quotations;
create trigger quotations_auto_send_purchasing
  after insert or update of deal_status, kode_order, is_active, is_draft
  on public.quotations
  for each row
  execute function public.auto_send_deal_to_purchasing();

-- Sisi 2: SCM mengisi nama_vendor di ERP setelah order sudah deal dan
-- ditagging. Tanpa ini, order tersebut tidak akan pernah auto-terkirim.
--
-- Catatan: sinkronisasi ERP menulis nama_vendor untuk semua baris tiap
-- setengah jam, jadi trigger ini ikut jalan ratusan kali per sync. Yang
-- dijalankan hanya satu UPDATE bersyarat yang hampir selalu mengenai 0
-- baris, jadi biayanya kecil. Dan kalau nama_vendor sempat kosong lalu
-- terisi lagi (bug vendor hilang), arah efeknya hanya bisa MENGIRIM, tidak
-- pernah membatalkan kiriman.
drop trigger if exists erp_orders_auto_send_purchasing on public.erp_orders;
create trigger erp_orders_auto_send_purchasing
  after insert or update of nama_vendor
  on public.erp_orders
  for each row
  execute function public.auto_send_deal_to_purchasing();


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. BACKFILL — JANGAN JALANKAN SEKALIGUS
-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger di atas hanya menangkap kejadian BARU. Order yang sudah memenuhi
-- syarat sejak sebelum migrasi ini tidak tersentuh.
--
-- LANGKAH 6a — lihat dulu apa saja dan berapa banyak:
--
--   select q.id, q.kode_order, q.customer_name, q.product_type, q.quantity,
--          e.nama_vendor, q.updated_at
--     from public.quotations q
--     join public.erp_orders e on e.sko = q.kode_order
--    where q.purchasing_status is null
--      and q.is_draft = false and q.is_active = true
--      and q.deal_status = 'deal'
--      and public.is_vendor_workshop(e.nama_vendor)
--    order by q.updated_at desc;
--
-- LANGKAH 6b — baru setelah hasil di atas diperiksa, jalankan ini:
--
--   update public.quotations q
--      set purchasing_status     = 'pending',
--          sent_to_purchasing_at = now(),
--          sent_to_purchasing_by = null
--    where q.purchasing_status is null
--      and q.is_draft  = false
--      and q.is_active = true
--      and q.deal_status = 'deal'
--      and q.kode_order is not null
--      and exists (
--        select 1 from public.erp_orders e
--         where e.sko = q.kode_order
--           and public.is_vendor_workshop(e.nama_vendor)
--      );


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFIKASI SETELAH DIJALANKAN
-- ═══════════════════════════════════════════════════════════════════════════
-- a) Kolom baru ada semua (harus 7 baris):
--    select column_name, data_type, column_default, is_nullable
--      from information_schema.columns
--     where table_name = 'quotations'
--       and column_name in ('needs_revision','revision_note',
--            'revision_requested_at','revision_requested_by',
--            'decision_reset_note','decision_reset_at','decision_reset_from')
--     order by column_name;
--
-- b) Policy UPDATE harus jadi 4 (manager, sales, purchasing, estimator):
--    select policyname, cmd, qual, with_check from pg_policies
--     where schemaname='public' and tablename='quotations' and cmd='UPDATE'
--     order by policyname;
--
-- c) Trigger auto-kirim terpasang di dua tabel (harus 2 baris):
--    select tgname, tgrelid::regclass as tabel from pg_trigger
--     where tgname in ('quotations_auto_send_purchasing',
--                      'erp_orders_auto_send_purchasing');
--
-- d) Sisa order yang memenuhi syarat tapi belum terkirim -- harus 0
--    setelah langkah 6b:
--    select count(*) from public.quotations q
--     where q.purchasing_status is null and q.is_draft=false and q.is_active=true
--       and q.deal_status='deal' and q.kode_order is not null
--       and exists (select 1 from public.erp_orders e
--                    where e.sko=q.kode_order
--                      and public.is_vendor_workshop(e.nama_vendor));
-- ═══════════════════════════════════════════════════════════════════════════
