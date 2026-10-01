"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useDemo } from "@/components/demo/DemoProvider";
import { createClient } from "@/lib/supabase/client";
import { DEMO_MODE } from "@/lib/demo/types";
import type { AuthUser } from "@/lib/auth/types";

export type { AuthUser };

export type AuthContextValue = {
  user: AuthUser | null;
  /** False until the session has been resolved, so the UI can avoid flashing "logged out". */
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User, isAdmin: boolean): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Customer",
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    isAdmin,
  };
}

/**
 * Production session, backed by Supabase Auth.
 *
 * `isAdmin` is read from the caller's own `profiles` row. The service-role
 * client must never be used here to read it: it would bypass RLS and could leak
 * another user's profile into the browser.
 */
function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Keyed by user id rather than a bare boolean, so signing out needs no
  // setState in the effect body — the flag is simply absent for that user.
  const [adminByUser, setAdminByUser] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
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
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let active = true;

    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setAdminByUser((prev) => ({ ...prev, [userId]: Boolean(data?.is_admin) }));
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = userId ? (adminByUser[userId] ?? false) : false;
    return {
      user: session?.user ? toAuthUser(session.user, isAdmin) : null,
      loading,
      signOut,
    };
  }, [session, userId, adminByUser, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Demo session, backed by the seeded localStorage accounts. */
function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut: demoSignOut } = useDemo();

  const signOut = useCallback(async () => {
    demoSignOut();
  }, [demoSignOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user
        ? {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            avatarUrl: null,
            isAdmin: user.isAdmin,
          }
        : null,
      loading: false,
      signOut,
    }),
    [user, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Picks the auth implementation at the component level rather than by calling
 * hooks conditionally.
 *
 * This exists because Navbar used to call useDemo() directly, which throws
 * outside <DemoProvider>. Since the root layout only mounts that provider in
 * demo mode, every page crashed when NEXT_PUBLIC_DEMO_MODE was false — the
 * production path could not render at all.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return DEMO_MODE ? (
    <DemoAuthProvider>{children}</DemoAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}