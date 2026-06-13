"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaComments,
  FaCreditCard,
  FaExclamationTriangle,
  FaReceipt,
  FaShieldAlt,
  FaShoppingBag,
  FaStore,
  FaTruck,
  FaUser,
  FaWallet,
} from "react-icons/fa";
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
  image_url?: string | null;
  price?: string | number | null;
  seller?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  game_name?: string | null;
  category?: string | null;
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

function getOrderTotal(order: Order | null, product: Product | null) {
  return (
    numberPrice(order?.total_amount) ||
    numberPrice(order?.total_price) ||
    numberPrice(order?.price) ||
    numberPrice(product?.price)
  );
}

function normalizeStatus(value?: string | null) {
  return String(value || "pending").toLowerCase();
}

function prettyStatus(value?: string | null) {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusStyle(value?: string | null) {
  const status = normalizeStatus(value);

  if (status.includes("complete")) {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (status.includes("delivered")) {
    return "border-blue-400/40 bg-blue-400/10 text-blue-300";
  }

  if (status.includes("paid")) {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-300";
  }

  if (status.includes("waiting")) {
    return "border-yellow-400/40 bg-yellow-400/10 text-yellow-300";
  }

  if (status.includes("cancel")) {
    return "border-red-400/40 bg-red-400/10 text-red-300";
  }

  return "border-slate-400/30 bg-slate-400/10 text-slate-300";
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "Order"
  )}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = Number(params?.id || 0);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => getOrderTotal(order, product), [order, product]);
  const productTitle =
    order?.product_title || order?.product || product?.title || "Product";
  const sellerName =
    order?.seller_name || product?.seller_name || product?.seller || "Verified Seller";
  const buyerName = order?.buyer || order?.buyer_id || "Buyer";
  const gameName = order?.game_name || product?.game_name || "-";
  const category = order?.category || product?.category || "Game Product";
  const quantity = Number(order?.quantity || 1);
  const imageUrl = product?.image_url || fallbackImage(productTitle);

  const isBuyer = Boolean(order?.buyer_id && order.buyer_id === currentUserId);
  const isSeller = Boolean(order?.seller_id && order.seller_id === currentUserId);

  async function loadOrder() {
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    setCurrentUserId(authData.user?.id || null);

    if (!orderId) {
      setError("Order tidak valid.");
      setLoading(false);
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
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
          image_url,
          price,
          seller,
          seller_id,
          seller_name,
          game_name,
          category
        `)
        .eq("id", Number(orderData.product_id))
        .maybeSingle();

      setProduct(productData || null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function updateOrderStatus(nextStatus: string) {
    if (!order) return;

    setUpdating(nextStatus);
    setError("");

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: nextStatus,
      })
      .eq("id", order.id);

    if (updateError) {
      setError(updateError.message);
      setUpdating("");
      return;
    }

    await loadOrder();
    setUpdating("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading order detail...
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        <p className="text-xl font-black">{error}</p>
        <Link href="/my-orders" className="mt-5 inline-block text-cyan-300">
          Back to My Orders
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300"
          >
            <FaArrowLeft />
            Back
          </button>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2 text-sm font-black text-cyan-200">
                Order #{order?.id}
              </div>

              <h1 className="mt-5 text-5xl font-black">Order Detail</h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                Track payment, seller delivery, buyer confirmation, and order
                status.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${statusStyle(
                  order?.status
                )}`}
              >
                {prettyStatus(order?.status)}
              </span>

              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${statusStyle(
                  order?.payment_status
                )}`}
              >
                Payment: {prettyStatus(order?.payment_status)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div className="grid gap-0 md:grid-cols-[300px_1fr]">
              <div
                className="min-h-72 bg-cover bg-center"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />

              <div className="p-6">
                <h2 className="text-3xl font-black">{productTitle}</h2>

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

                <p className="mt-6 text-4xl font-black text-cyan-300">
                  {formatPrice(total)}
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <FaUser className="text-cyan-300" />
                      Buyer
                    </p>
                    <p className="mt-1 truncate font-black">{buyerName}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <FaStore className="text-cyan-300" />
                      Seller
                    </p>
                    <p className="mt-1 truncate font-black">{sellerName}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <FaClock className="text-yellow-300" />
                      Created
                    </p>
                    <p className="mt-1 font-black">
                      {formatDate(order?.created_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                      <FaCreditCard className="text-cyan-300" />
                      Payment Proof
                    </p>
                    <p className="mt-1 truncate font-black">
                      {order?.payment_proof || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Order Timeline</h2>

            <div className="mt-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-black">
                  <FaReceipt />
                </div>
                <div>
                  <p className="font-black">Order Created</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(order?.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    normalizeStatus(order?.payment_status).includes("paid")
                      ? "bg-emerald-400 text-black"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  <FaWallet />
                </div>
                <div>
                  <p className="font-black">Payment Status</p>
                  <p className="text-sm text-slate-400">
                    {prettyStatus(order?.payment_status)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    normalizeStatus(order?.status).includes("delivered") ||
                    normalizeStatus(order?.status).includes("completed")
                      ? "bg-blue-400 text-black"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  <FaTruck />
                </div>
                <div>
                  <p className="font-black">Seller Delivery</p>
                  <p className="text-sm text-slate-400">
                    {normalizeStatus(order?.status).includes("delivered") ||
                    normalizeStatus(order?.status).includes("completed")
                      ? "Seller has marked this order as delivered."
                      : "Waiting for seller delivery."}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    normalizeStatus(order?.status).includes("completed")
                      ? "bg-emerald-400 text-black"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  <FaCheckCircle />
                </div>
                <div>
                  <p className="font-black">Completed</p>
                  <p className="text-sm text-slate-400">
                    {normalizeStatus(order?.status).includes("completed")
                      ? "Order completed successfully."
                      : "Buyer confirmation is still pending."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h3 className="text-xl font-black">Actions</h3>

            <div className="mt-5 space-y-3">
              {normalizeStatus(order?.payment_status) !== "paid" &&
              !normalizeStatus(order?.status).includes("paid") ? (
                <Link
                  href={`/payment/${order?.id}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300"
                >
                  <FaCreditCard />
                  Pay Now
                </Link>
              ) : null}

              {isSeller &&
              !normalizeStatus(order?.status).includes("delivered") &&
              !normalizeStatus(order?.status).includes("completed") ? (
                <button
                  onClick={() => updateOrderStatus("delivered")}
                  disabled={updating === "delivered"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-400 px-5 py-4 font-black text-black hover:bg-blue-300 disabled:opacity-60"
                >
                  <FaTruck />
                  {updating === "delivered" ? "Updating..." : "Mark Delivered"}
                </button>
              ) : null}

              {isBuyer &&
              normalizeStatus(order?.status).includes("delivered") &&
              !normalizeStatus(order?.status).includes("completed") ? (
                <button
                  onClick={() => updateOrderStatus("completed")}
                  disabled={updating === "completed"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-4 font-black text-black hover:bg-emerald-300 disabled:opacity-60"
                >
                  <FaCheckCircle />
                  {updating === "completed"
                    ? "Updating..."
                    : "Confirm Received"}
                </button>
              ) : null}

              <Link
                href={`/messages?seller=${order?.seller_id || ""}&product=${
                  order?.product_id || ""
                }&order=${order?.id || ""}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-black text-white hover:border-cyan-400"
              >
                <FaComments />
                Chat
              </Link>

              {product?.id ? (
                <Link
                  href={`/product/${product.id}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-black text-white hover:border-cyan-400"
                >
                  <FaShoppingBag />
                  Product Page
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="text-xl font-black">Order Info</h3>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Order ID</span>
                <span className="font-bold">#{order?.id}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Order Status</span>
                <span className="font-bold text-cyan-300">
                  {prettyStatus(order?.status)}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Payment</span>
                <span className="font-bold text-emerald-300">
                  {prettyStatus(order?.payment_status)}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Quantity</span>
                <span className="font-bold">{quantity}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Total</span>
                <span className="font-bold text-cyan-300">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
            <h3 className="flex items-center gap-2 text-xl font-black text-emerald-200">
              <FaShieldAlt />
              Buyer Protection
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Complete all delivery and communication inside ComePlayers. Never
              confirm received before the seller has delivered the product.
            </p>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
            <h3 className="flex items-center gap-2 text-xl font-black text-yellow-200">
              <FaExclamationTriangle />
              Important
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              If something is wrong with the order, contact the seller first. A
              dispute system can be added in the next version.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}