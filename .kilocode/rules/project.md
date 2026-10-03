# Project rules

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Supabase, Brevo or Mailgun.

- App Router only. No Pages Router.
- TypeScript in strict mode. No `any` — if a type is genuinely unknown, use `unknown` and narrow it.
- Tailwind for styling. No CSS-in-JS, no inline style objects except for genuinely dynamic values (such as a chart or a computed transform).
- Supabase for auth and Postgres. All data access goes through the Supabase clients, never a direct Postgres connection string — a direct connection bypasses RLS.
- Transactional email goes through the provider named by `EMAIL_PROVIDER` (`brevo`, `mailgun`, or `none`). Brevo is the default choice; Mailgun exists as a supported alternative. Adding a third provider means a new transport in `src/lib/server/email/` behind the same `EmailSender` interface — never a bespoke call site. Payments are Paystack only; do not add a second payment provider.
- The Expo app in `mobile/` shares this repo's Supabase project. It is a separate package with its own `node_modules` and its own tsconfig; it is not a Next.js app and does not use the App Router.

## Secrets

- **Never hardcode a secret, a key, a token, or a password in source code, in a comment, or in a test fixture.** Placeholders in `.env.example` are fine; real values are not.
- Read configuration from environment variables, loaded from `.env.local` in development.
- Only variables prefixed `NEXT_PUBLIC_` are sent to the browser. Everything else is stripped from the client bundle. A secret must never be given that prefix.
- Validate environment variables once at startup and fail loudly with a message naming the missing variable. A missing variable discovered at request time is a 500 in production.
- Mark server-only modules with `import 'server-only'`, so an accidental import from a client component is a build error rather than a runtime `undefined`.
- The mobile app cannot see `.env.local`, and Metro inlines anything prefixed `EXPO_PUBLIC_`. Use that prefix only for values that are genuinely public — the Supabase anon key and site URL qualify; a service-role key never does. A secret placed in a mobile source file or an `EXPO_PUBLIC_` variable ships to every device.
- If a `.env` file is ever committed, treat it as an incident: the values are in git history permanently and the key must be rotated. Deleting the file is not remediation.

## Component structure

- Keep components small. A single component that renders more than roughly 150 lines, or mixes data fetching with substantial markup, should be split.
- All reusable components live in `/components`, grouped by feature (`components/product/…`, `components/cart/…`, `components/admin/…`), with shared primitives in `components/ui/`.
- Page and route files under `app/` stay thin. They compose components and handle params; they do not contain long markup blocks.
- Extract a component when the same markup appears twice, even if it is short. Duplication is cheaper than a wrong abstraction.
- Co-locate a component with the page that is its only consumer rather than promoting it to `/components` prematurely.
- **Only pure code is shared with `mobile/`.** The mobile app reaches this repo's `src/lib` exclusively through `mobile/src/shared.ts`, and every path it re-exports must also be listed in `mobile/tsconfig.json` `include`. A shared module must have no server, Supabase, `localStorage`, DOM or React dependency. Anything impure gets a separate thin `src/api/` layer in the mobile app instead. Never widen `shared.ts` to reach around that, because it is the only thing keeping server code out of a device bundle.

## Server-only logic

- Anything server-side lives in `/lib/server` (or is reachable only from a Server Action, Route Handler, or Server Component).
- `/lib` holds code that is safe to import from a client component. If a module must never reach the browser, it belongs under `/lib/server`.
- Privileged data access — the Supabase service-role client, Paystack secret operations, email sending — stays in `/lib/server` and is imported only from server contexts.
- Never derive an amount, price, stock level, or permission from client input. Re-read those from the database and recalculate server-side. A client that can send a value can change that value.
- Money is integer minor units of the shop currency, NGN kobo, and is never a float or a decimal string. Name money fields `*_amount`, never `*_cents`: the suffix must not name a currency the shop no longer uses. The ISO code lives in an adjacent `currency` field, so an amount is never read without it. `formatPrice` in `/lib/pricing` is the only place that renders one.
- Relying on middleware for a security check is not sufficient; enforce authorization again inside the route, action, or page, because a client can skip a middleware-matched request.

## Verification and reporting

- After every change, briefly explain **what you did** and **how to test it**. Keep it to a few lines: what changed, which file, and the concrete step a person can take to confirm it works.
- Do not claim a change works without having run it. If you could not run it, say so plainly.
- Run the project's lint and typecheck commands after changes, and report the result — including failures.
- Prefer stating a limitation or a risk you found over leaving it implied.

## Dependencies

- **Ask before installing any new package.** Do not add a dependency, even a small one, without explicit approval.
- Before asking, say what the package does, why the existing dependencies cannot do it, and what it adds to the bundle or the build.
- Use what is already installed when it is a reasonable fit. Read the surrounding code before reaching for anything new.
