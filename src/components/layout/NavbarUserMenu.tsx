"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_MODE } from "@/lib/demo/types";
import type { AuthUser } from "@/lib/auth/types";
import { signOut } from "@/app/actions/auth";

/**
 * The signed-in half of the navbar.
 *
 * Presentational: it renders a user it was handed and submits logout to a
 * Server Action. It holds no session state of its own.
 *
 * `serverUser` is null in demo mode, because the demo session lives in
 * localStorage and is unreadable from the server. In that case the demo
 * context supplies the user and signs out client-side, because there is no
 * cookie to clear.
 */
export default function NavbarUserMenu({
  serverUser,
  isAdmin,
}: {
  serverUser: AuthUser | null;
  isAdmin: boolean;
}) {
  const { user: clientUser, signOut: clientSignOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const user = serverUser ?? (DEMO_MODE ? clientUser : null);

  // Escape closes the menu and returns focus to the trigger, so keyboard users
  // are not stranded inside the closed menu. Declared before the early return
  // so the hook order stays stable across the signed-in and signed-out renders.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;

  const avatarUrl = serverUser?.avatarUrl ?? null;
  const initial = user.fullName.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    if (serverUser) {
      // Production: the Server Action clears the httpOnly cookie and redirects.
      // Awaiting it is not required — the action's own redirect navigates.
      await signOut();
      return;
    }
    // Demo: local state only.
    await clientSignOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 pl-1.5 pr-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/35"
      >
        <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-foreground text-[11px] font-semibold text-background">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={24}
              height={24}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            initial
          )}
        </span>
        <span className="hidden max-w-28 truncate sm:block">
          {user.fullName.split(" ")[0]}
        </span>
      </button>

      {open && (
        <>
          {/* Clicking away closes the menu without needing a document listener
              per instance, and keeps the trigger focused for keyboard users. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-foreground/12 bg-background shadow-lg"
          >
            <p className="border-b border-foreground/10 px-4 py-3">
              <span className="block truncate text-sm font-medium text-foreground">
                {user.email}
              </span>
              <span className="block truncate text-xs text-foreground/45">
                {user.fullName}
              </span>
              <span className="mt-1 block text-[11px] text-foreground/40">
                {isAdmin ? "Store owner" : "Customer"}
              </span>
            </p>

            <div className="p-1.5">
              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
                >
                  Fulfillment
                </Link>
              )}
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
              >
                Your orders
              </Link>
              <Link
                href="/track-order"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
              >
                Track an order
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void handleSignOut();
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}