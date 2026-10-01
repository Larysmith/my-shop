alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.profiles enable row level security;
alter table public.order_events enable row level security;
alter table public.email_log enable row level security;

drop policy if exists products_read_active on public.products;
create policy products_read_active
  on public.products for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists product_variants_read_active on public.product_variants;
create policy product_variants_read_active
  on public.product_variants for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
  );

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists orders_read_own on public.orders;
create policy orders_read_own
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists order_items_read_own on public.order_items;
create policy order_items_read_own
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
