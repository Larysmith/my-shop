"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/useCart";

export type NavLink = {
  href: string;
  label: string;
};

type MobileMenuProps = {
  links: NavLink[];
};

export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex size-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-16 border-b border-foreground/10 bg-background px-4 py-3"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  {link.label}
                  {link.href === "/cart" && itemCount > 0 && (
                    <span className="ml-2 text-foreground/40">({itemCount})</span>
                  )}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg bg-foreground px-3 py-2.5 text-center text-sm font-semibold text-background"
              >
                Login
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
