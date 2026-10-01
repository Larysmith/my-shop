-- Replace Stripe with Paystack.
--
-- Stripe is not available in the shop's market, so the payment provider changes.
-- The design is unchanged: a pending order is created server-side, the provider
-- takes the customer away and comes back with a reference, and fulfillment keys
-- on that reference.
--
-- Column mapping:
--   stripe_checkout_session_id -> paystack_reference
--   stripe_payment_intent_id  -> dropped, Paystack has no equivalent object
--   stripe_event_id           -> dropped, the reference is the idempotency key
--
-- The event-id column existed to make repeated webhook deliveries safe. Paystack
-- delivers `charge.success` once per transaction, and every retry carries the
-- same reference, so a single unique index on the reference does that job with
-- one fewer column. Losing that unique constraint would reintroduce
-- double-decremented stock, so it is recreated rather than dropped.

begin;

alter table public.orders add column if not exists paystack_reference text;

drop index if exists public.orders_session_key;
drop index if exists public.orders_event_key;

alter table public.orders drop column if exists stripe_checkout_session_id;
alter table public.orders drop column if exists stripe_payment_intent_id;
alter table public.orders drop column if exists stripe_event_id;

-- The idempotency guard. Partial so many pending orders may exist with no
-- reference yet, while at most one paid order can hold a given reference.
create unique index if not exists orders_paystack_reference_key
  on public.orders (paystack_reference);

commit;