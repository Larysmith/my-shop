"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CartButton from "@/components/ui/CartButton";
import { useDemo } from "@/components/demo/DemoProvider";
import { DEMO_MODE } from "@/lib/demo/types";
import MobileMenu, { type NavLink } from "./MobileMenu";

const NAV_LINKS: NavLink[] = [
  { href: "/products", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/track-order", label: "Track order" },
];

export default function Navbar() {
  const { user, signOut, hydrated } = useDemo();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Lary Shop
        </Link>

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
          {DEMO_MODE && hydrated && user?.isAdmin && (
            <li>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                Admin
              </Link>
            </li>
          )}
        </ul>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartButton />

          {DEMO_MODE && hydrated && user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 pl-1.5 pr-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/35"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate sm:block">
                  {user.fullName.split(" ")[0]}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-foreground/12 bg-background shadow-lg"
                >
                  <p className="border-b border-foreground/10 px-4 py-3">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {user.email}
                    </span>
                    <span className="block text-xs text-foreground/45">
                      {user.isAdmin ? "Store owner" : "Customer"}
                    </span>
                  </p>
                  <div className="p-1.5">
                    <Link
                      href={user.isAdmin ? "/admin" : "/account"}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
                    >
                      {user.isAdmin ? "Fulfillment" : "Your orders"}
                    </Link>
                    <Link
                      href="/track-order"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
                    >
                      Track an order
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-foreground/75 transition-colors hover:bg-foreground/5"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 md:inline-flex"
            >
              Login
            </Link>
          )}

          <MobileMenu links={NAV_LINKS} />
        </div>
      </nav>
    </header>
  );
}
