-- ============================================================================
-- Digital Wardrobe & Outfit Builder — Supabase schema
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Idempotent: safe to re-run.
--
-- Design:
--  * Categories are fully user-defined, nested via parent_id (no hardcoding).
--  * System filters are typed columns on wardrobe_items (fast, indexable).
--  * Custom fields store typed values (no JSON blob) so filtering stays safe.
--  * Every row is owned by auth.uid(); RLS enforces isolation on all tables.
--  * Images live in the public "wardrobe" storage bucket under <uid>/... paths.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- categories — user-defined tree
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  icon        text,
  color       text,
  position    int  not null default 0,
  parent_id   uuid references public.categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_user_idx   on public.categories (user_id);
create index if not exists categories_parent_idx on public.categories (parent_id);

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wardrobe_items — system filter fields are first-class columns
-- ---------------------------------------------------------------------------
create table if not exists public.wardrobe_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name           text not null,
  notes          text,
  category_id    uuid references public.categories (id) on delete set null,

  colors         text[] not null default '{}',
  brand          text,
  seasons        text[] not null default '{}',   -- SPRING | SUMMER | FALL | WINTER | ALL_SEASON
  occasions      text[] not null default '{}',
  style          text,
  materials      text[] not null default '{}',
  fit            text,
  pattern        text,
  price          numeric(10,2),
  wear_count     int  not null default 0,
  last_worn_at   timestamptz,
  laundry_status text not null default 'CLEAN'
                 check (laundry_status in ('CLEAN','DIRTY','IN_LAUNDRY')),
  is_favorite    boolean not null default false,
  is_active      boolean not null default true,
  purchase_date  date,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists items_user_idx          on public.wardrobe_items (user_id);
create index if not exists items_user_category_idx on public.wardrobe_items (user_id, category_id);
create index if not exists items_user_favorite_idx on public.wardrobe_items (user_id, is_favorite);
create index if not exists items_user_laundry_idx  on public.wardrobe_items (user_id, laundry_status);
create index if not exists items_user_brand_idx    on public.wardrobe_items (user_id, brand);
create index if not exists items_name_idx          on public.wardrobe_items using gin (to_tsvector('simple', name));

drop trigger if exists items_updated_at on public.wardrobe_items;
create trigger items_updated_at before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- item_images — Supabase Storage backed, position 0 = cover
-- ---------------------------------------------------------------------------
create table if not exists public.item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.wardrobe_items (id) on delete cascade,
  path        text not null,           -- storage object path: <uid>/<item>/<file>
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists item_images_item_idx on public.item_images (item_id);

-- ---------------------------------------------------------------------------
-- tags — free-form labels, many-to-many with items
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.item_tags (
  item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (item_id, tag_id)
);

create index if not exists item_tags_tag_idx on public.item_tags (tag_id);

-- ---------------------------------------------------------------------------
-- custom fields — user-defined attributes with typed values
-- ---------------------------------------------------------------------------
create table if not exists public.custom_fields (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  type       text not null check (type in ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  options    text[] not null default '{}',  -- allowed values for SELECT / MULTI_SELECT
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

drop trigger if exists custom_fields_updated_at on public.custom_fields;
create trigger custom_fields_updated_at before update on public.custom_fields
  for each row execute function public.set_updated_at();

create table if not exists public.custom_field_values (
  id            uuid primary key default gen_random_uuid(),
  field_id      uuid not null references public.custom_fields (id) on delete cascade,
  item_id       uuid not null references public.wardrobe_items (id) on delete cascade,
  value_text    text,
  value_number  double precision,
  value_boolean boolean,
  value_options text[] not null default '{}', -- SELECT: one entry, MULTI_SELECT: many
  unique (field_id, item_id)
);

create index if not exists cfv_item_idx on public.custom_field_values (item_id);

-- ---------------------------------------------------------------------------
-- outfits
-- ---------------------------------------------------------------------------
create table if not exists public.outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  notes       text,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists outfits_user_idx on public.outfits (user_id);

drop trigger if exists outfits_updated_at on public.outfits;
create trigger outfits_updated_at before update on public.outfits
  for each row execute function public.set_updated_at();

create table if not exists public.outfit_items (
  id               uuid primary key default gen_random_uuid(),
  outfit_id        uuid not null references public.outfits (id) on delete cascade,
  item_id          uuid not null references public.wardrobe_items (id) on delete cascade,
  slot_category_id uuid references public.categories (id) on delete set null,
  position         int not null default 0,
  unique (outfit_id, item_id)
);

create index if not exists outfit_items_item_idx on public.outfit_items (item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every user sees only their own data
-- ---------------------------------------------------------------------------
alter table public.categories          enable row level security;
alter table public.wardrobe_items      enable row level security;
alter table public.item_images         enable row level security;
alter table public.tags                enable row level security;
alter table public.item_tags           enable row level security;
alter table public.custom_fields       enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.outfits             enable row level security;
alter table public.outfit_items        enable row level security;

-- direct ownership
drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own items" on public.wardrobe_items;
create policy "own items" on public.wardrobe_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tags" on public.tags;
create policy "own tags" on public.tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own custom_fields" on public.custom_fields;
create policy "own custom_fields" on public.custom_fields
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own outfits" on public.outfits;
create policy "own outfits" on public.outfits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ownership via parent item / outfit
drop policy if exists "own item_images" on public.item_images;
create policy "own item_images" on public.item_images
  for all
  using (exists (select 1 from public.wardrobe_items i
                 where i.id = item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.wardrobe_items i
                      where i.id = item_id and i.user_id = auth.uid()));

drop policy if exists "own item_tags" on public.item_tags;
create policy "own item_tags" on public.item_tags
  for all
  using (exists (select 1 from public.wardrobe_items i
                 where i.id = item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.wardrobe_items i
                      where i.id = item_id and i.user_id = auth.uid()));

drop policy if exists "own custom_field_values" on public.custom_field_values;
create policy "own custom_field_values" on public.custom_field_values
  for all
  using (exists (select 1 from public.wardrobe_items i
                 where i.id = item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.wardrobe_items i
                      where i.id = item_id and i.user_id = auth.uid()));

drop policy if exists "own outfit_items" on public.outfit_items;
create policy "own outfit_items" on public.outfit_items
  for all
  using (exists (select 1 from public.outfits o
                 where o.id = outfit_id and o.user_id = auth.uid()))
  with check (exists (select 1 from public.outfits o
                      where o.id = outfit_id and o.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage — public "wardrobe" bucket; users write only inside <their-uid>/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', true)
on conflict (id) do nothing;

drop policy if exists "wardrobe images are publicly readable" on storage.objects;
create policy "wardrobe images are publicly readable" on storage.objects
  for select using (bucket_id = 'wardrobe');

drop policy if exists "users upload own wardrobe images" on storage.objects;
create policy "users upload own wardrobe images" on storage.objects
  for insert with check (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own wardrobe images" on storage.objects;
create policy "users update own wardrobe images" on storage.objects
  for update using (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own wardrobe images" on storage.objects;
create policy "users delete own wardrobe images" on storage.objects
  for delete using (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
