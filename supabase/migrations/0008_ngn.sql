-- Switch the shop to Naira.
--
-- The provider change (0007) is separate from the currency change. This file does
-- the latter: renames the money columns, which were named for USD "cents" and now
-- hold NGN kobo, and re-prices the catalog.
--
-- Why the rename matters: `price_cents` holding kobo would be actively
-- misleading to the next developer reading it. The suffix `_amount` is
-- currency-neutral, and the ISO code lives in the adjacent `currency` column.
--
-- Amounts are stored in minor units (kobo, 1/100 NGN), matching Paystack, which
-- takes amounts as integer kobo. Existing orders keep their historical totals and
-- their original currency, so past invoices stay accurate.

begin;

-- --- Rename money columns -----------------------------------------------------

alter table public.product_variants rename column price_cents to price_amount;
alter table public.orders rename column subtotal_cents to subtotal_amount;
alter table public.orders rename column shipping_cents to shipping_amount;
alter table public.orders rename column total_cents to total_amount;
alter table public.order_items rename column unit_price_cents to unit_price_amount;
alter table public.order_items rename column line_total_cents to line_total_amount;

-- New rows default to the shop currency. Without this, any insert that omits
-- `currency` still lands in USD, which is the exact mismatch this migration
-- exists to remove. Historical rows keep their own value.
alter table public.product_variants alter column currency set default 'NGN';
alter table public.orders alter column currency set default 'NGN';

-- create_pending_order must be recreated, not just left alone.
--
-- Two reasons, and the first one is the dangerous one:
--
--  1. It hardcoded 'usd' in its INSERT. A `create or replace` that only fixed
--     the column names would keep stamping new orders with the old currency
--     while the catalog is priced in NGN, so every total would be right and the
--     label wrong.
--  2. Postgres refuses to rename an input parameter on `create or replace`, so
--     the drop is required to move p_shipping_cents to p_shipping_amount. The
--     argument types are unchanged, so the grants in 0004 still apply.
--
-- The function is SECURITY DEFINER and reachable only by the service role, so
-- the brief gap where it does not exist is not observable by any caller.

drop function if exists public.create_pending_order(text, jsonb, uuid, text, jsonb, integer);

create function public.create_pending_order(
  p_email text,
  p_shipping jsonb,
  p_user_id uuid,
  p_cart_hash text,
  p_lines jsonb,
  p_shipping_amount integer
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_line jsonb;
  v_variant public.product_variants;
  v_product_name text;
  v_item_product_id uuid;
  v_item_title text;
  v_item_sku text;
  v_item_price_amount integer;
  v_subtotal integer := 0;
  v_total integer;
  v_number text;
  v_attempt integer;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_shipping_amount is null or p_shipping_amount < 0 then
    raise exception 'Invalid shipping cost';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_variant
      from public.product_variants
     where id = (v_line ->> 'variantId')::uuid
       and is_active;

    if not found then
      raise exception 'Unknown or inactive variant %', v_line ->> 'variantId';
    end if;

    if v_variant.stock < (v_line ->> 'quantity')::integer then
      raise exception 'Insufficient stock for variant %', v_line ->> 'variantId';
    end if;

    v_subtotal := v_subtotal + v_variant.price_amount * (v_line ->> 'quantity')::integer;
  end loop;

  v_total := v_subtotal + p_shipping_amount;

  for v_attempt in 1..5 loop
    v_number := 'LS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into public.orders (
        order_number, user_id, email, status,
        subtotal_amount, shipping_amount, total_amount, currency,
        shipping_name, shipping_line1, shipping_line2,
        shipping_city, shipping_region, shipping_postal_code, shipping_country,
        cart_hash
      )
      values (
        v_number, p_user_id, lower(trim(p_email)), 'pending_payment',
        v_subtotal, p_shipping_amount, v_total, 'NGN',
        p_shipping ->> 'name',
        p_shipping ->> 'line1',
        p_shipping ->> 'line2',
        p_shipping ->> 'city',
        p_shipping ->> 'region',
        p_shipping ->> 'postalCode',
        upper(p_shipping ->> 'country'),
        p_cart_hash
      )
      returning * into v_order;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Could not generate a unique order number';
      end if;
    end;
  end loop;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select pv.product_id, pv.title, pv.sku, pv.price_amount
      into v_item_product_id, v_item_title, v_item_sku, v_item_price_amount
      from public.product_variants pv
     where pv.id = (v_line ->> 'variantId')::uuid;

    select p.name into v_product_name
      from public.products p
     where p.id = v_item_product_id;

    insert into public.order_items (
      order_id, product_id, variant_id,
      product_name, variant_title, sku,
      unit_price_amount, quantity, line_total_amount
    )
    values (
      v_order.id,
      v_item_product_id,
      (v_line ->> 'variantId')::uuid,
      v_product_name,
      v_item_title,
      v_item_sku,
      v_item_price_amount,
      (v_line ->> 'quantity')::integer,
      v_item_price_amount * (v_line ->> 'quantity')::integer
    );
  end loop;

  return v_order;
end;
$$;

-- lookup_guest_order builds a JSON payload for the tracking page. Its keys are
-- part of that page's contract, so they move with the columns.
create or replace function public.lookup_guest_order(p_order_number text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  -- The normalization the original lookup had: a guest pasting the number from
  -- an email must not fail on case or padding.
  select * into o
    from public.orders
    where order_number = upper(trim(p_order_number))
      and lower(email) = lower(trim(p_email));

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.status,
    'totalAmount', o.total_amount,
    'currency', o.currency,
    'createdAt', o.created_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'productName', i.product_name,
            'variantTitle', i.variant_title,
            'sku', i.sku,
            'quantity', i.quantity,
            'lineTotalAmount', i.line_total_amount
          )
        )
        from public.order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', e.to_status,
            'at', e.created_at
          )
          order by e.created_at
        )
        from public.order_events e
        where e.order_id = o.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- --- Re-price the catalog -----------------------------------------------------
--
-- Round Naira figures, chosen rather than converted from the old USD prices at an
-- exchange rate: a rate would have put the hoodie near ₦111,000 and the lamp
-- near ₦171,000, which is above the market for this range of goods.
--
-- Grouped by price so each UPDATE touches only the variants it should.

update public.product_variants set price_amount = 1200000, currency = 'NGN'
  where sku like 'LS-MER-08-%';                        -- merino socks   ₦12,000

update public.product_variants set price_amount = 1800000, currency = 'NGN'
  where sku like 'LS-EVE-01-%';                        -- cotton tee     ₦18,000

update public.product_variants set price_amount = 1500000, currency = 'NGN'
  where sku in ('LS-CER-04-01', 'LS-CER-04-02');      -- mug 320ml      ₦15,000

update public.product_variants set price_amount = 1700000, currency = 'NGN'
  where sku = 'LS-CER-04-03';                         -- mug 450ml      ₦17,000

update public.product_variants set price_amount = 2000000, currency = 'NGN'
  where sku like 'LS-CAN-03-%';                        -- tote           ₦20,000

update public.product_variants set price_amount = 3500000, currency = 'NGN'
  where sku like 'LS-LEA-06-%';                        -- wallet         ₦35,000

update public.product_variants set price_amount = 4500000, currency = 'NGN'
  where sku like 'LS-HEA-02-%';                        -- hoodie         ₦45,000

update public.product_variants set price_amount = 5500000, currency = 'NGN'
  where sku like 'LS-LIN-05-%';                        -- blanket        ₦55,000

update public.product_variants set price_amount = 7000000, currency = 'NGN'
  where sku like 'LS-MIN-07-%';                        -- desk lamp      ₦70,000

-- The mug's 450ml is repriced separately above only because it is a single SKU
-- at a different price from its siblings; that is already applied.

-- --- Grants -------------------------------------------------------------------
--
-- Required, not optional. `create_pending_order` was dropped and recreated above,
-- and a new function object arrives with the default PUBLIC EXECUTE grant. That
-- would undo the revoke in 0004 and re-expose a SECURITY DEFINER writer that
-- creates orders and moves stock to any anonymous caller via PostgREST. The
-- signature is unchanged, so the existing grant lines still resolve.
revoke execute on function public.create_pending_order(text, jsonb, uuid, text, jsonb, integer)
  from PUBLIC, anon, authenticated;
grant execute on function public.create_pending_order(text, jsonb, uuid, text, jsonb, integer)
  to service_role;

-- Make PostgREST pick up the renamed columns and the recreated function.
notify pgrst, 'reload schema';

commit;