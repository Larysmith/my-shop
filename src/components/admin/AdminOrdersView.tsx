"use client";

import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo/DemoProvider";
import AdminOrdersTable, { AdminGate } from "@/components/admin/AdminOrdersTable";

/**
 * Demo-mode admin view over the localStorage store. Production reads through the
 * service role from a Server Component; see src/app/admin/orders/page.tsx.
 */
export default function AdminOrdersView() {
  const { user, orders, emails, hydrated, resetDemo } = useDemo();
  const router = useRouter();

  if (!hydrated) {
    return <p className="text-sm text-foreground/55">Loading…</p>;
  }

  if (!user?.isAdmin) {
    return <AdminGate />;
  }

  return (
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
        subject: entry.subject,
        toEmail: entry.toEmail,
        template: entry.template,
        status: entry.status,
        createdAt: entry.createdAt,
      }))}
      onReset={() => {
        resetDemo();
        router.refresh();
      }}
    />
  );
}