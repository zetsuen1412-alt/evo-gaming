"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCreditCard,
  FaMoneyBillWave,
  FaQrcode,
  FaShieldAlt,
  FaShoppingCart,
  FaStore,
  FaWallet,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
import { trackMarketplaceEvent } from "@/lib/marketplace-events-client";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  created_at?: string | null;
  product?: string | null;
  buyer?: string | null;
  price?: string | number | null;
  status?: string | null;
  payment_proof?: string | null;
  product_id?: number | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  quantity?: number | null;
  total_amount?: string | number | null;
  total_price?: string | number | null;
  payment_status?: string | null;
  product_title?: string | null;
  seller_name?: string | null;
  game_name?: string | null;
  category?: string | null;
};

type Product = {
  id: number;
  title?: string | null;
  price?: string | number | null;
  seller?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  category?: string | null;
  image_url?: string | null;
  game_name?: string | null;
};

type PaymentMethod = "wallet" | "qris" | "bank";

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}


function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "ComePlayers Order"
  )}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOrderTotal(order: Order | null, product: Product | null) {
  return (
    numberPrice(order?.total_amount) ||
    numberPrice(order?.total_price) ||
    numberPrice(order?.price) ||
    numberPrice(product?.price)
  );
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();

  const orderId = String(params?.id || "");

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => getOrderTotal(order, product), [order, product]);
  const quantity = Number(order?.quantity || 1);
  const productTitle =
    order?.product_title || order?.product || product?.title || "Product";
  const sellerName =
    order?.seller_name || product?.seller_name || product?.seller || "Verified Seller";
  const gameName = order?.game_name || product?.game_name || "-";
  const category = order?.category || product?.category || "Game Product";
  const imageUrl = product?.image_url || fallbackImage(productTitle);

  useEffect(() => {
    async function loadPayment() {
      setLoading(true);
      setError("");

      if (!orderId || Number.isNaN(Number(orderId))) {
        setError("Order tidak valid.");
        setLoading(false);
        return;
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", Number(orderId))
        .maybeSingle();

      if (orderError || !orderData) {
        setError("Order tidak ditemukan.");
        setLoading(false);
        return;
      }

      setOrder(orderData);

      if (orderData.product_id) {
        const { data: productData } = await supabase
          .from("products")
          .select(`
            id,
            title,
            price,
            seller,
            seller_id,
            seller_name,
            category,
            image_url,
            game_name
          `)
          .eq("id", Number(orderData.product_id))
          .maybeSingle();

        setProduct(productData || null);
      }

      setLoading(false);
    }

    loadPayment();
  }, [orderId]);

  async function payNow() {
    if (!order) return;

    setPaying(true);
    setError("");

    const paidStatus = method === "wallet" ? "paid" : "waiting_confirmation";
    const orderStatus = method === "wallet" ? "paid" : "waiting_payment";

    const paymentProof =
      method === "wallet"
        ? "Paid with ComePlayers Wallet"
        : method === "qris"
          ? "Waiting QRIS payment confirmation"
          : "Waiting bank transfer confirmation";

    const updatePayload = {
      status: orderStatus,
      payment_status: paidStatus,
      payment_proof: paymentProof,
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (updateError) {
      const fallbackPayload = {
        status: orderStatus,
        payment_proof: paymentProof,
      };

      const retry = await supabase
        .from("orders")
        .update(fallbackPayload)
        .eq("id", order.id);

      if (retry.error) {
        setError(retry.error.message);
        setPaying(false);
        return;
      }
    }

    await trackMarketplaceEvent({
      event_type: "payment_success",
      user_id: order.buyer_id || null,
      order_id: order.id,
      product_id: order.product_id || null,
      seller_id: order.seller_id || product?.seller_id || null,
      game_slug: gameName !== "-" ? slugify(gameName) : null,
      game_name: gameName !== "-" ? gameName : null,
      category_slug: category !== "Game Product" ? slugify(category) : null,
      category_name: category !== "Game Product" ? category : null,
      metadata: { payment_method: method, payment_status: paidStatus },
    });

    router.push(`/order-success/${order.id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading payment...
      </main>
    );
  }

  if (error && !order) {
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
            href={order?.product_id ? `/checkout/${order.product_id}` : "/"}
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300"
          >
            <FaArrowLeft />
            Back to Checkout
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <h1 className="text-5xl font-black">Payment</h1>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              {currency}
            </span>
          </div>

          <p className="mt-3 text-slate-300">
            Complete your payment securely on ComePlayers.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Order Details</h2>

            <div className="mt-6 flex flex-col gap-5 md:flex-row">
              <div
                className="h-48 w-full rounded-2xl border border-white/10 bg-cover bg-center md:w-72"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />

              <div className="flex-1">
                <h3 className="text-2xl font-black">{productTitle}</h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                    {category}
                  </span>

                  <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                    {gameName}
                  </span>

                  <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                    Qty: {quantity}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-3 text-sm text-slate-300">
                  <FaStore className="text-cyan-300" />
                  Seller: <span className="font-black text-white">{sellerName}</span>
                </div>

                <p className="mt-5 text-3xl font-black text-cyan-300">
                  {formatPrice(total)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Choose Payment Method</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <button
                onClick={() => setMethod("wallet")}
                className={`rounded-2xl border p-5 text-left transition ${
                  method === "wallet"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30 hover:border-cyan-400/50"
                }`}
              >
                <FaWallet className="text-3xl text-cyan-300" />
                <h3 className="mt-4 font-black">Wallet</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Pay instantly with ComePlayers wallet.
                </p>
              </button>

              <button
                onClick={() => setMethod("qris")}
                className={`rounded-2xl border p-5 text-left transition ${
                  method === "qris"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30 hover:border-cyan-400/50"
                }`}
              >
                <FaQrcode className="text-3xl text-cyan-300" />
                <h3 className="mt-4 font-black">QRIS</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Pay using QRIS and wait confirmation.
                </p>
              </button>

              <button
                onClick={() => setMethod("bank")}
                className={`rounded-2xl border p-5 text-left transition ${
                  method === "bank"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30 hover:border-cyan-400/50"
                }`}
              >
                <FaMoneyBillWave className="text-3xl text-cyan-300" />
                <h3 className="mt-4 font-black">Bank Transfer</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Transfer manually and wait seller/admin confirmation.
                </p>
              </button>
            </div>
          </div>

          {method !== "wallet" ? (
            <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
              <h2 className="text-2xl font-black text-yellow-200">
                Payment Instructions
              </h2>

              {method === "qris" ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-white text-black">
                    <FaQrcode className="text-8xl" />
                  </div>
                  <p className="mt-4 text-sm text-slate-300">
                    Scan QRIS demo code. Real gateway can be connected later.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-6">
                  <p className="text-sm text-slate-400">Bank Name</p>
                  <p className="mt-1 text-xl font-black">BCA / Mandiri Demo</p>

                  <p className="mt-5 text-sm text-slate-400">Account Number</p>
                  <p className="mt-1 text-xl font-black">1234567890</p>

                  <p className="mt-5 text-sm text-slate-400">Amount</p>
                  <p className="mt-1 text-2xl font-black text-cyan-300">
                    {formatPrice(total)}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-black">Payment Summary</h2>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Order ID</span>
                <span className="font-bold">#{order?.id}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Product</span>
                <span className="max-w-[190px] truncate font-bold">
                  {productTitle}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Quantity</span>
                <span className="font-bold">{quantity}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Method</span>
                <span className="font-bold uppercase">{method}</span>
              </div>

              <div className="flex items-start justify-between gap-4 text-lg">
                <span className="font-black">Total Pay</span>

                <div className="text-right">
                  <p className="font-black text-cyan-300">
                    {formatPrice(total)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Currency: {currency}
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              onClick={payNow}
              disabled={paying}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              <FaCreditCard />
              {paying ? "Processing Payment..." : "Pay Now"}
            </button>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
            <h3 className="flex items-center gap-2 text-xl font-black text-emerald-200">
              <FaShieldAlt />
              Buyer Protection
            </h3>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <p className="flex items-start gap-2">
                <FaCheckCircle className="mt-1 text-emerald-300" />
                Your payment is tracked inside ComePlayers.
              </p>

              <p className="flex items-start gap-2">
                <FaCheckCircle className="mt-1 text-emerald-300" />
                Seller will process your digital product after payment.
              </p>

              <p className="flex items-start gap-2">
                <FaCheckCircle className="mt-1 text-emerald-300" />
                Keep all communication and delivery inside ComePlayers.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}