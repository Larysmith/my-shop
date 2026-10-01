# Project rules

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Supabase, Brevo or Mailgun.

- App Router only. No Pages Router.
- TypeScript in strict mode. No `any` — if a type is genuinely unknown, use `unknown` and narrow it.
- Tailwind for styling. No CSS-in-JS, no inline style objects except for genuinely dynamic values (such as a chart or a computed transform).
- Supabase for auth and Postgres. All data access goes through the Supabase clients, never a direct Postgres connection string — a direct connection bypasses RLS.
- Transactional email goes through the provider named by `EMAIL_PROVIDER` (`brevo`, `mailgun`, or `none`). Brevo is the default choice; Mailgun exists as a supported alternative. Adding a third provider means a new transport in `src/lib/server/email/` behind the same `EmailSender` interface — never a bespoke call site. Payments are Stripe only; do not add a second payment provider.

## Secrets

- **Never hardcode a secret, a key, a token, or a password in source code, in a comment, or in a test fixture.** Placeholders in `.env.example` are fine; real values are not.
- Read configuration from environment variables, loaded from `.env.local` in development.
- Only variables prefixed `NEXT_PUBLIC_` are sent to the browser. Everything else is stripped from the client bundle. A secret must never be given that prefix.
- Validate environment variables once at startup and fail loudly with a message naming the missing variable. A missing variable discovered at request time is a 500 in production.
- Mark server-only modules with `import 'server-only'`, so an accidental import from a client component is a build error rather than a runtime `undefined`.
- If a `.env` file is ever committed, treat it as an incident: the values are in git history permanently and the key must be rotated. Deleting the file is not remediation.

## Component structure

- Keep components small. A single component that renders more than roughly 150 lines, or mixes data fetching with substantial markup, should be split.
- All reusable components live in `/components`, grouped by feature (`components/product/…`, `components/cart/…`, `components/admin/…`), with shared primitives in `components/ui/`.
- Page and route files under `app/` stay thin. They compose components and handle params; they do not contain long markup blocks.
- Extract a component when the same markup appears twice, even if it is short. Duplication is cheaper than a wrong abstraction.
- Co-locate a component with the page that is its only consumer rather than promoting it to `/components` prematurely.

## Server-only logic

- Anything server-side lives in `/lib/server` (or is reachable only from a Server Action, Route Handler, or Server Component).
- `/lib` holds code that is safe to import from a client component. If a module must never reach the browser, it belongs under `/lib/server`.
- Privileged data access — the Supabase service-role client, Stripe secret operations, email sending — stays in `/lib/server` and is imported only from server contexts.
- Never derive an amount, price, stock level, or permission from client input. Re-read those from the database and recalculate server-side. A client that can send a value can change that value.
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
