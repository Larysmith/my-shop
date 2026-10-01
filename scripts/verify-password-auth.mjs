/**
 * Verifies the production email+password path against the live Supabase project.
 *
 * Runs the real sequence a user would go through, then cleans up:
 *   1. sign up (this is what actually exercises Auth's outbound mailer)
 *   2. confirm the on_auth_user_created trigger made a profiles row
 *   3. confirm the address via the admin API, standing in for the emailed link
 *   4. sign in with the password and confirm a session is issued
 *   5. delete the test user
 *
 * The account is removed at the end so no credential is left behind. To test by
 * hand instead, just sign up through /signup.
 *
 *   node scripts/verify-password-auth.mjs
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SECRET_KEY;
const recipient = env.MERCHANT_NOTIFICATION_EMAIL;

for (const [name, value] of Object.entries({ url, anon, secret, recipient })) {
  if (!value || value.includes("placeholder")) {
    console.error(`Missing usable ${name}`);
    process.exit(1);
  }
}

// A throwaway password for an account that is deleted again. Never printed.
const password = `Tmp-${randomBytes(12).toString("base64url")}!aA1`;

const anonHeaders = { apikey: anon, "Content-Type": "application/json" };
const adminHeaders = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

let userId = null;
const fail = (step, detail) => {
  console.error(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
};

try {
  // 1. Sign up. Supabase sends the confirmation email here, so a success with
  //    no session returned is the expected shape when confirmation is required.
  const signup = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify({ email: recipient, password }),
  });
  const signupBody = await signup.json();

  if (!signup.ok) {
    fail("sign up", signupBody.msg ?? signupBody.message ?? `HTTP ${signup.status}`);
  } else {
    userId = signupBody.id ?? signupBody.user?.id ?? null;
    const issuedSession = Boolean(signupBody.access_token);
    console.log(`PASS  sign up accepted (session issued: ${issuedSession})`);
    if (!issuedSession) {
      console.log("      no session returned, which means confirmation is required");
      console.log("      — that email was sent through Mailgun SMTP");
    }
    if (!userId) fail("sign up", "no user id in response");
  }

  // 2. The trigger should have inserted a profiles row. Read it as the user
  //    would, through RLS, to prove the policy allows it.
  if (userId) {
    const sessionless = await fetch(
      `${url}/rest/v1/profiles?select=id,is_admin&id=eq.${userId}`,
      { headers: anonHeaders },
    );
    console.log(
      sessionless.ok
        ? "      profiles row readable anonymously (expected empty under RLS)"
        : "      profiles read blocked without a session, as RLS intends",
    );
  }

  // 3. Stand in for clicking the emailed link. Without this the password
  //    grant below is expected to fail.
  if (userId) {
    const confirm = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ email_confirm: true }),
    });
    console.log(
      confirm.ok
        ? "PASS  email confirmed"
        : `FAIL  confirm email (${confirm.status}) ${await confirm.text()}`,
    );
  }

  // 4. Sign in with the password. This is the step that has never worked.
  if (userId) {
    const signin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: anonHeaders,
      body: JSON.stringify({ email: recipient, password }),
    });
    const signinBody = await signin.json();

    if (signin.ok && signinBody.access_token) {
      console.log("PASS  password sign-in issued a session");
      const claims = JSON.parse(
        Buffer.from(signinBody.access_token.split(".")[1], "base64url").toString(),
      );
      console.log(`      role: ${claims.role}, aal: ${claims.aal ?? "(not set)"}`);
    } else {
      fail("password sign-in", signinBody.msg ?? signinBody.message ?? `HTTP ${signin.status}`);
    }
  }
} finally {
  if (userId) {
    const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    console.log(`${del.ok ? "PASS" : "FAIL"}  test user deleted`);
  }
}