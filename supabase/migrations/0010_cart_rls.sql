alter table public.cart_items enable row level security;

-- Four policies rather than one, because RLS is per-command. A single "all"
-- policy using (user_id = auth.uid()) would cover reads and writes, but splitting
-- them keeps the write policies honest: the insert and update paths carry an
-- explicit with check, so a row can never be written under someone else's user_id
-- and then read back.
--
-- This is the only thing standing between a leaked publishable key and another
-- customer's cart, because both clients reach this table directly through
-- PostgREST with a user JWT. The web app's own guard (src/proxy.ts) does not
-- apply to a direct Data API request.

drop policy if exists cart_items_read_own on public.cart_items;
create policy cart_items_read_own
  on public.cart_items for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own
  on public.cart_items for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
  on public.cart_items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
  on public.cart_items for delete
  to authenticated
  using (user_id = auth.uid());
