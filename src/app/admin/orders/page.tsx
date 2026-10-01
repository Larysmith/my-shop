import type { Metadata } from "next";
import AdminOrdersView from "@/components/admin/AdminOrdersView";
import AdminOrdersTable, { AdminGate } from "@/components/admin/AdminOrdersTable";
import { DEMO_MODE } from "@/lib/demo/types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAllOrders, getEmailLog } from "@/lib/server/orders/read";

export const metadata: Metadata = {
  title: "Admin — orders",
  robots: { index: false },
};

// Admin reads are live data, so this must never be prerendered: a cached page
// would show stale fulfillment state to the owner.
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const body = (view: React.ReactNode) => (
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

      <div className="mt-8">{view}</div>
    </div>
  );

  if (DEMO_MODE) return body(<AdminOrdersView />);

  // Authorisation is re-checked here, not only in proxy.ts. Middleware can be
  // skipped by a client that never issues a matching request, so the service-role
  // reads below are guarded by this check rather than trusting the route.
  const user = await getCurrentUser();
  if (!user?.isAdmin) return body(<AdminGate />);

  const [orders, emails] = await Promise.all([getAllOrders(), getEmailLog()]);

  return body(
    <AdminOrdersTable
      orders={orders.map((order) => ({
        orderNumber: order.orderNumber,
        email: order.email,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        itemCount: order.items.length,
        customerName: order.shipping.name,
      }))}
      emails={emails.map((entry) => ({
        id: entry.id,
        // The log stores the template name, not the rendered subject. Deriving the
        // label here keeps the column meaningful without a second column.
        subject: entry.template.replace(/_/g, " "),
        toEmail: entry.toEmail,
        template: entry.template,
        status: entry.status,
        createdAt: entry.createdAt,
      }))}
    />,
  );
}