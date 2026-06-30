"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FaComments, FaShoppingCart } from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";

type Variant = {
  id: number;
  sku: string;
  name: string;
  attributes?: Record<string, unknown> | null;
  price: string | number;
  stock: number;
};

export default function ProductVariantPurchase({
  productId,
  sellerId,
  basePrice,
  baseStock,
  variants,
}: {
  productId: number;
  sellerId: string | null;
  basePrice: string | number;
  baseStock: number;
  variants: Variant[];
}) {
  const { formatPrice } = useCurrency();
  const available = useMemo(
    () => variants.filter((variant) => Number(variant.stock || 0) > 0),
    [variants]
  );
  const [selectedId, setSelectedId] = useState<number | null>(available[0]?.id || variants[0]?.id || null);
  const selected = variants.find((variant) => variant.id === selectedId) || null;
  const price = selected?.price ?? basePrice;
  const stock = selected ? Number(selected.stock || 0) : baseStock;
  const checkoutHref = selected
    ? `/checkout/${productId}?variant=${selected.id}`
    : `/checkout/${productId}`;

  return (
    <div>
      <p className="text-sm font-bold text-cyan-200">
        {variants.length > 0 ? "Selected SKU Price" : "Total Price"}
      </p>
      <p className="mt-2 text-4xl font-black text-cyan-300">{formatPrice(price)}</p>

      {variants.length > 0 ? (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-black text-slate-200">Choose variant</label>
          <div className="grid gap-2">
            {variants.map((variant) => {
              const selectedVariant = variant.id === selectedId;
              const soldOut = Number(variant.stock || 0) <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => setSelectedId(variant.id)}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    selectedVariant
                      ? "border-cyan-400 bg-cyan-400/15"
                      : "border-white/10 bg-black/25 hover:border-cyan-400/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{variant.name}</p>
                      <p className="mt-1 text-xs text-violet-300">SKU: {variant.sku}</p>
                      {variant.attributes && Object.keys(variant.attributes).length > 0 ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {Object.entries(variant.attributes)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-cyan-300">{formatPrice(variant.price)}</p>
                      <p className={`mt-1 text-xs ${soldOut ? "text-red-300" : "text-slate-400"}`}>
                        {soldOut ? "Sold out" : `${variant.stock} available`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <Link
          href={checkoutHref}
          aria-disabled={stock <= 0}
          className={`flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 font-black transition ${
            stock > 0
              ? "bg-cyan-400 text-black hover:bg-cyan-300"
              : "pointer-events-none bg-slate-700 text-slate-400"
          }`}
        >
          <FaShoppingCart />
          {stock > 0 ? "Buy Now" : "Out of Stock"}
        </Link>

        <Link
          href={`/messages?seller=${sellerId || ""}&product=${productId}`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-black text-white transition hover:border-cyan-400"
        >
          <FaComments />
          Chat Seller
        </Link>
      </div>
    </div>
  );
}
