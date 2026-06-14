"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaMinus,
  FaPlus,
  FaShieldAlt,
  FaShoppingCart,
  FaStore,
  FaWallet,
} from "react-icons/fa";
import { trackMarketplaceEvent } from "@/lib/marketplace-events-client";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  price: string | number | null;
  seller?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  stock?: number | null;
  status?: string | null;
  game_name?: string | null;
  slug?: string | null;
};

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}

function formatPrice(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberPrice(value));
}

function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "ComePlayers Product"
  )}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();

  const routeProductId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const productId = searchParams.get("product") || routeProductId || "";

  const [product, setProduct] = useState<Product | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const unitPrice = numberPrice(product?.price);
  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  const stock = Number(product?.stock ?? 1);
  const sellerName = product?.seller_name || product?.seller || "Verified Seller";

  useEffect(() => {
    async function loadCheckout() {
      setLoading(true);
      setError("");

      const { data: authData } = await supabase.auth.getUser();
      setUserId(authData.user?.id || null);

      if (!productId) {
        setError("Product tidak ditemukan.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          title,
          price,
          seller,
          seller_id,
          seller_name,
          description,
          category,
          image_url,
          stock,
          status,
          game_name,
          slug
        `)
        .eq("id", Number(productId))
        .maybeSingle();

      if (error || !data || data.status !== "active") {
        setError("Produk tidak tersedia.");
        setLoading(false);
        return;
      }

      setProduct(data);
      trackMarketplaceEvent({
        event_type: "checkout_start",
        user_id: authData.user?.id || null,
        product_id: data.id,
        seller_id: data.seller_id || null,
        game_slug: data.game_name ? slugify(data.game_name) : null,
        game_name: data.game_name || null,
        category_slug: data.category ? slugify(data.category) : null,
        category_name: data.category || null,
      });
      setQuantity(1);
      setLoading(false);
    }

    loadCheckout();
  }, [productId]);

  async function createOrder() {
    if (!product || !userId) {
      setError("Silakan login terlebih dahulu.");
      return;
    }

    setCreating(true);
    setError("");

    const basePayload = {
      buyer_id: userId,
      seller_id: product.seller_id,
      product_id: product.id,
      quantity,
      total_amount: total,
      total_price: total,
      price: total,
      status: "pending",
      payment_status: "unpaid",
      product_title: product.title,
      seller_name: sellerName,
      game_name: product.game_name,
      category: product.category,
    };

    let orderId: number | string | null = null;

    const { data, error } = await supabase
      .from("orders")
      .insert(basePayload)
      .select("id")
      .single();

    if (error) {
      const minimalPayload = {
        buyer_id: userId,
        seller_id: product.seller_id,
        product_id: product.id,
        quantity,
        total_amount: total,
        status: "pending",
      };

      const retry = await supabase
        .from("orders")
        .insert(minimalPayload)
        .select("id")
        .single();

      if (retry.error) {
        setError(retry.error.message);
        setCreating(false);
        return;
      }

      orderId = retry.data?.id || null;
    } else {
      orderId = data?.id || null;
    }

    router.push(`/payment/${orderId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading checkout...
      </main>
    );
  }

  if (error && !product) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        <p className="text-xl font-black">{error}</p>
        <Link href="/" className="mt-5 inline-block text-cyan-300">
          Back Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Link
            href={`/product/${product?.slug || product?.id}`}
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300"
          >
            <FaArrowLeft />
            Back to Product
          </Link>

          <h1 className="mt-8 text-5xl font-black">Checkout</h1>
          <p className="mt-3 text-slate-300">
            Review your order before continuing to payment.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Order Item</h2>

            <div className="mt-6 flex flex-col gap-5 md:flex-row">
              <div
                className="h-48 w-full rounded-2xl border border-white/10 bg-cover bg-center md:w-72"
                style={{
                  backgroundImage: `url(${
                    product?.image_url || fallbackImage(product?.title || "")
                  })`,
                }}
              />

              <div className="flex-1">
                <h3 className="text-2xl font-black">{product?.title}</h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                    {product?.category || "Game Product"}
                  </span>

                  {product?.game_name ? (
                    <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                      {product.game_name}
                    </span>
                  ) : null}

                  <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                    Stock: {stock}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-black text-cyan-300">
                  {formatPrice(product?.price)}
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30"
                  >
                    <FaMinus />
                  </button>

                  <div className="flex h-11 w-16 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 font-black">
                    {quantity}
                  </div>

                  <button
                    onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Seller Information</h2>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-xl font-black text-black">
                {sellerName.charAt(0).toUpperCase()}
              </div>

              <div>
                <p className="font-black">{sellerName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  Verified marketplace seller
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaShieldAlt className="text-emerald-300" />
              <p className="mt-3 font-black">Escrow Protected</p>
              <p className="mt-2 text-sm text-slate-400">
                Payment held until order is completed.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaClock className="text-yellow-300" />
              <p className="mt-3 font-black">Fast Delivery</p>
              <p className="mt-2 text-sm text-slate-400">
                Seller processes digital product delivery.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaCheckCircle className="text-cyan-300" />
              <p className="mt-3 font-black">Safe Checkout</p>
              <p className="mt-2 text-sm text-slate-400">
                Complete everything inside ComePlayers.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-black">Order Summary</h2>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Item Price</span>
                <span className="font-bold">{formatPrice(product?.price)}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Quantity</span>
                <span className="font-bold">{quantity}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Platform Fee</span>
                <span className="font-bold">Rp 0</span>
              </div>

              <div className="flex justify-between text-lg">
                <span className="font-black">Total</span>
                <span className="font-black text-cyan-300">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {!userId ? (
              <button
                onClick={() => router.push("/")}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-5 py-4 font-black text-black"
              >
                Login to Continue
              </button>
            ) : (
              <button
                onClick={createOrder}
                disabled={creating}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
              >
                <FaShoppingCart />
                {creating ? "Creating Order..." : "Continue to Payment"}
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="flex items-center gap-2 text-xl font-black">
              <FaWallet className="text-cyan-300" />
              Payment Method
            </h3>

            <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-black/30 p-4">
              <p className="font-black">ComePlayers Wallet / Payment</p>
              <p className="mt-2 text-sm text-slate-400">
                You will choose the final payment method on the payment page.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}