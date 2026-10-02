export function requireSupabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !publishableKey &&
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);

    throw new Error(
      `Missing Supabase configuration: ${missing.join(", ")}. ` +
        "Set these in Netlify environment variables for the build and redeploy, " +
        "or in .env.local and restart the local server.",
    );
  }

  return { url, publishableKey };
}
