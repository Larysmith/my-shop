"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_MODE } from "@/lib/demo/types";
import { useLocalCartSync } from "./useLocalCartSync";
import { useRemoteCartSync } from "./useRemoteCartSync";

/**
 * Decides where the cart lives and hands off to the right hook. Renders nothing.
 *
 * Mounted inside <AuthProvider> rather than beside it, because
 * <CartProvider> is the outermost provider in the root layout and cannot see the
 * session — and the session is exactly what decides where the cart is stored.
 *
 * While the session is still resolving, neither hook runs. That matters: reading
 * the local cart before knowing whether anyone is signed in would load a guest
 * cart and skip the merge that sign-in is supposed to perform.
 */
export default function CartSync() {
  const { user, loading } = useAuth();

  // Demo mode has no database to sync with, so it stays local like a guest cart.
  const localMode = DEMO_MODE || (!loading && !user);
  const userId = !DEMO_MODE && !loading && user ? user.id : null;

  useLocalCartSync(localMode);
  useRemoteCartSync(userId);

  return null;
}
