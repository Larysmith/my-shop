"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_MODE } from "@/lib/demo/types";
import type { NavLink } from "./MobileMenu";

/**
 * The primary navigation links.
 *
 * `serverIsAdmin` is authoritative in production. In demo mode it is always
 * false — the server cannot read the localStorage session — so the admin entry
 * is resolved from the demo context on the client instead.
 */
export default function NavbarLinks({
  links,
  serverIsAdmin,
}: {
  links: NavLink[];
  serverIsAdmin: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = serverIsAdmin || (DEMO_MODE && Boolean(user?.isAdmin));

  return (
    <ul className="ml-2 hidden items-center gap-1 md:flex">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            {link.label}
          </Link>
        </li>
      ))}
      {isAdmin && (
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
  );
}