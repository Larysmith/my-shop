begin;

alter table public.products add column if not exists slug text;
alter table public.products add column if not exists status text not null default 'active';
alter table public.products add column if not exists category text not null default 'general';
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

with normalised as (
  select
    id,
    nullif(trim(both '-' from lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))), '') as base_slug,
    row_number() over (
      partition by nullif(trim(both '-' from lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))), '')
      order by created_at nulls last, id
    ) as duplicate_index
  from public.products
)
update public.products p
set slug = case when n.duplicate_index = 1 then n.base_slug else n.base_slug || '-' || n.duplicate_index end
from normalised n
where p.id = n.id and p.slug is null;

update public.products set slug = 'product-' || substr(id::text, 1, 8) where slug is null or slug = '';

alter table public.products alter column slug set not null;

create unique index if not exists products_slug_key on public.products (slug);
create index if not exists products_status_sort_order_idx on public.products (status, sort_order);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null,
  sku text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  position integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists product_variants_sku_key on public.product_variants (sku);
create index if not exists product_variants_product_position_idx on public.product_variants (product_id, position);

-- Re-runnable: after the first pass these three columns no longer exist, so the
-- backfill must be skipped rather than fail. Guarded on the column still being
-- present.
--
-- `price` on this project was already stored in CENTS, not dollars. The first
-- version of this file multiplied by 100 here and inflated every price 100x
-- (a $28 backpack became $28,000). The guard below converts only when the
-- stored value looks like a dollar amount, and 0005_reseed_catalog.sql replaces
-- these rows with correctly-scaled ones regardless.
do $$
declare
  v_price_type text;
begin
  select data_type into v_price_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'products'
     and column_name = 'price';

  if v_price_type is not null then
    insert into public.product_variants (product_id, title, sku, price_cents, stock, image_url, is_default)
    select
      p.id,
      'Default',
      'SKU-' || upper(substr(replace(p.id::text, '-', ''), 1, 10)),
      case
        -- A dollars-denominated value is small; a cents-denominated one is
        -- large. Treat anything at or above 1000 as already being in cents.
        when p.price >= 1000 then greatest(round(p.price)::integer, 0)
        else greatest(round(p.price * 100)::integer, 0)
      end,
      greatest(coalesce(p.stock, 0), 0),
      p.image_url,
      true
    from public.products p
    where not exists (select 1 from public.product_variants v where v.product_id = p.id);
  end if;
end
$$;

alter table public.products drop column if exists price;
alter table public.products drop column if exists stock;
alter table public.products drop column if exists image_url;

-- Dropped in dependency order and all recreated further down, which is what
-- makes this file re-runnable. order_events and email_log hold FKs into orders,
-- so they must go first or the drop of orders is refused.
--
-- Safe here only because every one of these tables is empty in this project
-- (verified 0 rows before applying). Once real orders exist this must become a
-- data-preserving ALTER instead of drop-and-recreate.
drop table if exists public.order_events;
drop table if exists public.email_log;
drop table if exists public.order_items;
drop table if exists public.orders;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','shipped','completed','canceled','refunded')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'usd',
  shipping_name text not null,
  shipping_line1 text not null,
  shipping_line2 text,
  shipping_city text not null,
  shipping_region text,
  shipping_postal_code text,
  shipping_country text not null,
  cart_hash text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  paid_at timestamptz,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orders_order_number_key on public.orders (order_number);
create unique index if not exists orders_session_key on public.orders (stripe_checkout_session_id);
create unique index if not exists orders_event_key on public.orders (stripe_event_id);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_email_created_idx on public.orders (email, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_pending_cart_hash_idx on public.orders (cart_hash) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_title text not null,
  sku text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on public.order_events (order_id);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  template text not null,
  to_email text not null,
  provider_id text,
  status text not null check (status in ('sent','failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists email_log_order_id_idx on public.email_log (order_id);

commit;
