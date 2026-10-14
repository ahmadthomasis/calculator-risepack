-- ═══════════════════════════════════════════════════════════════════════════
-- PEGANGAN INNERSALES — INNER MENGURUS SALES TERTENTU, BUKAN SEMUA
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Aman dijalankan ulang.
-- Dibuat 14 Okt 2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PERMINTAAN PEMILIK
-- Satu innersales memegang 1-2 akun sales, bukan semuanya. Innersales boleh
-- melihat dan mengubah status deal order sales PEGANGANNYA. Di luar itu tidak
-- ada yang berubah: sales biasa tetap hanya melihat miliknya sendiri, halaman
-- Order Prodev tetap per pembuatnya.
--
-- Keputusan bentuk (pemilik, 14 Okt 2026):
--   - Pemetaannya DISIMPAN, dan yang mengatur adalah MANAGER lewat User
--     Management -- sepola dengan "layouter default" yang sudah ada. Bukan
--     dipilih sendiri oleh innersales, supaya tidak ada yang menambah
--     pegangan tanpa sepengetahuan manager.
--   - BANYAK-KE-BANYAK: satu akun sales boleh dipegang lebih dari satu
--     innersales (berguna saat ada yang cuti). Karena itu bentuknya tabel
--     pemetaan tersendiri, bukan satu kolom di profil sales.
--
-- SIAPA ITU INNERSALES
-- Bukan peran tersendiri. Perannya tetap 'sales', dengan penanda
-- profiles.is_innersales = true -- mekanisme yang sudah ada sejak awal dan
-- dipakai main.jsx (routing Prodev), Layout.jsx (menu sidebar), dan User
-- Management. Per 14 Okt 2026 yang bertanda: wulan, maghfira, annisa.


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TABEL PEMETAAN
-- ───────────────────────────────────────────────────────────────────────────
-- Primary key gabungan sekaligus mencegah pasangan yang sama tercatat dua
-- kali. on delete cascade: kalau akunnya dihapus, pemetaannya ikut hilang dan
-- tidak meninggalkan baris yatim.
create table if not exists public.innersales_sales (
  innersales_id uuid not null references public.profiles(id) on delete cascade,
  sales_id      uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id),
  primary key (innersales_id, sales_id)
);

-- Dipakai policy untuk menjawab "siapa saja pegangan saya" (arah innersales)
-- dan "order ini pegangan siapa" (arah sales).
create index if not exists innersales_sales_sales_idx
  on public.innersales_sales (sales_id);

comment on table public.innersales_sales is
  'Pemetaan innersales -> sales yang dipegangnya. Banyak-ke-banyak: satu sales boleh dipegang beberapa innersales. Diisi manager lewat User Management.';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. FUNGSI PEMERIKSA
-- ───────────────────────────────────────────────────────────────────────────
-- Menjawab: "apakah SAYA seorang innersales yang memegang sales ini?"
--
-- Dua syarat diperiksa sekaligus dan itu disengaja. Kalau hanya memeriksa
-- tabel pemetaan, akun yang penanda is_innersales-nya dimatikan tetap punya
-- akses selama baris pemetaannya belum dibersihkan -- izin yang tertinggal
-- tanpa ada yang sadar. Dengan memeriksa keduanya, mematikan centang
-- innersales langsung mencabut aksesnya.
--
-- security definer: policy harus bisa membaca profiles dan tabel pemetaan
-- walau RLS tabel-tabel itu membatasi. Sepola dengan get_my_role() yang sudah
-- ada (language sql, stable, security definer).
create or replace function public.innersales_handles(p_sales_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles me
      join public.innersales_sales m on m.innersales_id = me.id
     where me.id = auth.uid()
       and me.is_innersales = true
       and m.sales_id = p_sales_id
  )
$$;

comment on function public.innersales_handles(uuid) is
  'True kalau akun yang login adalah innersales (is_innersales = true) DAN memegang sales yang id-nya diberikan.';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. POLICY — TAMBAHAN, TIDAK MENGUBAH YANG LAMA
-- ───────────────────────────────────────────────────────────────────────────
-- Policy "requests: sales own", "quotations: sales read own", dan
-- "quotations: sales update own deal status" TIDAK disentuh. Policy di
-- PostgreSQL bersifat OR, jadi menambah policy hanya menambah kemungkinan
-- akses dan tidak pernah mengurangi. Sales biasa sama sekali tidak
-- terpengaruh, dan innersales tetap melihat ordernya sendiri lewat policy
-- lama itu.

-- requests: baca saja. Innersales tidak diberi izin mengubah requests milik
-- orang lain -- yang boleh diubah hanya status deal, dan itu di quotations.
drop policy if exists "requests: innersales read handled" on public.requests;
create policy "requests: innersales read handled" on public.requests
  for select to authenticated
  using (innersales_handles(sales_id));

-- quotations: baca dan ubah, untuk order milik sales pegangannya.
drop policy if exists "quotations: innersales read handled" on public.quotations;
create policy "quotations: innersales read handled" on public.quotations
  for select to authenticated
  using (exists (
    select 1 from public.requests r
     where r.id = quotations.request_id
       and innersales_handles(r.sales_id)
  ));

drop policy if exists "quotations: innersales update handled" on public.quotations;
create policy "quotations: innersales update handled" on public.quotations
  for update to authenticated
  using (exists (
    select 1 from public.requests r
     where r.id = quotations.request_id
       and innersales_handles(r.sales_id)
  ))
  with check (exists (
    select 1 from public.requests r
     where r.id = quotations.request_id
       and innersales_handles(r.sales_id)
  ));

-- BATAS YANG PERLU DISADARI: RLS mengunci per BARIS, bukan per KOLOM. Secara
-- teknis innersales bisa mengubah kolom lain pada baris quotation pegangannya,
-- bukan hanya deal_status. Aplikasi hanya pernah mengirim deal_status beserta
-- kode_order / deal_price_source / deal_segment_keuangan dari dropdown Status
-- Deal, jadi dalam pemakaian normal tidak jadi soal -- sejalan dengan
-- keputusan sadar yang sama untuk policy purchasing dan estimator.


-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS TABEL PEMETAAN ITU SENDIRI
-- ───────────────────────────────────────────────────────────────────────────
alter table public.innersales_sales enable row level security;

-- Boleh dibaca semua akun yang login: User Management (manager) perlu
-- menampilkannya, dan innersales perlu tahu dia memegang siapa. Isinya hanya
-- pasangan id, bukan data order.
drop policy if exists "innersales_sales: read" on public.innersales_sales;
create policy "innersales_sales: read" on public.innersales_sales
  for select to authenticated
  using (true);

-- Hanya manager yang boleh menentukan siapa memegang siapa.
drop policy if exists "innersales_sales: manager write" on public.innersales_sales;
create policy "innersales_sales: manager write" on public.innersales_sales
  for all to authenticated
  using      (get_my_role() = 'manager')
  with check (get_my_role() = 'manager');


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFIKASI SETELAH DIJALANKAN
-- ═══════════════════════════════════════════════════════════════════════════
-- a) Tabel, index, dan fungsi ada:
--    select to_regclass('public.innersales_sales') as tabel,
--           (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--             where n.nspname='public' and p.proname='innersales_handles') as fungsi;
--
-- b) Policy lama MASIH ADA dan yang baru bertambah:
--    select tablename, policyname, cmd from pg_policies
--     where schemaname='public' and tablename in ('requests','quotations','innersales_sales')
--     order by tablename, cmd, policyname;
--
-- c) Belum ada pegangan yang diisi, jadi untuk sementara innersales masih
--    hanya melihat ordernya sendiri -- itu benar. Pemetaannya diisi manager
--    lewat User Management.
--    select count(*) from public.innersales_sales;   -- 0 di awal
--
-- d) Uji sesudah manager mengisi pegangan:
--    - Login wulan: Request Harga menampilkan ordernya sendiri + order sales
--      pegangannya, dan dropdown Status Deal pada order pegangan bisa diubah.
--    - Login sales di luar pegangannya: tidak berubah sama sekali.
--
-- CARA MEMBATALKAN:
--    drop policy if exists "requests: innersales read handled" on public.requests;
--    drop policy if exists "quotations: innersales read handled" on public.quotations;
--    drop policy if exists "quotations: innersales update handled" on public.quotations;
--    drop function if exists public.innersales_handles(uuid);
--    drop table if exists public.innersales_sales;
-- ═══════════════════════════════════════════════════════════════════════════
