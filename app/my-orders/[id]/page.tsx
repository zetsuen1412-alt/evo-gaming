"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  product: string | null;
  buyer: string | null;
  price: string | number | null;
  status: string | null;
  payment_proof: string | null;
  payment_image: string | null;
  seller_id: string | null;
  created_at: string;
};

const timelineSteps = [
  "Pending Payment",
  "Payment Verification",
  "Processing",
  "Completed",
];

function normalizeStatus(status: string | null) {
  if (status === "Menunggu Pembayaran") return "Pending Payment";
  if (status === "Menunggu Cek Pembayaran") return "Payment Verification";
  if (status === "Diproses") return "Processing";
  if (status === "Selesai") return "Completed";
  if (status === "Dibatalkan") return "Cancelled";
  return status || "Unknown";
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

function getStepState(orderStatus: string | null, step: string) {
  const normalizedStatus = normalizeStatus(orderStatus);

  if (normalizedStatus === "Cancelled") {
    return "cancelled";
  }

  const currentIndex = timelineSteps.indexOf(normalizedStatus);
  const stepIndex = timelineSteps.indexOf(step);

  if (currentIndex === -1 || stepIndex === -1) {
    return "pending";
  }

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "pending";
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = String(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrderDetail() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        alert(error.message);
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(data);
      setLoading(false);
    }

    if (orderId) {
      loadOrderDetail();
    }
  }, [orderId]);

  const normalizedStatus = normalizeStatus(order?.status || null);
  const isBuyer = user?.email && order?.buyer === user.email;
  const isSeller = user?.id && order?.seller_id === user.id;
  const canViewOrder = Boolean(isBuyer || isSeller);

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
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
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
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Order Not Found
          </h1>

          <p className="mt-4 text-gray-400">
            The order you are looking for does not exist.
          </p>

          <Link
            href="/my-orders"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to My Orders
          </Link>
        </div>
      </main>
    );
  }

  if (!canViewOrder) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">
            Access Denied
          </h1>

          <p className="mt-4 text-gray-300">
            You do not have permission to view this order.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <div className="hidden border-l border-white/10 pl-5 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Powered By
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              EvoGaming
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSeller ? (
            <Link
              href="/seller/orders"
              className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Seller Orders
            </Link>
          ) : (
            <Link
              href="/my-orders"
              className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              My Orders
            </Link>
          )}

          <Link
            href="/"
            className="hidden rounded-full border border-white/10 px-5 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black sm:block"
          >
            Home
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Order Tracking
          </p>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-black md:text-7xl">
                Order #{order.id}
              </h1>

              <p className="mt-5 max-w-2xl text-gray-300">
                Track your order status, payment verification, and delivery
                progress in real time.
              </p>
            </div>

            <span
              className={`w-fit rounded-full border px-5 py-3 text-sm font-black ${getStatusClass(
                order.status
              )}`}
            >
              {normalizedStatus}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-8 px-8 py-10 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Order Timeline</h2>

            {normalizedStatus === "Cancelled" ? (
              <div className="mt-7 rounded-2xl border border-red-400/20 bg-red-400/10 p-6">
                <h3 className="text-2xl font-black text-red-300">
                  Order Cancelled
                </h3>

                <p className="mt-3 text-gray-300">
                  This order has been cancelled. Please contact support if you
                  need help.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-5">
                {timelineSteps.map((step, index) => {
                  const state = getStepState(order.status, step);

                  return (
                    <div key={step} className="flex gap-5">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full border font-black ${
                            state === "done"
                              ? "border-green-400 bg-green-400 text-black"
                              : state === "current"
                              ? "border-cyan-400 bg-cyan-400 text-black shadow-lg shadow-cyan-500/30"
                              : "border-white/10 bg-white/[0.04] text-gray-500"
                          }`}
                        >
                          {state === "done" ? "✓" : index + 1}
                        </div>

                        {index !== timelineSteps.length - 1 && (
                          <div
                            className={`h-12 w-px ${
                              state === "done"
                                ? "bg-green-400"
                                : "bg-white/10"
                            }`}
                          />
                        )}
                      </div>

                      <div className="pt-2">
                        <h3
                          className={`text-xl font-black ${
                            state === "current"
                              ? "text-cyan-300"
                              : state === "done"
                              ? "text-green-300"
                              : "text-gray-400"
                          }`}
                        >
                          {step}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {step === "Pending Payment" &&
                            "Waiting for buyer payment."}
                          {step === "Payment Verification" &&
                            "Payment is being reviewed."}
                          {step === "Processing" &&
                            "Seller is processing the order."}
                          {step === "Completed" &&
                            "Order has been completed."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Order Notes</h2>

            {order.payment_proof ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="whitespace-pre-line text-gray-300">
                  {order.payment_proof}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-gray-500">
                No additional notes provided.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Payment Proof</h2>

            {order.payment_image ? (
              <a
                href={order.payment_image}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <img
                  src={order.payment_image}
                  alt="Payment Proof"
                  className="max-h-[420px] w-full object-contain"
                />
              </a>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
                <p className="text-gray-400">
                  No payment proof uploaded yet.
                </p>

                {isBuyer && normalizedStatus === "Pending Payment" && (
                  <Link
                    href="/payment"
                    className="mt-5 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
                  >
                    Continue Payment
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Order Summary</h2>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Product</p>
              <p className="mt-1 text-xl font-black">
                {order.product || "Unknown Product"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Price</p>
              <p className="mt-1 text-3xl font-black text-cyan-300">
                {order.price}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Buyer</p>
              <p className="mt-1 break-words font-bold">
                {order.buyer || "Unknown Buyer"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Created</p>
              <p className="mt-1 font-bold">
                {order.created_at
                  ? new Date(order.created_at).toLocaleString()
                  : "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-gray-400">Seller ID</p>
              <p className="mt-1 break-words text-xs text-gray-300">
                {order.seller_id || "-"}
              </p>
            </div>
          </div>

          <div className="mt-7 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <h3 className="font-black text-cyan-300">
              ComePlayers Protection
            </h3>

            <ul className="mt-4 grid gap-3 text-sm text-gray-300">
              <li>🔒 Secure transaction tracking</li>
              <li>⚡ Seller status updates</li>
              <li>🎧 Support available when needed</li>
            </ul>
          </div>

          {isBuyer && (
            <Link
              href="/my-orders"
              className="mt-7 block rounded-2xl bg-cyan-400 py-4 text-center font-black text-black hover:bg-cyan-300"
            >
              Back to My Orders
            </Link>
          )}

          {isSeller && (
            <Link
              href="/seller/orders"
              className="mt-7 block rounded-2xl bg-cyan-400 py-4 text-center font-black text-black hover:bg-cyan-300"
            >
              Back to Seller Orders
            </Link>
          )}
        </aside>
      </section>
    </main>
  );
}