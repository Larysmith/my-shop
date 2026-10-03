import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured, supabaseConfigError } from "../api/supabase";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthState = {
  user: AuthUser | null;
  /** False until the stored session has been read, so the UI need not flash signed-out. */
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

/**
 * Supabase Auth for the app.
 *
 * "The same account as the website" needs nothing beyond this: both surfaces
 * authenticate against one `auth.users` table, so one email and password resolves
 * to one identity in both places. Each device keeps its own session, which is why
 * signing in here does not sign in a browser.
 *
 * Email and password only for now. Google sign-in on a device needs a stable
 * redirect URI registered in both Supabase and Google, which requires a
 * development build rather than Expo Go — see the plan's out-of-scope list.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const configured = isSupabaseConfigured();
  const configError = configured ? null : supabaseConfigError();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let active = true;

    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      });

    const { data: subscription } = getSupabase().auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const { error } = await getSupabase().auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        // One message for "no such user" and "wrong password". Telling them apart
        // turns this form into a way to discover which emails have accounts.
        if (error) return "That email and password combination did not work.";
        return null;
      } catch {
        return "Could not sign you in. Please try again.";
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  return {
    user: session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null,
    loading,
    configError,
    signIn,
    signOut,
  };
}
