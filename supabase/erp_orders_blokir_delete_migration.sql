-- ═══════════════════════════════════════════════════════════════════════════
-- SETOP "NAMA VENDOR HILANG" — CABUT IZIN HAPUS MASSAL DI erp_orders
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang.
-- Dibuat 15 Okt 2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DUDUK PERKARANYA (dibuktikan dari log API Supabase, 15 Okt 2026)
-- Ada DUA project Google Apps Script yang menulis ke tabel erp_orders, terlihat
-- dari id project di user-agent-nya:
--
--   Script kita, "Financial Cek"  -> id UAEmdDd_TUaMj8tNoi-hMOBa_mNYrF40-Kw
--     03:19:26  POST   /rest/v1/erp_orders               upsert 207 baris
--     03:19:28  DELETE ?synced_at=lt.<stamp>             prune baris basi
--
--   Script ASING                  -> id UAEmdDd8MozhAtB2shuFxE1Aqam8ejR-h8Q
--     03:39:57  DELETE ?sko=not.is.null                  HAPUS SELURUH TABEL
--     03:39:58  POST   /rest/v1/erp_orders               isi ulang 975 baris
--
-- Script asing itu menjalankan desain LAMA sync ini (hapus semua, lalu insert
-- ulang) -- desain yang sudah diganti jadi upsert-then-prune pada 12 Okt 2026.
-- Payload-nya 175 byte/baris, sedangkan punya kita 369 byte/baris: ia mengirim
-- lebih sedikit kolom, dan nama_vendor termasuk yang tidak dibawanya.
--
-- Akibatnya tabel berganti bentuk dua kali tiap setengah jam:
--   menit :09/:39 -> 975 baris, 0 punya nama_vendor   (script asing)
--   menit :19/:49 -> 207 baris, 203 punya nama_vendor (script kita)
-- Itulah keluhan "nama vendor suka hilang lalu kembali lagi".
--
-- Script asing TIDAK ada di akun Google pemilik -- daftar eksekusi 7 hari
-- terakhir tidak punya satu pun run di menit :09/:39. Jadi ia ada di akun
-- orang lain dan tidak bisa dimatikan dari sini. Tapi ia memakai kredensial
-- Supabase yang SAMA dengan script kita (auth_user dan apikey identik), jadi
-- memblokirnya lewat kredensial berarti ikut mematikan script kita.
--
-- CARA MENGHENTIKANNYA TANPA MENYENTUH AKUN SIAPA PUN
-- Yang merusak bukan POST-nya, tapi DELETE-nya. POST script asing memakai
-- Prefer: resolution=merge-duplicates, yaitu UPSERT -- dan upsert PostgREST
-- hanya menyentuh kolom yang ada di payload. Karena nama_vendor tidak ada di
-- payload-nya, upsert itu TIDAK menimpa nama_vendor baris yang sudah ada.
--
-- Jadi begitu kemampuan menghapus massal dicabut, script asing boleh tetap
-- jalan: ia hanya akan me-refresh kolom yang dibawanya, dan nama_vendor
-- bertahan.
--
-- STATUS: SELURUHNYA SUDAH DIJALANKAN 15 Okt 2026, ~11:10-11:16 WIB.
--   1. Fungsi prune_erp_orders dibuat dan diverifikasi (security definer).
--   2. ErpSync.gs diubah memanggil rpc/prune_erp_orders, disimpan ke Drive.
--   3. syncErpOrders dijalankan manual, log bersih:
--        "Sekarang di Supabase: 975 baris, 0 vendor terisi (0%).
--         Payload baru: 207 baris, 203 vendor terisi (98%)."
--        "Selesai. Sekarang: 207 baris, 203 vendor terisi."
--      Tidak ada peringatan "prune baris basi gagal" -- RPC-nya jalan.
--   4. Policy erp_orders_delete dihapus. Tersisa insert/select/update.
--
-- BUKTI AKHIRNYA, DIUKUR DI JENDELA SCRIPT ASING (15 Okt 2026, 05:10 UTC):
--   05:09:57  script asing jalan -> tabel melompat jadi 975 baris
--   05:10:23  select count(*), count(nama_vendor) from erp_orders
--             -> 975 baris, 203 punya nama_vendor
-- Sebelum perbaikan angka kedua itu SELALU 0 di jendela ini. Jadi terbukti:
-- upsert script asing tidak lagi bisa menghapus apa pun, dan karena
-- nama_vendor tidak ada di payload-nya, kolom itu lolos tak tersentuh.
--
-- Catatan tambahan dari pengukuran yang sama: script asing ternyata IKUT
-- mengirim synced_at (sesudah ia jalan, seluruh 975 baris punya satu stamp
-- yang sama). Itu tidak merusak prune kita -- stamp-nya lebih tua daripada
-- batch berikutnya, jadi baris yang tidak ikut batch kita tetap terbuang di
-- menit :19/:49 seperti seharusnya.
--
-- URUTAN PENERAPAN (penting, jangan dibalik):
--   1. Bagian 1 di bawah -- buat fungsi prune. Aman, cuma menambah.
--   2. Perbarui ErpSync.gs: ganti panggilan DELETE jadi rpc/prune_erp_orders.
--   3. Tunggu satu siklus sync berhasil (menit :19 atau :49), pastikan
--      jumlah baris kembali ke ~207 dan vendornya terisi.
--   4. BARU jalankan Bagian 2 -- cabut policy delete.
-- Kalau dibalik, prune script kita yang mati duluan dan tabel akan terus
-- berisi 975 baris milik script asing.


-- ───────────────────────────────────────────────────────────────────────────
-- BAGIAN 1 — FUNGSI PRUNE (jalankan sekarang)
-- ───────────────────────────────────────────────────────────────────────────
-- Pengganti DELETE ?synced_at=lt.<stamp> yang dipakai ErpSync.gs. Berjalan
-- dengan hak pemilik, jadi tetap bisa menghapus walau policy delete sudah
-- dicabut untuk pemanggil biasa.
--
-- Dua pengaman yang TIDAK dimiliki policy delete lama:
--   - menolak cutoff di masa depan, yang efeknya sama dengan hapus semua
--   - menolak kalau tabel akan jadi kosong total
-- Keduanya membuat fungsi ini lebih sempit daripada izin yang digantikannya,
-- sehingga seandainya pun ada yang memanggilnya sembarangan, kerusakannya
-- tidak bisa sebesar DELETE ?sko=not.is.null.
create or replace function public.prune_erp_orders(p_cutoff timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total   integer;
  v_hapus   integer;
  v_terhapus integer;
begin
  if p_cutoff is null then
    raise exception 'Cutoff prune tidak boleh kosong' using errcode = '22023';
  end if;

  -- Cutoff di masa depan = semua baris lebih tua = hapus seluruh tabel.
  -- Itu persis pola yang sedang kita cegah.
  if p_cutoff > now() then
    raise exception 'Cutoff prune (%) tidak boleh di masa depan', p_cutoff
      using errcode = '22023';
  end if;

  select count(*) into v_total from public.erp_orders;
  select count(*) into v_hapus from public.erp_orders where synced_at < p_cutoff;

  if v_total > 0 and v_hapus >= v_total then
    raise exception
      'Prune ditolak: akan menghapus seluruh % baris erp_orders. '
      'Upsert batch ini kemungkinan tidak berjalan.', v_total
      using errcode = '22023';
  end if;

  delete from public.erp_orders where synced_at < p_cutoff;
  get diagnostics v_terhapus = row_count;
  return v_terhapus;
end $$;

comment on function public.prune_erp_orders(timestamptz) is
  'Membuang baris erp_orders yang tidak ikut di-refresh batch sync terakhir. Menggantikan policy delete massal yang dipakai script sync lama untuk menghapus seluruh tabel. Menolak cutoff masa depan dan menolak mengosongkan tabel.';

revoke all on function public.prune_erp_orders(timestamptz) from public;
grant execute on function public.prune_erp_orders(timestamptz) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BAGIAN 2 — CABUT IZIN HAPUS (JANGAN jalankan sebelum langkah 2 & 3 selesai)
-- ───────────────────────────────────────────────────────────────────────────
-- Policy ini dibuat di supabase/erp_orders_migration.sql dengan catatan
-- "Perlu buat sync script hapus data lama sebelum insert ulang (full
-- refresh)". Desain itu sudah tidak dipakai sejak 12 Okt 2026 -- sync kita
-- sekarang upsert-then-prune. Yang masih memakainya hanya script asing.
--
-- RLS menolak secara default kalau tidak ada policy yang cocok, jadi
-- menghapus policy ini membuat DELETE lewat PostgREST gagal untuk SEMUA
-- pemanggil, termasuk script asing. Penghapusan yang sah tetap bisa lewat
-- fungsi prune_erp_orders di atas.
--
--   drop policy if exists "erp_orders_delete" on public.erp_orders;
--
-- Sesudah dijalankan, DELETE dari script asing akan mendapat 401/403 dan
-- tabelnya tidak lagi dikosongkan. POST-nya tetap berhasil, tapi karena upsert
-- hanya menyentuh kolom yang dibawanya, nama_vendor tidak ikut terhapus.


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFIKASI
-- ═══════════════════════════════════════════════════════════════════════════
-- Sesudah Bagian 1:
--   select proname, prosecdef from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and proname='prune_erp_orders';
--
-- Sesudah Bagian 2 -- policy delete harus hilang, select/insert/update tetap:
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='erp_orders' order by cmd;
--
-- Pembuktian akhirnya ada di data, bukan di policy. Pantau beberapa siklus:
--   select date_trunc('minute', synced_at) as menit_utc,
--          count(*) as baris, count(nama_vendor) as ada_vendor
--     from erp_orders group by 1 order by 1 desc limit 10;
-- Yang diharapkan: jumlah baris berhenti melompat 207 <-> 975, dan ada_vendor
-- tidak pernah lagi jatuh ke 0.
-- ═══════════════════════════════════════════════════════════════════════════
