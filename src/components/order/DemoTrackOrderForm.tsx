"use client";

import { useSearchParams } from "next/navigation";
import TrackOrderFields from "@/components/order/TrackOrderFields";
import { useDemo } from "@/components/demo/DemoProvider";
import type { TrackedOrder } from "@/components/order/track-types";

/**
 * Demo order tracking.
 *
 * Reads from the seeded localStorage orders instead of the database, and keeps the
 * demo hint rows so a visitor can actually see the flow work. Split from the
 * production form because `useDemo()` throws when no `<DemoProvider>` is mounted.
 */
export default function DemoTrackOrderForm() {
  const searchParams = useSearchParams();
  const { lookupGuestOrder } = useDemo();

  async function lookup(orderNumber: string, email: string): Promise<TrackedOrder | null> {
    const order = lookupGuestOrder(orderNumber, email);
    if (!order) return null;

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        variantId: item.variantId,
        productName: item.productName,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        lineTotalAmount: item.lineTotalAmount,
      })),
      shipping: { name: order.shipping.name, city: order.shipping.city },
    };
  }

  return (
    <TrackOrderFields
      initialOrderNumber={searchParams.get("order") ?? ""}
      lookup={lookup}
      showDemoHints
    />
  );
}