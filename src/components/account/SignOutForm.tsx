import { signOut } from "@/app/actions/auth";

/**
 * Sign out as a form rather than a link or a fetch.
 *
 * The session cookie is httpOnly, so only server code can clear it. The Server
 * Action does that and redirects in the same round-trip, which a browser-side
 * `auth.signOut()` could not do without a second navigation.
 */
export default function SignOutForm() {
  return (
    <form action={signOut} className="mt-6">
      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
      >
        Sign out
      </button>
    </form>
  );
}