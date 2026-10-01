import Link from "next/link";
import CartButton from "@/components/ui/CartButton";
import NavbarAuth from "@/components/layout/NavbarAuth";
import NavbarLinks from "@/components/layout/NavbarLinks";
import { getCurrentUser } from "@/lib/auth/current-user";
import MobileMenu, { type NavLink } from "./MobileMenu";

const NAV_LINKS: NavLink[] = [
  { href: "/products", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/track-order", label: "Track order" },
];

// Server Component: the session lives in an httpOnly cookie, so reading it here
// means the signed-in navbar is correct in the very first HTML response rather
// than after a client round-trip.
export default async function Navbar() {
  // Null in demo mode: the demo session lives in localStorage, which the server
  // cannot read. NavbarAuth resolves that case on the client.
  const user = await getCurrentUser();

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

        <NavbarLinks links={NAV_LINKS} serverIsAdmin={Boolean(user?.isAdmin)} />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartButton />
          <NavbarAuth serverUser={user} />
          <MobileMenu links={NAV_LINKS} />
        </div>
      </nav>
    </header>
  );
}