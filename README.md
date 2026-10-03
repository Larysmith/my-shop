# Lary Shop

A small apparel-and-homegoods store built with Next.js 16 (App Router), React 19,
TypeScript and Tailwind v4, with a companion Expo app in `mobile/`.

The web app ships in **demo mode**: the entire shop runs in the browser with no backend, so you
can click through every feature without Supabase, Paystack or an email provider being configured.

```bash
npm install
npm run dev      # http://localhost:3001
```

> Port 3001 is deliberate — port 3000 is used by an unrelated project in this workspace.

## Try it in this order

1. **`/products`** — search, filter by category, sort. Open a product and pick a variant; the
   artwork, price and SKU change with it. Some variants are sold out and cannot be added.
2. **Add to cart** — quantities, the free-shipping-over-₦50,000 threshold and totals all come from
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
| Cart persistence | `localStorage`, cross-tab | `cart_items` under RLS, synced across tabs, devices and the Expo app |
| Checkout | Simulated in `localStorage` | Paystack hosted checkout + `create_pending_order` RPC |
| Orders | Simulated store | `orders` / `order_items` / `order_events` |
| Email | Simulated log | Brevo or Mailgun via `EMAIL_PROVIDER`, through `src/lib/server/email/`, writing `email_log` |
| Auth | Demo account picker | Google OAuth or email + password, via Supabase Auth (PKCE) |
| Admin | Working against demo data | Same UI, service-role reads |

Set `NEXT_PUBLIC_DEMO_MODE=false` to switch to the Supabase-backed path. The proxy skips
Supabase entirely when demo mode is on, so a missing or broken key can never take the demo
down.

## Cart

The cart is the one piece of state both clients share, and the server is authoritative whenever
someone is signed in.

- A **guest** cart lives in `localStorage` on that device. A **signed-in** cart lives in
  `cart_items` and reaches every device for that account.
- On sign-in the two are merged per product: quantities are summed and clamped, and the device's
  chosen variant wins, because it is the choice that was just made deliberately. The merge is
  idempotent, so a second client doing it does not double anything.
- Sync uses Supabase Realtime, a 10-second poll, and a refetch on window focus. An echo guard
  skips the write when the applied lines already map back to exactly the rows the server holds.
- Writes are **absolute upserts of the whole set**, never increments, so a retried write is safe.
  Because that makes last-arrival win, they are serialized through `src/lib/cart/write-queue.ts`:
  a request slower than the debounce window would otherwise land after a newer one and silently
  revert the cart. That queue is shared by the website and the Expo app, and
  `tests/write-queue.test.ts` pins the ordering.
- No monetary amount is ever sent by a client. A row carries a product, a variant and a quantity;
  prices are re-read from the catalog, and totals are recomputed.

## Mobile app

`mobile/` is an Expo Router app (SDK 57) sharing the shop's Supabase project, so a cart follows the
same rules as the website.

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

It covers catalog browsing, email + password sign-in, and the cart. Checkout stays on the web,
because it is Paystack hosted checkout and no native Paystack SDK is used.

Two things to know before running it against a real device:

- **Product images need `EXPO_PUBLIC_SITE_URL`.** `products.image_url` holds site-relative paths
  like `/products/merino-wool-socks.jpg`, which mean nothing to a device. Without that variable the
  app renders placeholders.
- **`profiles` has no rows yet**, so create an account through the app before testing cart sync.

See `mobile/.env.example` for the variables it reads.

## Database

Eleven ordered migrations in `supabase/migrations/` are **applied and verified** against the
live project. They reconcile a pre-existing schema: the 8 original products were backfilled
into `product_variants`, money moved to integer cents, and empty `orders` / `order_items` were
recreated. Migrations `0009`–`0011` add `cart_items`, its RLS policies, authenticated-only
grants, the realtime publication and its `updated_at` trigger.

```bash
npm run db:schema    # columns and row counts, reads no row data
npm run db:apply     # apply migrations (Management API)
npm run db:verify    # 17 RLS and grant assertions
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
| `npm run email:smtp` / `email:smtp:verify` | Point Supabase Auth's mailer at Mailgun, or read the current config back |
| `npm run email:probe:smtp` | Mailgun SMTP handshake, stopping at authentication. Reports why a send is refused |
| `npm run auth:verify` | Full email+password path against live Supabase: sign up, confirm, sign in, clean up |
| `npm run test:unit` | Node test runner over cart hydration, the write queue, the email provider switch and its retry policy |
| `npm run test:e2e` | Playwright, run twice: the demo journey in demo mode, then the production-mode suite against a server booted with `NEXT_PUBLIC_DEMO_MODE=false`. Both modes run from this one command. Cart-sync specs skip unless `E2E_EMAIL` and `E2E_EMAIL_PASSWORD` are set |
| `npm run check:supabase` | Masked credential and connectivity probe |
| `npm run check:env` | Lists every required variable and whether it is set, grouped by Supabase / Paystack / Email, and flags which ones must also be set as `NEXT_PUBLIC_*` on Netlify. Prints no values |
| `npm run check:client` | Walks the import graph from every `"use client"` file and fails if one can reach a `server-only` module or the demo dataset |
| `npm run verify:deploy` | Builds and serves with `.env.local` hidden and only its values exposed as process env, reproducing the deploy host. `--no-env` reproduces a site with no variables configured at all |
| `npm run db:schema` / `db:apply` / `db:verify` | Inspect, migrate, and verify the database |
| `npm run db:catalog` | Print the live catalog shape and variants per product |
| `cd mobile && npm run typecheck` | Typecheck the Expo app |
| `npm run db:probe:checkout` | Exercise `create_pending_order` against the live catalog, then clean up |
| `npm run db:reseed` | Regenerate `0005_reseed_catalog.sql` from `src/lib/catalog.ts` |

## Architecture notes

- **Catalog data has one source per mode.** `@/lib/catalog` is the demo dataset and
  `@/lib/server/catalog` reads Postgres; server code reaches both through
  `@/lib/server/shop-catalog`. Types and pure helpers live in `@/lib/catalog-types`
  so client components never import a dataset. A client component resolving a
  product against the demo file returns `undefined` in production, where ids are
  UUIDs rather than `p-001..p-008`, and fails silently rather than loudly.
  `npm run check:client` enforces the boundary.
- **The Expo app shares code through one curated list.** `mobile/src/shared.ts` re-exports a
  specific set of pure modules from `src/lib` — catalog row types, cart hydration, cart quantity,
  the cart reducer and the write queue — and `mobile/tsconfig.json` lists those same paths
  explicitly. Anything server-only or Supabase-dependent is deliberately excluded; the app has its
  own thin `src/api/` layer. Adding a shared module means adding it in **both** places, because
  that `include` list is what keeps Metro from pulling a server module into a bundle.
- **The build needs no environment variables and no network.** No route is
  prerendered, so `next build` succeeds on a clean checkout with nothing
  configured. Everything reads config at request time through
  `@/lib/server/env`, which names the missing variable instead of failing three
  frames away.
- **Cart** is React Context plus a pure reducer in `src/lib/cart/`, with cross-tab sync. The
  provider holds no I/O at all: state and totals are computed by `reducer.ts` and `quantity.ts`,
  while `CartSync` and the two sync hooks do the reading and writing. That split is what lets the
  Expo app import the same pure modules, and what lets `tests/` exercise cart behaviour without a
  React renderer. One pricing module is imported by both server and client so totals cannot drift.
- **`src/proxy.ts`** — Next 16 renamed the `middleware` convention to `proxy` and the export
  must be named `proxy`. It refreshes the Supabase session and guards `/account` and `/admin`.
- **Checkout is publicly accessible**; only server-side service-role writes are permitted.
  There is no client write policy on `orders` at all.
- **Currency** is NGN, held as integer kobo. Amount fields are named `*_amount` rather than
  `*_cents`, and the ISO code lives in an adjacent `currency` column, so no amount is ever read
  without its currency. `formatPrice` picks the locale from the currency, not the amount.
- **Shipping** is flat ₦3,500, free over ₦50,000, applied server-side as its own figure.
- **Paystack** — hosted checkout only; no client-side Paystack package, so card data never reaches
  this app. `src/app/checkout/actions.ts` re-reads every variant and recomputes totals from
  Postgres before initializing a transaction, so a hand-edited `localStorage` cart cannot change
  what is charged. `src/app/api/paystack/webhook/route.ts` verifies the signature against the raw
  body before parsing it.
- **The webhook is a notification, not proof of payment.** `charge.success` only names a reference;
  the route then calls `verifyTransaction` and fulfills from that verified result. A card charge can
  notify before it settles, so trusting the body would let an unsettled or spoofed event ship goods.
- **Webhook idempotency** — Paystack retries. `fulfillPaidOrder` flips the status and writes
  `paystack_reference` in one conditional update guarded by `is("paystack_reference", null)`, so a
  repeat delivery loses the race and returns `already_applied` instead of decrementing stock twice.
  A unique index on the reference backs that up. Stock is rebuilt from `order_items`, never from
  the event payload.
- **Amount mismatch is refused, not reconciled.** The charged amount is compared to the stored total
  before anything is fulfilled, and a difference throws into a retryable 500 so it stays visible.
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
  failure is logged, not thrown: callers are Paystack webhooks and status transitions, which must
  not roll back because the provider was down. `EMAIL_PROVIDER` accepts `brevo`, `mailgun`, or
  `none`; unset is a configuration error rather than a silent default, and `none` refuses to send
  while still writing the failed row so the gap stays auditable.
- **Retry semantics differ per provider, deliberately.** Brevo de-duplicates on `Idempotency-Key`,
  so a retry after an ambiguous network fault cannot double-send. Mailgun documents no idempotency
  key for sends, so `mailgun.ts` retries only a 429 — provably not queued — and treats a timeout as
  terminal. A lost email is recoverable from `email_log`; a duplicate confirmation reaches a real
  customer and cannot be recalled.

## Not built yet

Google OAuth, the admin fulfillment UI against live orders, real product photography, native
Paystack checkout in the Expo app, and deployment.

The catalog **is** read from Supabase in production — `0001`–`0008` are applied and populated, with
8 products and 22 variants live. Paystack and the email transport are wired. Mailgun has been
verified live: credentials authenticate, the sandbox sending domain is active, and a test email was
accepted. Paystack still needs a test `sk_test_` secret key plus a webhook signing secret; locally,
forward events with `paystack listen --forward-to localhost:3001/api/paystack/webhook`, since
Paystack cannot reach `localhost` on its own.

Cross-device cart sync is built and unit-tested, but has **not been proven against real hardware**:
it needs two signed-in clients, which means either a physical phone or a second browser profile.
The four `e2e/cart-sync.spec.ts` tests skip until `E2E_EMAIL` and `E2E_EMAIL_PASSWORD` are set.

### Auth email cannot use the Mailgun sandbox domain

Supabase Auth's mailer was pointed at `smtp.mailgun.org:587`, and `site_url` was corrected from
port 3000 to 3001. Sends still fail, for a reason that no credential change can fix: **Mailgun
provisions no SMTP credentials for sandbox domains.** Its API returns an empty `smtp_login` for
`sandbox*.mailgun.org`, and every `AUTH` attempt returns `535 Authentication failed` regardless of
username or password. Supabase surfaces this only as the opaque "Error sending confirmation email".

Two further Mailgun credential distinctions worth knowing, both confirmed against the API:
- The private API key and the SMTP password are **separate secrets**. The API key authenticates the
  REST API and is rejected by the SMTP relay.
- A sandbox domain delivers over REST only to authorized, activated recipients — so it can never
  serve Auth mail even if SMTP worked.

`npm run email:smtp` therefore refuses to write this configuration and says why. After adding a
custom domain to the Mailgun account, re-run `npm run email:smtp` to save the config and
`npm run auth:verify` to exercise the whole path.

Password sign-up, password sign-in and password reset are built and tested in code, but unusable
end-to-end until a real sending domain exists. The reset flow is at `/forgot-password` and
`/reset-password`.

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