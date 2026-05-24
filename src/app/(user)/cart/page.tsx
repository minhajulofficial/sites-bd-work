"use client";

import { useCallback } from "react";

import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { CheckoutStep1 } from "@/components/checkout/CheckoutStep1";
import { useCart } from "@/lib/hooks/useCart";
import type { CartItemPatch } from "@/lib/cart/types";

export default function CartPage() {
  const { items, updateItem } = useCart();

  const handleUpdate = useCallback(
    async (id: string, patch: CartItemPatch): Promise<boolean> => {
      const result = await updateItem(id, patch);
      return result !== null;
    },
    [updateItem],
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Checkout</h1>

        <CheckoutStepper currentStep={1} />

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Step 1: Choose Hosting
          </h2>

          <CheckoutStep1 items={items} onUpdate={handleUpdate} />
        </div>
      </div>
    </div>
  );
}
