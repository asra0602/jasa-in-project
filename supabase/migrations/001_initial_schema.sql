-- Jasa-in initial schema. Apply through Supabase SQL Editor or Supabase CLI.
create extension if not exists pgcrypto;

create type public.account_role as enum ('buyer', 'seller', 'admin');
create type public.service_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed');
create type public.payment_status as enum ('pending', 'submitted', 'confirmed', 'rejected', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text unique,
  role public.account_role not null default 'buyer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,30}$')
);

create table public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  store_name text not null,
  store_slug text not null unique,
  bio text not null default '',
  qris_static_payload text,
  qris_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_slug_format check (store_slug ~ '^[a-z0-9-]{3,40}$')
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete restrict,
  title text not null,
  slug text not null,
  description text not null default '',
  category text not null,
  price_idr bigint not null check (price_idr > 0),
  cover_image_url text,
  status public.service_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, slug)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(user_id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  subtotal_idr bigint not null check (subtotal_idr > 0),
  platform_fee_idr bigint not null default 0 check (platform_fee_idr >= 0),
  total_idr bigint not null check (total_idr > 0),
  buyer_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_title_snapshot text not null,
  unit_price_idr bigint not null check (unit_price_idr > 0),
  quantity integer not null default 1 check (quantity > 0),
  line_total_idr bigint not null check (line_total_idr > 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(user_id) on delete restrict,
  amount_idr bigint not null check (amount_idr > 0),
  status public.payment_status not null default 'pending',
  qris_payload text,
  proof_image_path text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(user_id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index services_public_catalog_idx on public.services(status, created_at desc);
create index services_seller_idx on public.services(seller_id, created_at desc);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_idx on public.orders(seller_id, created_at desc);
create index payments_seller_status_idx on public.payments(seller_id, status);
create index reviews_seller_idx on public.reviews(seller_id, created_at desc);

-- Enable RLS on all exposed tables. Add policy migrations before using these tables.
alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;

-- Create a basic profile row on signup. Role is always buyer at signup;
-- seller/admin permissions must be granted by a trusted server-side workflow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'buyer'::public.account_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Intentionally no permissive RLS policies in this first migration.
-- Until explicit policies are added and tested, API access is denied.
