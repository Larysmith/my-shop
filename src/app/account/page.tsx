import type { Metadata } from "next";
import AccountView from "@/components/account/AccountView";
import AccountContent from "@/components/account/AccountContent";
import SignOutForm from "@/components/account/SignOutForm";
import { DEMO_MODE } from "@/lib/demo/types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrdersForUser } from "@/lib/server/orders/read";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

export default async function AccountPage() {
  if (DEMO_MODE) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Your account
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Demo session stored in this browser. Real Google OAuth arrives with the Supabase
            auth step.
          </p>
        </header>

        <div className="mt-8">
          <AccountView />
        </div>
      </div>
    );
  }

  // The session is read on the server, so the order list is scoped before any
  // HTML is produced and a signed-out visitor sees no order data at all.
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Your account
          </h1>
        </header>

        <div className="mt-8">
          <AccountContent user={null} orders={[]} signedIn={false} />
        </div>
      </div>
    );
  }

  const orders = await getOrdersForUser(user.id, user.email);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your account
        </h1>
      </header>

      <div className="mt-8">
        <AccountContent
          user={{ fullName: user.fullName, email: user.email }}
          orders={orders.map((order) => ({
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            itemCount: order.items.length,
          }))}
        />
        <SignOutForm />
      </div>
    </div>
  );
}