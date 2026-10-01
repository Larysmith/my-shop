/**
 * Points Supabase Auth's outbound email at Mailgun.
 *
 * Supabase's built-in mailer only delivers to project team members and is capped
 * at 2 messages/hour, which makes password sign-up unusable. Routing Auth
 * through Mailgun reuses credentials already configured for order email.
 *
 * Writes to the Supabase project's auth config, so it needs
 * SUPABASE_ACCESS_TOKEN. No secret is printed: only whether a value is set.
 *
 *   node scripts/configure-auth-smtp.mjs
 *   node scripts/configure-auth-smtp.mjs --verify   # read back, write nothing
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== "") env[key] = value;
}

const verifyOnly = process.argv.includes("--verify");
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

const required = {
  SUPABASE_ACCESS_TOKEN: token,
  "NEXT_PUBLIC_SUPABASE_URL": ref,
  MAILGUN_DOMAIN: env.MAILGUN_DOMAIN,
  "MAILGUN_SMTP_PASSWORD or MAILGUN_API_KEY": env.MAILGUN_SMTP_PASSWORD || env.MAILGUN_API_KEY,
  MAILGUN_FROM_EMAIL: env.MAILGUN_FROM_EMAIL,
};
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const configUrl = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

// Mailgun splits SMTP hosts by region. The API host was the clue for which one
// applies; getting it wrong fails at send time, not at configuration time.
const isEu = (env.MAILGUN_API_BASE ?? "").includes(".eu.");
const smtpHost = isEu ? "smtp.eu.mailgun.org" : "smtp.mailgun.org";

if (verifyOnly) {
  const current = await fetch(configUrl, { headers }).then((r) => r.json());
  console.log("smtp_host              :", current.smtp_host || "(unset)");
  console.log("smtp_port              :", current.smtp_port || "(unset)");
  console.log("smtp_user              :", current.smtp_user ? "(set)" : "(unset)");
  console.log("smtp_pass              :", current.smtp_pass ? "(set)" : "(unset)");
  console.log("smtp_admin_email       :", current.smtp_admin_email || "(unset)");
  console.log("external_email_enabled :", current.external_email_enabled);
  console.log("mailer_autoconfirm     :", current.mailer_autoconfirm);
  console.log("rate_limit_email_sent  :", current.rate_limit_email_sent);
  console.log("site_url               :", current.site_url);
} else {
  await apply();
}

// No process.exit() here: calling it while a fetch keep-alive handle is still
// open trips an assertion on Windows and pollutes the output with a crash.

/** Reads the domain's type from Mailgun, or null if it cannot be determined. */
async function mailgunDomainType() {
  const auth = `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}`;
  const res = await fetch(
    `https://api.mailgun.net/v3/domains/${encodeURIComponent(env.MAILGUN_DOMAIN)}`,
    { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) },
  ).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.domain?.type ?? null;
}

async function apply() {
  // Mailgun keeps two distinct secrets. The private API key authenticates the
  // REST API; the SMTP password authenticates the relay. They are not
  // interchangeable — the API key is rejected by SMTP with "535 Authentication
  // failed" — so the SMTP password is preferred and its absence is stated
  // rather than silently falling back.
  const smtpPassword = env.MAILGUN_SMTP_PASSWORD || env.MAILGUN_API_KEY;
  if (!env.MAILGUN_SMTP_PASSWORD) {
    console.warn(
      "NOTE  MAILGUN_SMTP_PASSWORD is not set; falling back to MAILGUN_API_KEY.\n" +
      "      That key authenticates the REST API but Mailgun's SMTP relay will reject it.\n" +
      "      Set MAILGUN_SMTP_PASSWORD from Mailgun → SMTP settings.\n",
    );
  }

  // A sandbox domain cannot authenticate to the SMTP relay at all: Mailgun
  // leaves its smtp_login empty, and every AUTH attempt returns 535. Writing
  // this config anyway just moves the failure from "no mailer configured" to an
  // opaque "Error sending confirmation email", so refuse instead.
  const domainType = await mailgunDomainType();
  if (domainType === "sandbox") {
    console.error(
      `MAILGUN_DOMAIN (${env.MAILGUN_DOMAIN}) is a sandbox domain.\n` +
        "Sandbox domains have no SMTP credentials, so Auth email cannot use them.\n" +
        "Add a custom domain to the Mailgun account, then re-run this script.\n" +
        "\nVerify with: npm run email:probe:smtp",
    );
    process.exit(1);
  }

  // Supabase authenticates to the SMTP relay as postmaster@<sending domain>.
  const payload = {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    // Left off deliberately. Disabling confirmation lets anyone claim an address
    // they do not own; Supabase's docs call this out as not to do under pressure.
    mailer_autoconfirm: false,
    smtp_host: smtpHost,
    // The API models this as a string, not a number.
    smtp_port: "587",
    smtp_user: `postmaster@${env.MAILGUN_DOMAIN}`,
    smtp_pass: smtpPassword,
    smtp_admin_email: env.MAILGUN_FROM_EMAIL,
    // The app runs on 3001, not the Supabase default 3000. Without this, a link
    // that falls back to site_url points at a port nothing is listening on.
    site_url: env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  };

  const response = await fetch(configUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`PATCH failed (${response.status}):`, await response.text());
    process.exit(1);
  }

  console.log("Auth SMTP configured:");
  console.log(`  smtp_host        : ${payload.smtp_host}:${payload.smtp_port}`);
  console.log(`  smtp_user        : ${payload.smtp_user}`);
  console.log(`  smtp_pass        : (set, ${String(payload.smtp_pass).length} chars)`);
  console.log(`  send email as    : ${payload.smtp_admin_email}`);
  console.log(`  site_url         : ${payload.site_url}`);

  // Custom SMTP raises the ceiling from 2/hour to 30/hour; state it so the next
  // rate-limit surprise is not a mystery.
  const after = await fetch(configUrl, { headers }).then((r) => r.json());
  console.log(`  rate limit now   : ${after.rate_limit_email_sent}/hour`);
  console.log("\nRaise it further at Authentication → Rate Limits if you need more.");
}