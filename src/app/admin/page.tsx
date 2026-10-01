import type { Metadata } from "next";
import AdminOrdersView from "@/components/admin/AdminOrdersView";

export const metadata: Metadata = {
  title: "Admin — orders",
  robots: { index: false },
};

// Renders the fulfillment view directly rather than redirecting to
// /admin/orders. A redirect() here gets baked into a meta-refresh when the page
// is prerendered, which client-side routers and tests do not follow.
export default function AdminIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Fulfillment
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
          Orders and the email log. Moving an order to shipped sends the customer and owner
          notifications.
        </p>
      </header>

      <div className="mt-8">
        <AdminOrdersView />
      </div>
    </div>
  );
}