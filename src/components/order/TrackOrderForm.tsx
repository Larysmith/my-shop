"use client";

import { useSearchParams } from "next/navigation";
import TrackOrderFields from "@/components/order/TrackOrderFields";
import { trackOrder } from "@/app/actions/orders";
import type { TrackedOrder } from "@/components/order/track-types";

/**
 * Production order tracking.
 *
 * The lookup is a Server Action that queries Postgres. Nothing here touches
 * `useDemo()`: that hook throws outside `<DemoProvider>`, and production mounts
 * no demo provider — calling it would break client hydration on this page.
 */
export default function TrackOrderForm() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams.get("order") ?? "";

  async function lookup(orderNumber: string, email: string): Promise<TrackedOrder | null> {
    // The order number and email are the only credentials a guest has. Neither
    // alone reveals anything.
    const result = await trackOrder({ orderNumber, email });
    return result.ok ? (result.order as TrackedOrder) : null;
  }

  return (
    <TrackOrderFields
      initialOrderNumber={initialOrderNumber}
      lookup={lookup}
      showDemoHints={false}
    />
  );
}
