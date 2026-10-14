-- ═══════════════════════════════════════════════════════════════════════════
-- PEMINDAHAN HARGA PEMBANDING SAAT ESTIMATOR SIMPAN ULANG
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang.
-- Dibuat 14 Okt 2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MASALAH
-- Setiap kali estimator menyimpan ulang, Calculator.jsx meng-INSERT baris
-- quotation BARU dan menonaktifkan yang lama. Harga pembanding purchasing
-- menempel pada baris LAMA lewat purchasing_comparisons.quotation_id, jadi
-- harus ikut dipindahkan -- kalau tidak, purchasing membuka order itu dan
-- mendapati kolom harganya kosong semua, padahal kerjanya masih ada,
-- tersangkut di baris yang sudah mati.
--
-- Pemindahan itu dicoba dari sisi aplikasi dan SELALU GAGAL. Policy pada
-- purchasing_comparisons hanya memberi role estimator hak SELECT:
--     purchasing_comparisons: manager write        ALL
--     purchasing_comparisons: purchasing write     ALL
--     purchasing_comparisons: sales estimator read SELECT
-- Jadi INSERT-nya ditolak RLS. Dulu kegagalan itu tidak pernah terlihat
-- karena hasilnya tidak diperiksa; sekarang diperiksa, dan ketahuan.
--
-- Diukur 14 Okt 2026: 358 baris harga menempel di 14 quotation AKTIF,
-- sementara 495 baris menempel di 15 quotation MATI. Jadi kerja purchasing
-- yang tersangkut lebih banyak daripada yang terpakai.
--
-- KENAPA TIDAK SEKADAR MEMBERI ESTIMATOR IZIN TULIS
-- Itu jalan terpendek, tapi artinya estimator boleh menulis dan menghapus
-- harga purchasing kapan saja -- batas peran yang sengaja dibuat di skema
-- ini jadi hilang, demi satu operasi yang sangat sempit. Jadi yang dibuka
-- bukan tabelnya, melainkan SATU operasi tertentu: fungsi di bawah berjalan
-- dengan hak pemilik (security definer), menolak dipanggil role lain, dan
-- hanya mau memindahkan harga DI DALAM request + qty yang sama.
--
-- Keuntungan lain: insert dan delete terjadi dalam SATU transaksi. Versi
-- aplikasi melakukannya dua langkah terpisah, jadi masih mungkin berhenti
-- di tengah -- baris baru sudah masuk tapi yang lama belum terhapus, atau
-- sebaliknya. Di sini tidak bisa: gagal berarti tidak ada yang berubah.
--
-- PENCOCOKAN BARIS tetap dihitung di aplikasi (remapComparisons di
-- Calculator.jsx), karena harus membaca isi baris biaya milik estimator
-- untuk mencocokkan per NAMA ITEM, bukan per posisi baris. Fungsi ini hanya
-- menerima hasil pencocokan itu dan menuliskannya.

create or replace function public.migrate_purchasing_comparisons(
  p_old_quotation uuid,
  p_new_quotation uuid,
  p_rows          jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_req uuid;
  v_old_qty numeric;
  v_new_req uuid;
  v_new_qty numeric;
  v_count   integer := 0;
begin
  -- Hanya peran yang memang menyimpan ulang perhitungan.
  if get_my_role() not in ('estimator', 'manager') then
    raise exception 'Peran % tidak berwenang memindahkan harga pembanding purchasing', get_my_role()
      using errcode = '42501';
  end if;

  select request_id, quantity into v_old_req, v_old_qty
    from quotations where id = p_old_quotation;
  select request_id, quantity into v_new_req, v_new_qty
    from quotations where id = p_new_quotation;

  if v_old_req is null or v_new_req is null then
    raise exception 'Quotation asal atau tujuan tidak ditemukan' using errcode = '22023';
  end if;

  -- PENGAMAN UTAMA: fungsi ini berjalan dengan hak pemilik, jadi harus
  -- dipastikan ia tidak bisa dipakai memindahkan harga antar order yang
  -- tidak berhubungan. Pemindahan hanya sah dalam satu request dan satu qty
  -- -- yaitu persis kasus "estimator menyimpan ulang perhitungan ini".
  if v_old_req <> v_new_req or v_old_qty is distinct from v_new_qty then
    raise exception 'Harga pembanding hanya boleh dipindahkan dalam request dan qty yang sama'
      using errcode = '22023';
  end if;

  if p_old_quotation = p_new_quotation then
    return 0;   -- tidak ada yang perlu dipindahkan
  end if;

  -- Bersihkan tujuan dulu supaya pemanggilan ulang tidak menabrak unique key
  -- (quotation_id, section, row_index).
  delete from purchasing_comparisons where quotation_id = p_new_quotation;

  insert into purchasing_comparisons (
    quotation_id, section, row_index, item_name,
    estimator_price, purchasing_price,
    purchasing_upah, purchasing_bahan, purchasing_mesin,
    notes, updated_at
  )
  select
    p_new_quotation,
    r->>'section',
    (r->>'row_index')::integer,
    nullif(r->>'item_name', ''),
    nullif(r->>'estimator_price',  '')::numeric,
    nullif(r->>'purchasing_price', '')::numeric,
    nullif(r->>'purchasing_upah',  '')::numeric,
    nullif(r->>'purchasing_bahan', '')::numeric,
    nullif(r->>'purchasing_mesin', '')::numeric,
    nullif(r->>'notes', ''),
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  where r->>'section' is not null
    and r->>'row_index' is not null;

  get diagnostics v_count = row_count;

  delete from purchasing_comparisons where quotation_id = p_old_quotation;

  return v_count;
end $$;

comment on function public.migrate_purchasing_comparisons(uuid, uuid, jsonb) is
  'Memindahkan harga pembanding purchasing dari quotation lama ke quotation baru saat estimator menyimpan ulang. Berjalan dengan hak pemilik karena role estimator hanya punya SELECT di purchasing_comparisons; dibatasi ke request + qty yang sama, dan seluruhnya satu transaksi.';

revoke all on function public.migrate_purchasing_comparisons(uuid, uuid, jsonb) from public;
grant execute on function public.migrate_purchasing_comparisons(uuid, uuid, jsonb) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFIKASI
-- ═══════════════════════════════════════════════════════════════════════════
--   select p.proname, p.prosecdef as security_definer
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'migrate_purchasing_comparisons';
--   -- harus 1 baris, security_definer = true
--
-- Hitung ulang harga yang tersangkut di quotation mati (sebelum perbaikan:
-- 495 baris di 15 quotation). Angka ini TIDAK akan turun sendiri -- fungsi
-- di atas hanya mencegah penyangkutan BARU. Untuk yang terlanjur, lihat
-- catatan "PEMULIHAN" di bawah.
--   select q.is_active, count(distinct c.quotation_id) as quotation, count(*) as baris
--     from purchasing_comparisons c join quotations q on q.id = c.quotation_id
--    where q.is_draft = false group by 1 order by 1 desc;


-- ═══════════════════════════════════════════════════════════════════════════
-- PEMULIHAN DATA LAMA — BELUM DIKERJAKAN, BUTUH KEPUTUSAN
-- ═══════════════════════════════════════════════════════════════════════════
-- 495 baris harga purchasing masih menempel di 15 quotation yang sudah mati.
-- Itu kerja purchasing yang sudah dilakukan tapi tidak terbaca aplikasi.
--
-- Memindahkannya TIDAK bisa dilakukan dengan UPDATE quotation_id begitu saja:
-- row_index di baris lama mengacu ke POSISI baris biaya pada perhitungan
-- versi LAMA. Kalau estimator sempat menambah atau menghapus item, posisi itu
-- sudah bergeser, dan memindahkan apa adanya akan menempelkan harga ke item
-- yang salah -- tanpa error, cuma angka yang keliru. Persis bug yang
-- remapComparisons dibuat untuk mencegah.
--
-- Jadi pemulihannya harus mencocokkan per NAMA ITEM antara baris biaya
-- versi lama dan versi aktif, satu per satu, lalu melaporkan mana yang tidak
-- ketemu supaya purchasing memeriksanya manual. Dikerjakan terpisah setelah
-- pemilik memutuskan.
-- ═══════════════════════════════════════════════════════════════════════════
