-- Eten! – database-opzet versie 1
-- Plak dit hele bestand in Supabase > SQL Editor en klik op Run.
-- Het is veilig om dit bestand nogmaals te draaien: bestaande gegevens blijven staan.

create extension if not exists pgcrypto;

-- ── Huishouden en leden ─────────────────────────────────────────────
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ons huishouden',
  persons int not null default 2 check (persons between 1 and 20),
  std_days text[] not null default '{ma,di,wo,do,vr,za,zo}',
  sort_by_afd boolean not null default false,
  afd_order text[] not null default '{AGF,"Vlees & vis",Zuivel,Brood,Houdbaar,Diepvries,Overig}',
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.my_household()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.members where user_id = auth.uid()
$$;

-- ── Categorieën en maaltijden ───────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  name text not null,
  position int not null default 0,
  counts_for_shopping boolean not null default true,
  created_at timestamptz not null default now()
);

-- ingredients: [{ "n": "Kipfilet", "q": 125, "u": "g", "a": "Vlees & vis" }]  (hoeveelheid per persoon)
-- parts (samengestelde maaltijd): [{ "name": "Groente", "letter": "G", "afd": "AGF",
--          "options": [{ "name": "Broccoli", "ingredients": [ ... ] }] }]
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  name text not null,
  category_id uuid references public.categories (id) on delete set null,
  type text not null default 'compleet' check (type in ('compleet', 'samen')),
  photo_path text,
  prep text not null default '',
  extras_on boolean not null default false,
  extras text[] not null default '{}',
  ingredients jsonb not null default '[]',
  parts jsonb not null default '[]',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Planning ────────────────────────────────────────────────────────
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.slots (
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  day date not null,
  mode text not null default 'leeg' check (mode in ('leeg', 'cat', 'vast')),
  category_id uuid references public.categories (id) on delete set null,
  meal_id uuid references public.meals (id) on delete set null,
  picks int[] not null default '{}',
  extras text[] not null default '{}',
  mark text check (mark in ('Restjes', 'Uit eten', 'Bestellen')),
  shopped boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, day)
);

create table if not exists public.shop_marks (
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  key text not null,
  in_home boolean not null default false,
  in_cart boolean not null default false,
  primary key (household_id, key)
);

-- ── Eerste keer inloggen: huishouden + startcategorieën + AGV ───────
create or replace function public.ensure_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  agv uuid;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;

  select household_id into hid from public.members where user_id = auth.uid();
  if hid is not null then
    return hid;
  end if;

  insert into public.households default values returning id into hid;
  insert into public.members (user_id, household_id) values (auth.uid(), hid);

  insert into public.categories (household_id, name, position, counts_for_shopping) values
    (hid, 'AGV', 0, true),
    (hid, 'Pasta', 1, true),
    (hid, 'Rijst', 2, true),
    (hid, 'Ovenschotel', 3, true),
    (hid, 'Salade', 4, true),
    (hid, 'Lekker', 5, true),
    (hid, 'Variatie', 6, true),
    (hid, 'Bestellen/halen', 7, false);

  select id into agv from public.categories where household_id = hid and name = 'AGV';

  insert into public.meals (household_id, name, category_id, type, parts) values
    (hid, 'AGV', agv, 'samen',
     '[{"name":"Aardappelen","letter":"A","afd":"AGF","options":[]},
       {"name":"Groente","letter":"G","afd":"AGF","options":[]},
       {"name":"Vlees / vis / vega","letter":"V","afd":"Vlees & vis","options":[]}]'::jsonb);

  return hid;
end;
$$;

grant execute on function public.my_household() to authenticated;
grant execute on function public.ensure_household() to authenticated;

-- ── Beveiliging: iedereen ziet alleen zijn eigen huishouden ─────────
alter table public.households enable row level security;
alter table public.members    enable row level security;
alter table public.categories enable row level security;
alter table public.meals      enable row level security;
alter table public.programs   enable row level security;
alter table public.slots      enable row level security;
alter table public.shop_marks enable row level security;

drop policy if exists "eigen huishouden" on public.households;
create policy "eigen huishouden" on public.households
  for all to authenticated
  using (id = public.my_household()) with check (id = public.my_household());

drop policy if exists "eigen lidmaatschap" on public.members;
create policy "eigen lidmaatschap" on public.members
  for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories', 'meals', 'programs', 'slots', 'shop_marks'] loop
    execute format('drop policy if exists "eigen huishouden" on public.%I', t);
    execute format('create policy "eigen huishouden" on public.%I for all to authenticated
                    using (household_id = public.my_household())
                    with check (household_id = public.my_household())', t);
  end loop;
end $$;

-- ── Foto's: privé map per huishouden ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "fotos eigen huishouden lezen" on storage.objects;
create policy "fotos eigen huishouden lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_household()::text);

drop policy if exists "fotos eigen huishouden toevoegen" on storage.objects;
create policy "fotos eigen huishouden toevoegen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_household()::text);

drop policy if exists "fotos eigen huishouden wijzigen" on storage.objects;
create policy "fotos eigen huishouden wijzigen" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_household()::text);

drop policy if exists "fotos eigen huishouden verwijderen" on storage.objects;
create policy "fotos eigen huishouden verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_household()::text);
