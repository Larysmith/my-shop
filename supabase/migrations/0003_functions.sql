create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'picture'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.decrement_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_affected integer;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.product_variants
       set stock = stock - (v_item ->> 'quantity')::integer
     where id = (v_item ->> 'variantId')::uuid
       and stock >= (v_item ->> 'quantity')::integer;

    get diagnostics v_affected = row_count;
    if v_affected = 0 then
      raise exception 'Insufficient stock for variant %', v_item ->> 'variantId';
    end if;
  end loop;
end;
$$;

create or replace function public.create_pending_order(
  p_email text,
  p_shipping jsonb,
  p_user_id uuid,
  p_cart_hash text,
  p_lines jsonb,
  p_shipping_cents integer
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
  v_item_price_cents integer;
  v_subtotal integer := 0;
  v_total integer;
  v_number text;
  v_attempt integer;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_shipping_cents is null or p_shipping_cents < 0 then
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

    v_subtotal := v_subtotal + v_variant.price_cents * (v_line ->> 'quantity')::integer;
  end loop;

  v_total := v_subtotal + p_shipping_cents;

  for v_attempt in 1..5 loop
    v_number := 'LS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into public.orders (
        order_number, user_id, email, status,
        subtotal_cents, shipping_cents, total_cents, currency,
        shipping_name, shipping_line1, shipping_line2,
        shipping_city, shipping_region, shipping_postal_code, shipping_country,
        cart_hash
      )
      values (
        v_number, p_user_id, lower(trim(p_email)), 'pending_payment',
        v_subtotal, p_shipping_cents, v_total, 'usd',
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
    select pv.product_id, pv.title, pv.sku, pv.price_cents
      into v_item_product_id, v_item_title, v_item_sku, v_item_price_cents
      from public.product_variants pv
     where pv.id = (v_line ->> 'variantId')::uuid;

    select p.name into v_product_name
      from public.products p
     where p.id = v_item_product_id;

    insert into public.order_items (
      order_id, product_id, variant_id,
      product_name, variant_title, sku,
      unit_price_cents, quantity, line_total_cents
    )
    values (
      v_order.id,
      v_item_product_id,
      (v_line ->> 'variantId')::uuid,
      v_product_name,
      v_item_title,
      v_item_sku,
      v_item_price_cents,
      (v_line ->> 'quantity')::integer,
      v_item_price_cents * (v_line ->> 'quantity')::integer
    );
  end loop;

  return v_order;
end;
$$;

create or replace function public.lookup_guest_order(
  p_order_number text,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.status,
    'totalCents', o.total_cents,
    'currency', o.currency,
    'createdAt', o.created_at,
    'items', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'name', i.product_name,
          'variantTitle', i.variant_title,
          'quantity', i.quantity,
          'lineTotalCents', i.line_total_cents
        ))
        from public.order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and lower(o.email) = lower(trim(p_email));

  return v_result;
end;
$$;
