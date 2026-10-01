"use client";

import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo/DemoProvider";
import AccountContent from "@/components/account/AccountContent";

/**
 * Demo-mode account view: reads the localStorage-backed demo store.
 *
 * Production uses `AccountContent` directly from a Server Component, which
 * fetches through the RLS-scoped Supabase client instead. Splitting them is why
 * `useDemo()` is safe here — it is never mounted in production, where
 * `DemoProvider` is absent and the hook would throw.
 */
export default function AccountView() {
  const { user, orders, hydrated, signOut } = useDemo();
  const router = useRouter();

  if (!hydrated) {
    return <p className="text-sm text-foreground/55">Loading…</p>;
  }

  if (!user) {
    return <AccountContent user={null} orders={[]} signedIn={false} />;
  }

  // Guest orders count once the email matches, which is what linking an order to
  // an account achieves on the server.
  const mine = orders
    .filter((order) => order.userId === user.id || order.email === user.email)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <AccountContent
      user={{ fullName: user.fullName, email: user.email }}
      orders={mine.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        itemCount: order.items.length,
      }))}
      onSignOut={() => {
        signOut();
        router.push("/");
      }}
    />
  );
}