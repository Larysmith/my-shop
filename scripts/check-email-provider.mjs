/**
 * Email provider preflight.
 *
 * Validates the active EMAIL_PROVIDER's credentials without sending anything.
 * Safe to run any time: the only endpoints called are read-only (domains,
 * account info, authorized recipients).
 *
 * Why this exists: a wrong API key and an unverified sending domain both fail
 * only once an order confirmation is already on its way, which is the worst
 * moment to find out. Run it after changing credentials.
 *
 * Real environment variables win over .env.local, so a provider can be checked
 * without editing the file. PowerShell:
 *   $env:EMAIL_PROVIDER="mailgun"; npm run check:email
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
// An override must not be ignored just because the shell value is empty.
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== "") env[key] = value;
}

const problems = [];
const notes = [];

function check(label, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`;
  console.log(`  [${line}]`);
  if (!ok) problems.push(label);
}

const provider = env.EMAIL_PROVIDER;
console.log(`\nEMAIL_PROVIDER = ${provider ?? "<unset>"}\n`);

if (!provider) {
  console.error(
    "Missing EMAIL_PROVIDER. Set it to brevo, mailgun, or none in .env.local.",
  );
  process.exit(1);
}

if (provider.toLowerCase() === "none") {
  console.log("Delivery is disabled. Nothing will be sent.\n");
  notes.push("EMAIL_PROVIDER=none — order emails are refused and logged as failed.");
} else if (provider.toLowerCase() === "brevo") {
  if (!env.BREVO_API_KEY || env.BREVO_API_KEY.includes("placeholder")) {
    check("BREVO_API_KEY is set", false);
  } else {
    // /v3/smtp/email has no dedicated validate endpoint, so the key cannot be
    // proven without sending. Only the shape can be checked.
    check("BREVO_API_KEY looks like a key", env.BREVO_API_KEY.startsWith("xkeysib-"),
      "expected the xkeysib- prefix");
  }
  check("BREVO_FROM_EMAIL is set", Boolean(env.BREVO_FROM_EMAIL));
} else if (provider.toLowerCase() === "mailgun") {
  const key = env.MAILGUN_API_KEY ?? "";
  const domain = env.MAILGUN_DOMAIN ?? "";
  const base = (env.MAILGUN_API_BASE ?? "https://api.mailgun.net").replace(/\/+$/, "");

check("MAILGUN_API_KEY is set", Boolean(key) && !key.includes("placeholder"));
  if (!key.startsWith("key-")) {
    // Older Mailgun keys were prefixed "key-". Newer ones are not, so this is
    // only a hint — never gate the real check on it. Mailgun's own response is
    // the authority.
    notes.push("MAILGUN_API_KEY has no 'key-' prefix (expected for newer keys).");
  }
  check("MAILGUN_DOMAIN is set", Boolean(domain));
  check("MAILGUN_FROM_EMAIL is set", Boolean(env.MAILGUN_FROM_EMAIL));

  if (key) {
    const auth = `Basic ${Buffer.from(`api:${key}`).toString("base64")}`;
    const call = async (path) => {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(30_000),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    };

    const domains = await call("/v3/domains?limit=20");
    if (domains.status === 401) {
      check("credentials authenticate", false, domains.body?.message ?? "unauthorised");
    } else if (domains.status !== 200) {
      check("credentials authenticate", false, `HTTP ${domains.status}`);
    } else {
      check("credentials authenticate", true);
      const items = domains.body?.items ?? [];
      const active = items.find((d) => d.name === domain);
      check("MAILGUN_DOMAIN exists on the account", Boolean(active),
        domain ? `looked for ${domain}` : "no domain configured");

      if (active) {
        check("MAILGUN_DOMAIN is active", active.state === "active", `state=${active.state}`);

        // A From address outside the sending domain is a warning, not a
        // failure: sandbox accounts may permit it, and Mailgun is the authority
        // on whether a given send is accepted.
        const fromMatchesDomain = Boolean(
          env.MAILGUN_FROM_EMAIL?.endsWith(`@${active.name}`),
        );
        if (!fromMatchesDomain) {
          notes.push(
            `MAILGUN_FROM_EMAIL (${env.MAILGUN_FROM_EMAIL}) is not on the sending domain ` +
              `(${active.name}). Real customers may see it as spoofed or land in spam.`,
          );
        } else {
          check("MAILGUN_FROM_EMAIL is on the sending domain", true);
        }

        if (active.type === "sandbox") {
          notes.push(
            "MAILGUN_DOMAIN is a sandbox domain: it can only send to authorized recipients " +
              "(max 5) who have clicked Mailgun's activation email. Real customers will not receive anything.",
          );
        }
      }

      const recipients = await call("/v5/sandbox/auth_recipients");
      if (recipients.status === 200) {
        const list = recipients.body?.recipients ?? [];
        const verified = list.filter((r) => r.activated).map((r) => r.email);
        const pending = list.filter((r) => !r.activated).map((r) => r.email);
        notes.push(
          `sandbox authorized recipients: ${verified.length} verified` +
            (verified.length ? ` (${verified.join(", ")})` : " — none verified yet"),
        );
        if (pending.length) {
          notes.push(`awaiting activation click: ${pending.join(", ")}`);
        }
        // The store-owner address is what order alerts go to, so it is the one
        // recipient that must be able to receive mail.
        if (env.MERCHANT_NOTIFICATION_EMAIL) {
          const ok = verified.includes(env.MERCHANT_NOTIFICATION_EMAIL);
          check("MERCHANT_NOTIFICATION_EMAIL can receive mail", ok,
            ok ? "" : "add and verify it as a sandbox recipient, or order alerts will not arrive");
        }
      }
    }
  }
} else {
  console.error(`Unknown EMAIL_PROVIDER "${provider}". Use brevo, mailgun, or none.`);
  process.exit(1);
}

if (notes.length) {
  console.log("\nNotes:");
  for (const note of notes) console.log(`  - ${note}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) found.\n`);
  process.exit(1);
}

console.log("\nAll checks passed.\n");