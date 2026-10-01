"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_MODE } from "@/lib/demo/types";
import type { AuthUser } from "@/lib/auth/types";
import NavbarUserMenu from "./NavbarUserMenu";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

/**
 * Decides what the navbar shows for authentication.
 *
 * In production the server has already read the session and the answer is
 * final, so this component just forwards it and adds no state of its own.
 *
 * In demo mode the session lives in localStorage and the server cannot see it,
 * so the decision has to happen on the client. This component exists only for
 * that case; it renders `null` before the demo state is read, which is why a
 * demo-mode navbar briefly shows the signed-out layout.
 */
export default function NavbarAuth({ serverUser }: { serverUser: AuthUser | null }) {
  const { user: demoUser, loading } = useAuth();

  if (serverUser) {
    return (
      <NavbarUserMenu serverUser={serverUser} isAdmin={serverUser.isAdmin} />
    );
  }

  if (DEMO_MODE) {
    if (demoUser) {
      return <NavbarUserMenu serverUser={null} isAdmin={Boolean(demoUser.isAdmin)} />;
    }
    return !loading ? (
      <Link
        href="/login"
        className="hidden h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 md:inline-flex"
      >
        Login
      </Link>
    ) : null;
  }

  return (
    <span className="hidden md:inline-flex">
      <GoogleSignInButton next="/account" />
    </span>
  );
}