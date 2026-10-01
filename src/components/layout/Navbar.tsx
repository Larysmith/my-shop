import Link from "next/link";
import CartButton from "@/components/ui/CartButton";
import MobileMenu, { type NavLink } from "./MobileMenu";

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/cart", label: "Cart" },
];

export default function Navbar() {
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
        </ul>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartButton />
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 md:inline-flex"
          >
            Login
          </Link>
          <MobileMenu links={NAV_LINKS} />
        </div>
      </nav>
    </header>
  );
}
