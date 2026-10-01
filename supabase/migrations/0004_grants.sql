-- Grants and revokes.
--
-- Must run AFTER 0003_functions.sql: the revokes need the functions to exist.
--
-- Two things 0001-0003 do not cover on their own:
--
--  1. Postgres grants EXECUTE on every new function to the PUBLIC role by
--     default. create_pending_order and decrement_stock are SECURITY DEFINER, so
--     without an explicit revoke any anonymous caller could reach them through
--     PostgREST and create orders or drive stock negative. The service role
--     bypasses RLS and is the only intended caller.
--
--  2. Enabling RLS is not the same as granting access. Without these grants
--     PostgREST returns permission-denied instead of an empty result, which
--     looks like a broken policy rather than a missing grant.

begin;

grant usage on schema public to anon, authenticated;

-- Catalog: public to read, narrowing only what is visible.
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;

-- Order data: signed-in buyers only. RLS narrows rows to auth.uid().
grant select on public.profiles to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant update on public.profiles to authenticated;

-- order_events and email_log are deliberately NOT granted. They stay
-- unreachable from the Data API; the admin pages read them with the service role.

-- Guest lookup is intentionally public: it demands order number AND email.
grant execute on function public.lookup_guest_order(text, text) to anon, authenticated;

-- Re-close the default PUBLIC grant on the SECURITY DEFINER writers.
revoke execute on function public.create_pending_order(text, jsonb, uuid, text, jsonb, integer) from PUBLIC, anon, authenticated;
revoke execute on function public.decrement_stock(jsonb) from PUBLIC, anon, authenticated;

-- Granted explicitly rather than relying on inherited PUBLIC rights, so the
-- webhook keeps working after the revoke above.
grant execute on function public.create_pending_order(text, jsonb, uuid, text, jsonb, integer) to service_role;
grant execute on function public.decrement_stock(jsonb) to service_role;

commit;

-- Make PostgREST pick up the new tables and functions.
notify pgrst, 'reload schema';
