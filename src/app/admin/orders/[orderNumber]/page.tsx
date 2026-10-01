import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderDetail from "@/components/order/OrderDetail";
import OrderDetailView from "@/components/order/OrderDetailView";
import { DEMO_MODE } from "@/lib/demo/types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrderByNumberForAdmin } from "@/lib/server/orders/read";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false },
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function AdminOrderPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const body = (view: React.ReactNode) => (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin/orders"
        className="text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        ← All orders
      </Link>
      <div className="mt-6">{view}</div>
    </div>
  );

  if (DEMO_MODE) return body(<OrderDetail orderNumber={orderNumber} isAdmin />);

  // Re-checked here rather than trusted from proxy.ts: middleware can be skipped
  // by a client that never issues a matching request, and this read uses the
  // service role.
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  const order = await getOrderByNumberForAdmin(orderNumber);
  if (!order) notFound();

  return body(<OrderDetailView order={order} />);
}