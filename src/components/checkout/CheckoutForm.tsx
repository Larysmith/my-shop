"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/useCart";
import { useDemo } from "@/components/demo/DemoProvider";
import { formatPrice } from "@/lib/pricing";
import { DEMO_MODE, type DemoShipping } from "@/lib/demo/types";
import { startPaystackCheckout } from "@/app/checkout/actions";

type Field = keyof DemoShipping | "email" | "customerNotes";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";
const LABEL = "block text-sm font-medium text-foreground";

export default function CheckoutForm() {
  const { lines, subtotalAmount, shippingAmount, totalAmount, clearCart } = useCart();
  const { user, placeOrder } = useDemo();
  const router = useRouter();

  const [values, setValues] = useState<Record<Field, string>>({
    email: user?.email ?? "",
    name: user?.fullName ?? "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
    customerNotes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set(key: Field, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const next: Partial<Record<Field, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!values.name.trim()) next.name = "Required";
    if (!values.line1.trim()) next.line1 = "Required";
    if (!values.city.trim()) next.city = "Required";
    if (!values.postalCode.trim()) next.postalCode = "Required";
    if (values.country.trim().length !== 2) next.country = "2-letter code";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0 || submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    const shipping: DemoShipping = {
      name: values.name.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim() || undefined,
      city: values.city.trim(),
      region: values.region.trim() || undefined,
      postalCode: values.postalCode.trim(),
      country: values.country.trim().toUpperCase(),
    };

    if (DEMO_MODE) {
      const order = placeOrder({
        email: values.email,
        shipping,
        lines,
        customerNotes: values.customerNotes.trim() || undefined,
      });

      clearCart();
      router.push(`/checkout/success?order=${order.orderNumber}`);
      return;
    }

    // Production: the Server Action re-prices from the database, records the
    // pending order, and returns a hosted payment URL. The cart is cleared
    // only once Paystack has accepted the transaction.
    const result = await startPaystackCheckout({
      email: values.email,
      shipping,
      lines,
      customerNotes: values.customerNotes.trim() || undefined,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    clearCart();
    window.location.href = result.url;
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
        <p className="text-sm text-foreground/60">Your cart is empty.</p>
        <Link
          href="/products"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <div className="mt-3">
            <label htmlFor="co-email" className={LABEL}>
              Email
            </label>
            <input
              id="co-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              className={`mt-1.5 ${INPUT}`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
            )}
            <p className="mt-1.5 text-xs text-foreground/50">
              Your receipt and tracking link go here.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Shipping address</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="co-name" className={LABEL}>
                Full name
              </label>
              <input
                id="co-name"
                autoComplete="name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
                className={`mt-1.5 ${INPUT}`}
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-line1" className={LABEL}>
                Address
              </label>
              <input
                id="co-line1"
                autoComplete="address-line1"
                value={values.line1}
                onChange={(e) => set("line1", e.target.value)}
                aria-invalid={Boolean(errors.line1)}
                className={`mt-1.5 ${INPUT}`}
              />
              {errors.line1 && <FieldError>{errors.line1}</FieldError>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-line2" className={LABEL}>
                Apartment, suite (optional)
              </label>
              <input
                id="co-line2"
                autoComplete="address-line2"
                value={values.line2}
                onChange={(e) => set("line2", e.target.value)}
                className={`mt-1.5 ${INPUT}`}
              />
            </div>
            <div>
              <label htmlFor="co-city" className={LABEL}>
                City
              </label>
              <input
                id="co-city"
                autoComplete="address-level2"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
                aria-invalid={Boolean(errors.city)}
                className={`mt-1.5 ${INPUT}`}
              />
              {errors.city && <FieldError>{errors.city}</FieldError>}
            </div>
            <div>
              <label htmlFor="co-region" className={LABEL}>
                State / region
              </label>
              <input
                id="co-region"
                autoComplete="address-level1"
                value={values.region}
                onChange={(e) => set("region", e.target.value)}
                className={`mt-1.5 ${INPUT}`}
              />
            </div>
            <div>
              <label htmlFor="co-postal" className={LABEL}>
                Postal code
              </label>
              <input
                id="co-postal"
                autoComplete="postal-code"
                value={values.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                aria-invalid={Boolean(errors.postalCode)}
                className={`mt-1.5 ${INPUT}`}
              />
              {errors.postalCode && <FieldError>{errors.postalCode}</FieldError>}
            </div>
            <div>
              <label htmlFor="co-country" className={LABEL}>
                Country
              </label>
              <input
                id="co-country"
                autoComplete="country"
                maxLength={2}
                value={values.country}
                onChange={(e) => set("country", e.target.value.toUpperCase())}
                aria-invalid={Boolean(errors.country)}
                className={`mt-1.5 ${INPUT}`}
              />
              {errors.country && <FieldError>{errors.country}</FieldError>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Notes (optional)</h2>
          <textarea
            rows={3}
            value={values.customerNotes}
            onChange={(e) => set("customerNotes", e.target.value)}
            className={`mt-3 w-full resize-y rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none`}
            placeholder="Delivery instructions"
          />
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-base font-semibold text-foreground">Order summary</h2>

          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-foreground/70">
                  <span className="block truncate text-foreground">{line.name}</span>
                  {line.variantTitle && (
                    <span className="text-xs text-foreground/50">{line.variantTitle}</span>
                  )}
                  <span className="text-xs text-foreground/50">× {line.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatPrice(line.priceAmount * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-foreground/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/60">Subtotal</dt>
              <dd className="tabular-nums text-foreground">{formatPrice(subtotalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/60">Shipping</dt>
              <dd className="tabular-nums text-foreground">
                {shippingAmount === 0 ? "Free" : formatPrice(shippingAmount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-foreground/10 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(totalAmount)}</dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Processing…" : "Pay with card"}
          </button>

          {submitError && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-center text-xs text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}

          <p className="mt-3 text-center text-xs text-foreground/45">
            {DEMO_MODE
? "Demo mode — no card is charged and no payment transaction is created."
        : "You will be taken to Paystack to pay. Card details are never handled by this shop."}
          </p>
        </div>
      </aside>
    </form>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{children}</p>
  );
}
