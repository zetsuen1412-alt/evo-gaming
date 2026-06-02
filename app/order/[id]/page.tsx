"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  buyer_id: string | null;
  buyer: string | null;
  seller_id: string | null;
  product_id: number | null;

  product: string | null;
  price: string | number | null;
  quantity: number | null;
  total_price: string | number | null;

  category_id: number | null;
  category_name: string | null;
  game_master_id: number | null;
  game_name: string | null;

  status: string | null;
  payment_proof: string | null;
  payment_image: string | null;
  created_at: string;
};

type Product = {
  id: number;
  title: string;
  image_url: string | null;
  seller_name: string | null;
};

type SellerProfile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_name: string | null;
  seller_status: string | null;
  avatar_url: string | null;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
};

function normalizeStatus(status: string | null) {
  if (status === "pending") return "Pending Payment";
  if (status === "pending_payment") return "Pending Payment";
  if (status === "Menunggu Pembayaran") return "Pending Payment";
  if (status === "Menunggu Cek Pembayaran") return "Payment Verification";
  if (status === "Diproses") return "Processing";
  if (status === "Selesai") return "Completed";
  if (status === "Dibatalkan") return "Cancelled";
  return status || "Pending Payment";
}

function getStatusClass(status: string | null) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "Completed") {
    return "border-green-400/20 bg-green-400/10 text-green-300";
  }

  if (normalizedStatus === "Processing") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  }

  if (normalizedStatus === "Cancelled") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  if (normalizedStatus === "Payment Verification") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  }

  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
}

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);

  if (!Number.isFinite(price)) {
    return "Rp 0";
  }

  return `Rp ${price.toLocaleString("id-ID")}`;
}

export default function OrderDetailV2Page() {
  const params = useParams();
  const orderId = String(params.id || "");

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null
  );
  const [gameMaster, setGameMaster] = useState<GameMaster | null>(null);

  const normalizedStatus = useMemo(() => {
    return normalizeStatus(order?.status || null);
  }, [order]);

  const totalAmount = useMemo(() => {
    return Number(order?.total_price || order?.price || 0);
  }, [order]);

  const displayImage = useMemo(() => {
    return product?.image_url || gameMaster?.image_url || null;
  }, [product, gameMaster]);

  const sellerDisplayName = useMemo(() => {
    return (
      sellerProfile?.seller_name ||
      sellerProfile?.username ||
      product?.seller_name ||
      order?.seller_id ||
      "Unknown Seller"
    );
  }, [sellerProfile, product, order]);

  const canPay = useMemo(() => {
    return (
      normalizedStatus === "Pending Payment" ||
      normalizedStatus === "Payment Verification"
    );
  }, [normalizedStatus]);

  const canReview = useMemo(() => {
    return normalizedStatus === "Completed";
  }, [normalizedStatus]);

  useEffect(() => {
    if (orderId) {
      initializePage();
    }
  }, [orderId]);

  async function initializePage() {
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setLoading(false);
      return;
    }

    if (!userData.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(userData.user);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", Number(orderId))
      .maybeSingle();

    if (orderError) {
      alert(orderError.message);
      setLoading(false);
      return;
    }

    if (!orderData) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const isBuyer =
      orderData.buyer_id === userData.user.id ||
      orderData.buyer === userData.user.email;

    const isSeller = orderData.seller_id === userData.user.id;

    if (!isBuyer && !isSeller) {
      alert("You are not allowed to access this order.");
      window.location.href = "/my-orders";
      return;
    }

    setOrder(orderData);

    if (orderData.product_id) {
      const { data: productData } = await supabase
        .from("products")
        .select("id,title,image_url,seller_name")
        .eq("id", orderData.product_id)
        .maybeSingle();

      setProduct(productData || null);
    }

    if (orderData.seller_id) {
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("id,email,username,seller_name,seller_status,avatar_url")
        .eq("id", orderData.seller_id)
        .maybeSingle();

      setSellerProfile(sellerData || null);
    }

    if (orderData.game_master_id) {
      const { data: gameData } = await supabase
        .from("game_master")
        .select("id,name,slug,image_url")
        .eq("id", orderData.game_master_id)
        .maybeSingle();

      setGameMaster(gameData || null);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading order detail...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Login Required
          </h1>

          <p className="mt-4 text-gray-400">
            Please login first to view this order.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Order Not Found</h1>

          <p className="mt-4 text-gray-300">
            This order does not exist or has been removed.
          </p>

          <Link
            href="/my-orders"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Open My Orders
          </Link>
        </div>
      </main>
    );
  }

  const isSeller = order.seller_id === user.id;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Order Detail
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Order #{order.id}
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Track payment, seller verification, and delivery progress for this
              order.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${getStatusClass(
                  order.status
                )}`}
              >
                {normalizedStatus}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                {order.category_name || "Marketplace"} /{" "}
                {order.game_name || gameMaster?.name || "Game"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={isSeller ? "/seller/orders" : "/my-orders"}
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              {isSeller ? "Seller Orders" : "My Orders"}
            </Link>

            {order.product_id && (
              <Link
                href={`/product/${order.product_id}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
              >
                View Product
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
            <div className="flex h-72 items-center justify-center bg-black">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={order.product || "Order product"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-7xl">🎮</span>
              )}
            </div>

            <div className="p-7">
              <p className="text-sm font-black text-cyan-300">
                {order.category_name || "Marketplace"} /{" "}
                {order.game_name || gameMaster?.name || "Game"}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {order.product || product?.title || "Unknown Product"}
              </h2>

              <p className="mt-4 text-4xl font-black text-cyan-300">
                {formatPrice(totalAmount)}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Quantity</p>
                  <p className="mt-1 font-bold">{order.quantity || 1}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Buyer</p>
                  <p className="mt-1 break-words font-bold">
                    {order.buyer || order.buyer_id || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Seller</p>
                  <p className="mt-1 break-words font-bold">
                    {sellerDisplayName}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="mt-1 font-bold">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString()
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {order.payment_proof && (
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black text-cyan-300">
                Payment Details
              </h2>

              <p className="mt-5 whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-gray-300">
                {order.payment_proof}
              </p>
            </div>
          )}

          {order.payment_image && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black">Payment Proof Image</h2>

              <a
                href={order.payment_image}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <img
                  src={order.payment_image}
                  alt="Payment Proof"
                  className="max-h-[520px] w-full object-contain"
                />
              </a>
            </div>
          )}
        </div>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Order Status</h2>

            <div
              className={`mt-5 rounded-2xl border p-5 ${getStatusClass(
                order.status
              )}`}
            >
              <p className="text-2xl font-black">{normalizedStatus}</p>
            </div>

            <div className="mt-6 space-y-4">
              <div
                className={`rounded-2xl border p-4 ${
                  [
                    "Pending Payment",
                    "Payment Verification",
                    "Processing",
                    "Completed",
                  ].includes(normalizedStatus)
                    ? "border-cyan-400/20 bg-cyan-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-cyan-300">1. Order Created</p>
                <p className="mt-1 text-sm text-gray-400">
                  Buyer created checkout order.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  ["Payment Verification", "Processing", "Completed"].includes(
                    normalizedStatus
                  )
                    ? "border-yellow-400/20 bg-yellow-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-yellow-300">
                  2. Payment Submitted
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Buyer submitted payment proof.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  ["Processing", "Completed"].includes(normalizedStatus)
                    ? "border-blue-400/20 bg-blue-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-blue-300">3. Processing</p>
                <p className="mt-1 text-sm text-gray-400">
                  Seller is processing the order.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  normalizedStatus === "Completed"
                    ? "border-green-400/20 bg-green-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-green-300">4. Completed</p>
                <p className="mt-1 text-sm text-gray-400">
                  Order has been completed.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
            <h2 className="text-2xl font-black">Actions</h2>

            <div className="mt-5 grid gap-3">
              {canPay && !isSeller && (
                <Link
                  href={`/payment?order=${order.id}`}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-black transition hover:bg-cyan-300"
                >
                  Continue Payment
                </Link>
              )}

              {canReview && !isSeller && (
                <Link
                  href={`/review/${order.id}`}
                  className="rounded-2xl bg-yellow-400 px-5 py-3 text-center font-black text-black transition hover:bg-yellow-300"
                >
                  Leave Review
                </Link>
              )}

              {order.seller_id && (
                <Link
                  href={`/seller-profile/${order.seller_id}`}
                  className="rounded-2xl border border-cyan-400 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                >
                  View Seller Profile
                </Link>
              )}

              <button
                onClick={() => alert("Support chat will be connected later.")}
                className="rounded-2xl border border-white/10 px-5 py-3 font-black text-gray-300 transition hover:bg-white hover:text-black"
              >
                Contact Support
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7">
            <h2 className="text-xl font-black text-yellow-300">
              Buyer Protection
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Keep every transaction inside ComePlayers. Do not send payments or
              delivery information outside the platform.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}