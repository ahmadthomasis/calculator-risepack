-- ═══════════════════════════════════════════════════════════════════════════
-- MODUL PRODEV — FPS (Formulir Permintaan Sampel) & FSA (Formulir Simulasi Artwork)
-- Jalankan di Supabase Dashboard → SQL Editor, SATU KALI, urut dari atas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Kolom baru di profiles ────────────────────────────────────────────────
-- is_innersales: flag untuk user role 'sales' yang juga bertugas sebagai innersales
--   (bisa membuat FPS/FSA). Sales biasa tetap false.
-- default_layouter_id: pemetaan tetap innersales → PIC layouter
--   (cth. Wulan → Adit, Anis → Fauziyah). Dipakai untuk auto-assign saat buat form.
alter table public.profiles
  add column if not exists is_innersales boolean not null default false;

alter table public.profiles
  add column if not exists default_layouter_id uuid references public.profiles(id) on delete set null;

-- ── 2. Role baru 'prodev' ────────────────────────────────────────────────────
-- CATATAN: kalau kolom profiles.role TIDAK punya CHECK constraint, blok ini tidak
-- melakukan apa-apa dan role 'prodev' langsung bisa dipakai.
-- Cek constraint yang ada dengan:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conrelid = 'public.profiles'::regclass;
-- Kalau ada constraint role dengan nama LAIN dari 'profiles_role_check',
-- ganti namanya di bawah ini sebelum menjalankan.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('sales','estimator','manager','purchasing','prodev'));

-- ── 3. Tabel utama prodev_orders ─────────────────────────────────────────────
create table if not exists public.prodev_orders (
  id                    uuid primary key default gen_random_uuid(),
  form_type             text not null check (form_type in ('fps','fsa')),

  -- ── Informasi konsumen (halaman 1 formulir) ──
  kode_order            text,                              -- manual, cth. 03/RSP23944/4670/I/2404/D
  customer_name         text not null,                     -- nama perusahaan
  contact               text,                              -- email / no. WA
  brand_name            text,                              -- nama product/brand
  tanggal_pengajuan     date not null default ((now() at time zone 'Asia/Jakarta')::date),
  deadline              date,
  pic_sales             text,                              -- nama PIC sales
  jenis_kemasan         text,                              -- Softbox/Hardbox/Corrugated Box/Stiker/...
  model_layout          text,                              -- cth. Tuck end snaplock
  status_jasa           text check (status_jasa in ('non_jasa_desain','jasa_desain')),
  urgensi               text,                              -- Presentasi/Pitching/Dikirim/Difoto
  jumlah_part           smallint,                          -- jumlah part dengan sekat
  jumlah_kebutuhan      text,                              -- cth. "1 pcs (total 5 pcs)"
  potensial_omzet       text,

  -- ── Deskripsi produk ──
  dimensi_produk        text,                              -- P x L x T (cm)
  lp_layout             jsonb not null default '[]'::jsonb,      -- array string, per part
  dimensi_kemasan       jsonb not null default '[]'::jsonb,      -- array string, per part
  bahan_kemasan         text,
  berat_produk          text,
  finishing             jsonb not null default '[]'::jsonb,      -- array string
  jenis_sambungan       text,
  finishing_lainnya     text,

  -- ── Lampiran ──
  lampiran_text         text,
  lampiran_link         text,                              -- link Google Drive
  lampiran_images       jsonb not null default '[]'::jsonb,      -- array URL storage

  -- ── Workflow ──
  created_by            uuid not null references public.profiles(id),
  layouter_id           uuid references public.profiles(id),
  sample_maker_id       uuid references public.profiles(id),
  tanggal_selesai_layout date,
  tanggal_selesai_rakit  date,
  status_dummy_final    text,                              -- khusus FSA: 'tersedia' | null
  is_cancelled          boolean not null default false,

  -- ── Penilaian akhir (diisi innersales) ──
  status_diterima_sales boolean not null default false,
  revisi_konsumen       smallint not null default 0,
  revisi_prodev         smallint not null default 0,
  tingkat_kepuasan      text,                              -- 'puas' | 'tidak_puas'
  status_deal           text,                              -- 'deal' | 'follow_up'
  status_bayar          text,                              -- 'gratis' | 'bayar'
  keterangan            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists prodev_orders_created_by_idx on public.prodev_orders (created_by);
create index if not exists prodev_orders_layouter_idx   on public.prodev_orders (layouter_id);
create index if not exists prodev_orders_form_type_idx  on public.prodev_orders (form_type);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table public.prodev_orders enable row level security;

-- Semua user login boleh baca (prodev, innersales, manager perlu lihat semua)
drop policy if exists "prodev_orders_select" on public.prodev_orders;
create policy "prodev_orders_select" on public.prodev_orders
  for select to authenticated using (true);

-- Insert: hanya atas nama sendiri
drop policy if exists "prodev_orders_insert" on public.prodev_orders;
create policy "prodev_orders_insert" on public.prodev_orders
  for insert to authenticated with check (created_by = auth.uid());

-- Update: semua user login (layouter/sample maker isi tanggal, innersales isi penilaian)
drop policy if exists "prodev_orders_update" on public.prodev_orders;
create policy "prodev_orders_update" on public.prodev_orders
  for update to authenticated using (true);

-- Delete: hanya pembuat, dan hanya kalau layout belum dikerjakan
drop policy if exists "prodev_orders_delete" on public.prodev_orders;
create policy "prodev_orders_delete" on public.prodev_orders
  for delete to authenticated
  using (created_by = auth.uid() and tanggal_selesai_layout is null);

-- ── 5. Manager boleh update flag innersales & pemetaan layouter di profiles ──
-- Fungsi security definer untuk hindari infinite recursion RLS pada profiles.
create or replace function public.is_manager()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

drop policy if exists "profiles_manager_update" on public.profiles;
create policy "profiles_manager_update" on public.profiles
  for update to authenticated using (public.is_manager());

-- ── 6. Realtime ──────────────────────────────────────────────────────────────
-- Supaya queue prodev & dashboard innersales update otomatis.
-- Kalau error "already member of publication", abaikan — berarti sudah aktif.
alter publication supabase_realtime add table public.prodev_orders;

-- ── 7. Trigger updated_at ────────────────────────────────────────────────────
create or replace function public.prodev_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prodev_orders_updated_at on public.prodev_orders;
create trigger prodev_orders_updated_at
  before update on public.prodev_orders
  for each row execute function public.prodev_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- SETELAH MIGRATION:
-- 1. Buat user prodev (Adit, Fauziyah, Kiki) lewat User Management dengan role
--    'prodev'. CATATAN: kalau Edge Function 'create-user' menolak role 'prodev',
--    buat user dengan role lain dulu lalu ubah role-nya via SQL:
--      update public.profiles set role = 'prodev' where id = 'USER_UUID';
-- 2. Di User Management, centang "Innersales" pada akun sales yang bertugas
--    sebagai innersales, lalu pilih PIC Layouter default-nya
--    (cth. Wulan → Adit, Anis → Fauziyah).
-- ═══════════════════════════════════════════════════════════════════════════
