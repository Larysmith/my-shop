import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderDetail from "@/components/order/OrderDetail";
import OrderDetailView from "@/components/order/OrderDetailView";
import { DEMO_MODE } from "@/lib/demo/types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrderByNumber } from "@/lib/server/orders/read";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false },
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function AccountOrderPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const body = (view: React.ReactNode) => (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/account"
        className="text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        ← Your orders
      </Link>
      <div className="mt-6">{view}</div>
    </div>
  );

  if (DEMO_MODE) return body(<OrderDetail orderNumber={orderNumber} />);

  // getOrderByNumber uses the RLS-scoped client, so a row this buyer does not own
  // comes back as null rather than being rendered. That is the authorisation.
  const order = await getOrderByNumber(orderNumber);

  if (!order) {
    const user = await getCurrentUser();
    if (!user) {
      return body(
        <p className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center text-sm text-foreground/60">
          Sign in to view this order, or{" "}
          <Link href="/track-order" className="font-medium text-foreground underline">
            look it up with your email
          </Link>
          .
        </p>,
      );
    }
    notFound();
  }

  return body(<OrderDetailView order={order} />);
}