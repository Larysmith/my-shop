-- Server-side shopping cart: one row per (user, product).
--
-- Keyed on product rather than variant because the client cart merges on product:
-- adding a product already in the cart replaces the chosen variant and sums the
-- quantity (the "add" case in src/components/cart/CartProvider.tsx, asserted by
-- e2e/cart-persistence.spec.ts). A per-variant key would silently change that
-- behaviour, so product_id is the key and variant_id records the current choice.
--
-- No price, name or image is stored here. Both clients re-join the live catalog
-- to render a line, so a price change can never go stale in a cart and no
-- client-supplied amount ever reaches the database.
--
-- The quantity ceiling mirrors clampQuantity() in src/lib/cart/storage.ts. It is
-- required rather than defensive: RLS filters rows but does not validate column
-- values, so without a check constraint a hand-built PostgREST request could
-- write an arbitrary quantity.

begin;

create table if not exists public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

commit;
