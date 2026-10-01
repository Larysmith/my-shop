"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/useCart";
import { useDemo } from "@/components/demo/DemoProvider";
import CheckoutFields, {
  validateCheckout,
  type CheckoutField,
} from "@/components/checkout/CheckoutFields";
import type { DemoShipping } from "@/lib/demo/types";

/**
 * Demo-mode checkout: writes a simulated order to localStorage.
 *
 * Split from the production form because `useDemo()` throws outside
 * `<DemoProvider>`, and production mounts no demo provider. Only this component
 * is rendered in demo mode, so the hook is never called in production.
 */
export default function DemoCheckoutForm() {
  const { lines, subtotalAmount, shippingAmount, totalAmount, clearCart } = useCart();
  const { user, placeOrder } = useDemo();
  const router = useRouter();

  const [values, setValues] = useState<Record<CheckoutField, string>>({
    email: user?.email ?? "",
    name: user?.fullName ?? "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "NG",
    customerNotes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [submitError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;

    const found = validateCheckout(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const shipping: DemoShipping = {
      name: values.name.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim() || undefined,
      city: values.city.trim(),
      region: values.region.trim() || undefined,
      postalCode: values.postalCode.trim(),
      country: values.country.trim().toUpperCase(),
    };

    const order = placeOrder({
      email: values.email,
      shipping,
      lines,
      customerNotes: values.customerNotes.trim() || undefined,
    });

    clearCart();
    router.push(`/checkout/success?order=${order.orderNumber}`);
  }

  return (
    <CheckoutFields
      values={values}
      errors={errors}
      onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
      onSubmit={handleSubmit}
      submitting={false}
      submitError={submitError}
      lines={lines}
      subtotalAmount={subtotalAmount}
      shippingAmount={shippingAmount}
      totalAmount={totalAmount}
    />
  );
}