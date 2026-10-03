-- Grants for cart_items, plus membership of the Realtime publication.
--
-- authenticated only, and anon is revoked explicitly rather than simply not
-- being granted. Signed-out carts live in localStorage, so an anonymous caller
-- has no legitimate reason to touch this table; saying so with a revoke keeps the
-- intent obvious and survives someone later granting broadly.

begin;

grant select, insert, update, delete on public.cart_items to authenticated;
revoke all on public.cart_items from anon;

commit;

-- postgres_changes delivery. Guarded because re-running this file would
-- otherwise raise duplicate_object and abort the migration; db-apply.mjs retries
-- whole files, so an unguarded failure here would be retried five times and still
-- fail.
--
-- Realtime checks the subscriber's RLS on every event, so the read policy in
-- 0010 is what confines each user to their own rows. SELECT is granted above
-- because a DELETE event is delivered with the old record and needs it.
--
-- If Realtime is disabled on the project this statement is simply a no-op, and
-- both clients fall back to polling: slower to converge, still correct.
do $$
begin
  alter publication supabase_realtime add table public.cart_items;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
