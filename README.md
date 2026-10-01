# Lary Shop

A small apparel-and-homegoods store built with Next.js 16 (App Router), React 19,
TypeScript and Tailwind v4.

The app ships in **demo mode**: the entire shop runs in the browser with no backend, so you
can click through every feature without Supabase, Stripe or an email provider being configured.

```bash
npm install
npm run dev      # http://localhost:3001
```

> Port 3001 is deliberate — port 3000 is used by an unrelated project in this workspace.

## Try it in this order

1. **`/products`** — search, filter by category, sort. Open a product and pick a variant; the
   artwork, price and SKU change with it. Some variants are sold out and cannot be added.
2. **Add to cart** — quantities, the free-shipping-over-$75 threshold and totals all come from
   one shared pricing module.
3. **`/checkout`** — fill in any details, pay with the fake card button, and you land on a
   confirmed order with a real order number.
4. **`/checkout/success`** — the timeline shows the `checkout.session.completed` transition,
   and there is a post-purchase sign-in prompt that links the guest order to an account.
5. **`/track-order`** — guest lookup by order number **and** email. The wrong email reveals
   nothing.
6. **`/login`** — pick a demo account, then visit **`/admin`** for fulfillment: an order
   table, status transitions and an email log. Marking an order *shipped* writes the customer
   and owner notifications.

### Demo accounts and fixtures

| What | Value |
| --- | --- |
| Buyer | `nina@example.com` — 2 orders |
| Store owner | `owner@lary-shop.test` — admin, all orders |
| Track order | `LS-4KP2QD` + `nina@example.com` |
| Track order | `LS-2VB6JH` + `guest@example.com` |

Admin has a **Reset demo data** button that restores the seeded orders. All demo state lives
in `localStorage`, so clearing site data resets everything.

## What is real and what is simulated

| Area | Demo mode | Production path |
| --- | --- | --- |
| Catalog | `src/lib/catalog.ts` | `products` + `product_variants` — migrated, populated, RLS verified |
| Cart, pricing, totals | Real | Same code |
| Checkout | Simulated in `localStorage` | Stripe hosted Checkout + `create_pending_order` RPC |
| Orders | Simulated store | `orders` / `order_items` / `order_events` |
| Email | Simulated log | Brevo or Mailgun via `EMAIL_PROVIDER`, through `src/lib/server/email/`, writing `email_log` |
| Auth | Demo account picker | Google OAuth or email + password, via Supabase Auth (PKCE) |
| Admin | Working against demo data | Same UI, service-role reads |

Set `NEXT_PUBLIC_DEMO_MODE=false` to switch to the Supabase-backed path. The proxy skips
Supabase entirely when demo mode is on, so a missing or broken key can never take the demo
down.

## Database

Four ordered migrations in `supabase/migrations/` are **applied and verified** against the
live project. They reconcile a pre-existing schema: the 8 original products were backfilled
into `product_variants`, money moved to integer cents, and empty `orders` / `order_items` were
recreated.

```bash
npm run db:schema    # columns and row counts, reads no row data
npm run db:apply     # apply migrations (Management API)
npm run db:verify    # 13 RLS and grant assertions
```

`0004_grants.sql` matters: Postgres grants `EXECUTE` on new functions to `PUBLIC` by default,
which would otherwise expose the `SECURITY DEFINER` writers (`create_pending_order`,
`decrement_stock`) to anonymous callers. `npm run db:verify` asserts they return 401.

| `npm run images:update` | Download a Pixabay photo per product into `public/products/` and save the local paths. Dry run unless `-- --write` |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3001 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npm run check:email` | Email provider preflight: authenticates, checks the sending domain and recipients. Sends nothing |
| `npm run email:test` | Sends one real test email through the configured transport |
| `npm run test:unit` | Node test runner over the email provider switch and retry policy |
| `npm run test:e2e` | 19 Playwright tests: cart persistence + full demo journey |
| `npm run check:supabase` | Masked credential and connectivity probe |
| `npm run db:schema` / `db:apply` / `db:verify` | Inspect, migrate, and verify the database |
| `npm run db:catalog` | Print the live catalog shape and variants per product |
| `npm run db:probe:checkout` | Exercise `create_pending_order` against the live catalog, then clean up |
| `npm run db:reseed` | Regenerate `0005_reseed_catalog.sql` from `src/lib/catalog.ts` |

## Architecture notes

- **Cart** is React Context + versioned `localStorage`, with cross-tab sync. One pricing
  module is imported by both server and client so totals cannot drift.
- **`src/proxy.ts`** — Next 16 renamed the `middleware` convention to `proxy` and the export
  must be named `proxy`. It refreshes the Supabase session and guards `/account` and `/admin`.
- **Checkout is publicly accessible**; only server-side service-role writes are permitted.
  There is no client write policy on `orders` at all.
- **Shipping** is flat $5, free over $75, applied server-side as its own figure.
- **Stripe** — hosted Checkout only; no client-side Stripe package, so card data never reaches
  this app. `src/app/checkout/actions.ts` re-reads every variant and recomputes totals from
  Postgres before creating a session, so a hand-edited `localStorage` cart cannot change what is
  charged. `src/app/api/stripe/webhook/route.ts` verifies the signature against the raw body.
- **Webhook idempotency** — Stripe delivers at least once. `fulfillPaidOrder` flips the status and
  writes `stripe_event_id` in one conditional update, so a repeat delivery loses the race and
  returns `already_applied` instead of decrementing stock twice. Stock is rebuilt from
  `order_items`, never from the event payload.
- **Product images** are self-hosted in `public/products/`, not hotlinked. `npm run images:update`
  fetches the 1280px variant from Pixabay, verifies each one is really a JPEG above a size floor,
  and stores a local path such as `/products/merino-wool-socks.jpg`. Remote URLs were rejected
  deliberately: the `pixabay.com/get/<token>` URLs the API returns proved non-deterministic —
  repeated searches returned entirely different URL sets minutes apart, and one URL that answered
  200 began answering 400 consistently. Storing those would let product images rot silently.
  Already-downloaded files are reused; `-- --force` re-fetches.
- **Email** — `src/lib/server/email/` renders the four templates in `templates.ts` (HTML plus a
  plain-text alternative), posts them through the transport named by `EMAIL_PROVIDER`
  (`brevo.ts` or `mailgun.ts`), and records every attempt in `email_log` in `send.ts`. A delivery
  failure is logged, not thrown: callers are Stripe webhooks and status transitions, which must
  not roll back because the provider was down. `EMAIL_PROVIDER` accepts `brevo`, `mailgun`, or
  `none`; unset is a configuration error rather than a silent default, and `none` refuses to send
  while still writing the failed row so the gap stays auditable.
- **Retry semantics differ per provider, deliberately.** Brevo de-duplicates on `Idempotency-Key`,
  so a retry after an ambiguous network fault cannot double-send. Mailgun documents no idempotency
  key for sends, so `mailgun.ts` retries only a 429 — provably not queued — and treats a timeout as
  terminal. A lost email is recoverable from `email_log`; a duplicate confirmation reaches a real
  customer and cannot be recalled.

## Not built yet

Google OAuth, reading the catalog from Supabase, the admin fulfillment UI against live orders,
real product photography, and deployment.

Stripe and the email transport are wired. Mailgun has been verified live: credentials authenticate,
the sandbox sending domain is active, and a test email was accepted. Stripe still needs a test
`sk_test_` key plus `stripe listen --forward-to localhost:3001/api/stripe/webhook`.

The active Mailgun domain is a **sandbox** (`sandbox*.mailgun.org`), which only delivers to
authorized recipients who have clicked Mailgun's activation email — real customers will receive
nothing. Its `MAILGUN_FROM_EMAIL` is also a personal Gmail address rather than a domain Mailgun is
authorized to send for, so mail will very likely be marked as spoofed. Add a custom domain and send
from `orders@<your-domain>` before taking real orders.

`order_confirmation` and `owner_new_order` fire from the webhook. `order_shipped` and
`owner_shipped` fire from the admin status transition, which is not built yet.

### Catalog is seeded from the storefront

`supabase/migrations/0005_reseed_catalog.sql` is **generated**, not hand-written.
`npm run db:reseed` reads `src/lib/catalog.ts` and emits the SQL, so the database and the
storefront can never disagree about a price, SKU or stock level. Re-run it after editing the
catalog, then `npm run db:apply -- 0005`.

An earlier revision of `0001_schema.sql` multiplied `products.price` by 100 assuming it held
dollars, when it already held cents, inflating every price 100x (a $28 backpack became $28,000).
That backfill now only multiplies values below 1000. The live rows are 8 products / 22 variants
with correct cents, real SKUs, `sort_order` set, both zero-stock variants preserved, and the
mug's deliberate $24/$27 per-variant price split intact.

`npm run db:probe:checkout` proves the RPC prices from the reseeded rows: 2 × 2400 + 2700 + 500
shipping = 8000 cents, and stock does not move until payment.