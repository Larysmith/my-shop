import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SuccessView from "@/components/checkout/SuccessView";
import ProductionSuccessView from "@/components/checkout/ProductionSuccessView";
import { DEMO_MODE } from "@/lib/demo/types";
import { verifyOrderToken } from "@/lib/server/orders/view-token";
import { getOrderForConfirmation } from "@/lib/server/orders/read";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

type PageProps = {
  searchParams: Promise<{ order?: string; token?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (DEMO_MODE) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <SuccessView orderNumber={params.order ?? ""} />
      </div>
    );
  }

  // The token proves this browser was redirected from a checkout this shop
  // started. Without it there is no way to know who is asking, since a guest
  // buyer has no session, so an unsigned order number is refused outright.
  const orderNumber = verifyOrderToken(params.token ?? null);
  if (!orderNumber) notFound();

  const order = await getOrderForConfirmation(orderNumber);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <ProductionSuccessView order={order} />
    </div>
  );
}