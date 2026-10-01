import type { Metadata } from "next";
import Link from "next/link";
import OrderDetail from "@/components/order/OrderDetail";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false },
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function AccountOrderPage({ params }: PageProps) {
  const { orderNumber } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/account"
        className="text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        ← Your orders
      </Link>
      <div className="mt-6">
        <OrderDetail orderNumber={orderNumber} />
      </div>
    </div>
  );
}
