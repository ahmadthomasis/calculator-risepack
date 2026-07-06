-- ═══════════════════════════════════════════════════════════════════════════
-- PRODEV — INTEGRASI PACDORA (Level 1) + NAMA CUSTOMER + FILE DESAIN/HASIL
-- Jalankan di Supabase Dashboard → SQL Editor SETELAH prodev_migration.sql.
-- Aman dijalankan ulang (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Kolom baru di prodev_orders ──────────────────────────────────────────
-- nama_customer        : nama orang/PIC konsumen, TERPISAH dari customer_name (nama perusahaan)
-- template_url         : link template dieline Pacdora untuk order ini (dari Template Library / manual)
-- design_files         : file desain dari konsumen (pdf/ai/cdr/eps/zip) — [{url,name}]
-- layout_result_files  : file hasil layout dari layouter (export dieline) — [{url,name}]
alter table public.prodev_orders add column if not exists nama_customer       text;
alter table public.prodev_orders add column if not exists template_url        text;
alter table public.prodev_orders add column if not exists design_files        jsonb not null default '[]'::jsonb;
alter table public.prodev_orders add column if not exists layout_result_files jsonb not null default '[]'::jsonb;

-- ── 2. Tabel Template Library (model layout → link template resmi Pacdora) ───
create table if not exists public.prodev_templates (
  id          uuid primary key default gen_random_uuid(),
  kategori    text not null,                 -- cth. 'Tuck End', 'FEFCO', 'Rigid'
  nama_model  text not null,                 -- cth. 'Reverse tuck end box'
  pacdora_url text,                          -- link kategori/template resmi Pacdora (terverifikasi)
  keterangan  text,
  sort        int  not null default 100,
  created_at  timestamptz not null default now()
);

create index if not exists prodev_templates_kategori_idx on public.prodev_templates (kategori);

alter table public.prodev_templates enable row level security;

-- Semua user login boleh baca (innersales & layouter perlu pilih/lihat template)
drop policy if exists "prodev_templates_select" on public.prodev_templates;
create policy "prodev_templates_select" on public.prodev_templates
  for select to authenticated using (true);

-- Hanya manager boleh menambah/ubah/hapus template (pakai fungsi is_manager dari migration pertama)
drop policy if exists "prodev_templates_insert" on public.prodev_templates;
create policy "prodev_templates_insert" on public.prodev_templates
  for insert to authenticated with check (public.is_manager());

drop policy if exists "prodev_templates_update" on public.prodev_templates;
create policy "prodev_templates_update" on public.prodev_templates
  for update to authenticated using (public.is_manager());

drop policy if exists "prodev_templates_delete" on public.prodev_templates;
create policy "prodev_templates_delete" on public.prodev_templates
  for delete to authenticated using (public.is_manager());

-- ── 3. Seed Template Library ────────────────────────────────────────────────
-- URL memakai halaman KATEGORI resmi Pacdora (slug terverifikasi 6 Juli 2026).
-- Manager bisa mengganti tiap URL dengan link template spesifik
-- (pola: https://www.pacdora.com/dielines-detail/<slug>-<id>) lewat halaman Template.
-- Seed hanya dijalankan kalau tabel masih kosong (tidak menimpa perubahan manual).
insert into public.prodev_templates (kategori, nama_model, pacdora_url, sort)
select * from (values
  -- Tuck End
  ('Tuck End', 'Reverse tuck end box',        'https://www.pacdora.com/dielines/tuck-end-box-dielines', 10),
  ('Tuck End', 'Same panel tuck end box',     'https://www.pacdora.com/dielines/tuck-end-box-dielines', 11),
  ('Tuck End', 'Side tuck end box',           'https://www.pacdora.com/dielines/tuck-end-box-dielines', 12),
  ('Tuck End', 'Open tuck end box',           'https://www.pacdora.com/dielines/tuck-end-box-dielines', 13),
  ('Tuck End', 'Tuck end snap lock handle box','https://www.pacdora.com/dielines/tuck-end-box-dielines', 14),
  ('Tuck End', 'Cosmetics / product tuck end box','https://www.pacdora.com/dielines/tuck-end-box-dielines', 15),
  ('Tuck End', 'Medicine box',                'https://www.pacdora.com/dielines/tuck-end-box-dielines', 16),
  ('Tuck End', 'Perfume box (tuck end)',      'https://www.pacdora.com/dielines/tuck-end-box-dielines', 17),
  -- Tuck End Variation / Auto-lock
  ('Auto-Lock / Snap-Lock', 'Auto lock bottom box',        'https://www.pacdora.com/dielines/tuck-end-box-variation-dielines', 20),
  ('Auto-Lock / Snap-Lock', 'Tuck end box snap lock',      'https://www.pacdora.com/dielines/tuck-end-box-variation-dielines', 21),
  ('Auto-Lock / Snap-Lock', 'Auto bottom snap lock (back open)','https://www.pacdora.com/dielines/tuck-end-box-variation-dielines', 22),
  ('Auto-Lock / Snap-Lock', 'Gable tuck end box / suitcase','https://www.pacdora.com/dielines/tuck-end-box-variation-dielines', 23),
  -- FEFCO
  ('FEFCO', 'FEFCO 0201 regular slotted box (RSC)', 'https://www.pacdora.com/dielines/fefco-box-templates', 30),
  ('FEFCO', 'FEFCO 0203 full overlap slotted box (FOL)', 'https://www.pacdora.com/dielines/fefco-box-templates', 31),
  ('FEFCO', 'FEFCO 0217 carrying handle top box', 'https://www.pacdora.com/dielines/fefco-box-templates', 32),
  ('FEFCO', 'FEFCO 0426 tray self-locking + hinged lid', 'https://www.pacdora.com/dielines/fefco-box-templates', 33),
  ('FEFCO', 'FEFCO 0471', 'https://www.pacdora.com/dielines/fefco-box-templates', 34),
  -- Folding / Mailer / Food
  ('Folding / Mailer', 'Rollover hinged lid mailer box', 'https://www.pacdora.com/dielines/folding-box-dielines', 40),
  ('Folding / Mailer', 'Tuck end mailer box',            'https://www.pacdora.com/dielines/folding-box-dielines', 41),
  ('Folding / Mailer', 'Mailer box hook',                'https://www.pacdora.com/dielines/folding-box-dielines', 42),
  ('Folding / Mailer', 'Box with folding lid',           'https://www.pacdora.com/dielines/folding-box-dielines', 43),
  ('Folding / Mailer', 'Tear and pull flat box',         'https://www.pacdora.com/dielines/folding-box-dielines', 44),
  ('Folding / Mailer', 'Gable box',                      'https://www.pacdora.com/dielines/folding-box-dielines', 45),
  ('Food Packaging', 'French fries / chips box',         'https://www.pacdora.com/dielines/folding-box-dielines', 50),
  ('Food Packaging', 'Burger box',                       'https://www.pacdora.com/dielines/folding-box-dielines', 51),
  ('Food Packaging', 'Pizza box',                        'https://www.pacdora.com/dielines/folding-box-dielines', 52),
  ('Food Packaging', 'Cake box with handle',             'https://www.pacdora.com/dielines/folding-box-dielines', 53),
  -- Display
  ('Display / POS', 'POS display box',       'https://www.pacdora.com/dielines/display-box-dielines', 60),
  ('Display / POS', 'Bevel display box',     'https://www.pacdora.com/dielines/display-box-dielines', 61),
  ('Display / POS', 'Back display / stand',  'https://www.pacdora.com/dielines/display-box-dielines', 62),
  -- Rigid / Flip / Drawer
  ('Rigid / Flip / Drawer', 'Flip top magnetic gift box', 'https://www.pacdora.com/dielines/rigid-box-dielines', 70),
  ('Rigid / Flip / Drawer', 'Hinged flip lid rigid box',  'https://www.pacdora.com/dielines/rigid-box-dielines', 71),
  ('Rigid / Flip / Drawer', 'Luxury rigid box',           'https://www.pacdora.com/dielines/rigid-box-dielines', 72),
  ('Rigid / Flip / Drawer', 'Shoulder / neck box',        'https://www.pacdora.com/dielines/rigid-box-dielines', 73),
  ('Rigid / Flip / Drawer', 'Drawer / match box',         'https://www.pacdora.com/dielines/rigid-box-dielines', 74),
  ('Rigid / Flip / Drawer', 'Jewellery drawer box',       'https://www.pacdora.com/dielines/rigid-box-dielines', 75),
  ('Rigid / Flip / Drawer', 'Sliding surprise gift box',  'https://www.pacdora.com/dielines/rigid-box-dielines', 76),
  ('Rigid / Flip / Drawer', 'Flip top perfume box',       'https://www.pacdora.com/dielines/rigid-box-dielines', 77),
  -- Box with Lid / Telescopic
  ('Box with Lid / Telescopic', 'Telescopic box (lid + base)',       'https://www.pacdora.com/dielines/box-with-lid-dielines', 80),
  ('Box with Lid / Telescopic', 'Corrugated lid & base (double wall)','https://www.pacdora.com/dielines/box-with-lid-dielines', 81),
  ('Box with Lid / Telescopic', 'Square gift cake box with lid',      'https://www.pacdora.com/dielines/box-with-lid-dielines', 82),
  ('Box with Lid / Telescopic', 'Shoe box',                          'https://www.pacdora.com/dielines/box-with-lid-dielines', 83),
  -- Window
  ('Window Box', 'Flip top cookies box with window', 'https://www.pacdora.com/dielines/window-box-templates', 90),
  ('Window Box', 'Sandwich box with window',         'https://www.pacdora.com/dielines/window-box-templates', 91),
  -- Paper Bag
  ('Paper Bag', 'Paper bag',          'https://www.pacdora.com/dielines/paper-bag-dielines', 100),
  ('Paper Bag', 'Brown paper bag',    'https://www.pacdora.com/dielines/paper-bag-dielines', 101),
  ('Paper Bag', 'Shopping paper bag', 'https://www.pacdora.com/dielines/paper-bag-dielines', 102),
  ('Paper Bag', 'Cake paper bag',     'https://www.pacdora.com/dielines/paper-bag-dielines', 103)
) as v(kategori, nama_model, pacdora_url, sort)
where not exists (select 1 from public.prodev_templates);

-- ── 4. Bucket storage untuk file prodev (desain konsumen + hasil layout) ─────
-- Publik (read via getPublicUrl seperti bucket gambar yang sudah ada),
-- limit 100 MB/file, semua tipe file diizinkan (pdf/ai/cdr/eps/zip/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prodev-files', 'prodev-files', true, 104857600, null)
on conflict (id) do update
  set public = true, file_size_limit = 104857600, allowed_mime_types = null;

-- Policy: user login boleh upload; siapa saja boleh baca (bucket publik)
drop policy if exists "prodev_files_insert" on storage.objects;
create policy "prodev_files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'prodev-files');

drop policy if exists "prodev_files_select" on storage.objects;
create policy "prodev_files_select" on storage.objects
  for select to public using (bucket_id = 'prodev-files');

drop policy if exists "prodev_files_update" on storage.objects;
create policy "prodev_files_update" on storage.objects
  for update to authenticated using (bucket_id = 'prodev-files');

drop policy if exists "prodev_files_delete" on storage.objects;
create policy "prodev_files_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'prodev-files');

-- ═══════════════════════════════════════════════════════════════════════════
-- SETELAH MIGRATION:
-- 1. Login sebagai manager → menu "Template" → cek/rapikan daftar model &
--    (opsional) ganti URL kategori dengan URL template spesifik dari Pacdora.
-- 2. Kalau file desain konsumen sering > 100 MB, naikkan file_size_limit
--    bucket 'prodev-files' di Supabase Dashboard → Storage → Settings.
-- ═══════════════════════════════════════════════════════════════════════════
