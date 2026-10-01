import type { Metadata } from "next";
import AccountView from "@/components/account/AccountView";
import { DEMO_MODE } from "@/lib/demo/types";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your account
        </h1>
        {DEMO_MODE && (
          <p className="mt-2 text-sm text-foreground/60">
            Demo session stored in this browser. Real Google OAuth arrives with the Supabase
            auth step.
          </p>
        )}
      </header>

      <div className="mt-8">
        <AccountView />
      </div>
    </div>
  );
}
