import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

/**
 * Supabase client for the app.
 *
 * Same project as the website, which is the whole basis for "log in with the same
 * account": both surfaces authenticate against one `auth.users` table, so the same
 * email and password resolve to the same identity and the same RLS policies apply.
 *
 * Read statically, because only a static property access survives bundling.
 * EXPO_PUBLIC_ values are inlined into the JavaScript, which is why the key here
 * must be the publishable one: RLS is what protects the data, and a publishable
 * key is designed to be public. The secret key must never reach this file.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function missingKeys(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingKeys().length === 0;
}

export function supabaseConfigError(): string | null {
  const missing = missingKeys();
  if (missing.length === 0) return null;

  return (
    `Supabase is not configured: missing ${missing.join(", ")}. ` +
    `Copy mobile/.env.example to mobile/.env and fill it in with the same values as ` +
    `NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the shop's ` +
    `.env.local. EXPO_PUBLIC_ values are read at build time, so the app must be ` +
    `restarted after changing them.`
  );
}

/**
 * Sessions are kept in the encrypted store rather than AsyncStorage.
 *
 * This holds a live auth session, so it is the one thing in the app that must not
 * sit in plain text on the device.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

/** The shared client. Created once, because Realtime needs one live connection. */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const problem = supabaseConfigError();
  if (problem) throw new Error(problem);

  client = createClient(SUPABASE_URL as string, SUPABASE_PUBLISHABLE_KEY as string, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      // No URL to read a session out of: there is no browser redirect in the app,
      // and leaving this on makes the client look for one that never arrives.
      detectSessionInUrl: false,
    },
  });

  return client;
}
