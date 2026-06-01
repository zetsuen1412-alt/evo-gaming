"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const orderStatuses = [
  "all",
  "Pending Payment",
  "Payment Verification",
  "Processing",
  "Completed",
  "Cancelled",
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
    return "bg-green-400/10 text-green-300";
  }

  if (normalizedStatus === "Processing") {
    return "bg-blue-400/10 text-blue-300";
  }

  if (normalizedStatus === "Cancelled") {
    return "bg-red-400/10 text-red-300";
  }

  if (normalizedStatus === "Payment Verification") {
    return "bg-yellow-400/10 text-yellow-300";
  }

  return "bg-cyan-400/10 text-cyan-300";
}

export default function MyOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");

  useEffect(() => {
    async function loadOrders() {
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
        .eq("buyer", userData.user.email)
        .order("id", { ascending: false });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setOrders(data || []);
      setLoading(false);
    }

    loadOrders();
  }, []);

  const filteredOrders =
    activeStatus === "all"
      ? orders
      : orders.filter((order) => normalizeStatus(order.status) === activeStatus);

  const pendingPaymentCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Pending Payment"
  ).length;

  const processingCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Processing"
  ).length;

  const completedCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Completed"
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading your orders...
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
            Please login first to view your orders.
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

        <Link
          href="/"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Home
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Buyer Dashboard
          </p>

          <h1 className="text-5xl font-black md:text-7xl">My Orders</h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Track your purchases, payment status, and order progress in one
            place.
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Logged in as {user.email}
          </p>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total Orders</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Pending Payment</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {pendingPaymentCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Processing</p>
            <p className="mt-2 text-3xl font-black text-blue-300">
              {processingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Completed</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {completedCount}
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {orderStatuses.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition ${
                activeStatus === status
                  ? "bg-cyan-400 text-black"
                  : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : status}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
            <h2 className="text-3xl font-black">No orders found.</h2>

            <p className="mt-3 text-gray-400">
              You do not have any orders with this status yet.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => {
              const normalizedStatus = normalizeStatus(order.status);
              const canReview = normalizedStatus === "Completed";

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="flex flex-col justify-between gap-6 lg:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">
                          {order.product || "Unknown Product"}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {normalizedStatus}
                        </span>
                      </div>

                      <p className="mt-3 text-2xl font-black text-cyan-300">
                        {order.price}
                      </p>

                      <p className="mt-3 text-sm text-gray-400">
                        Order ID: #{order.id}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Created:{" "}
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString()
                          : "-"}
                      </p>

                      {order.payment_proof && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-sm font-bold text-cyan-300">
                            Order Notes
                          </p>

                          <p className="mt-2 text-sm text-gray-300">
                            {order.payment_proof}
                          </p>
                        </div>
                      )}

                      {order.payment_image && (
                        <div className="mt-5">
                          <p className="mb-3 font-bold text-cyan-300">
                            Payment Proof
                          </p>

                          <a
                            href={order.payment_image}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={order.payment_image}
                              alt="Payment Proof"
                              className="h-32 w-56 rounded-xl border border-white/10 object-cover transition hover:scale-105"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-[220px] flex-col gap-3">
                      {normalizedStatus === "Pending Payment" && (
                        <Link
                          href="/payment"
                          className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-black hover:bg-cyan-300"
                        >
                          Continue Payment
                        </Link>
                      )}

                      <Link
                        href={`/order-detail/${order.id}`}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-center font-black text-white hover:bg-white hover:text-black"
                      >
                        View Details
                      </Link>

                      {canReview && (
                        <Link
                          href={`/review/${order.id}`}
                          className="rounded-2xl bg-yellow-400 px-5 py-3 text-center font-black text-black hover:bg-yellow-300"
                        >
                          Leave Review
                        </Link>
                      )}

                      <button
                        onClick={() =>
                          alert("Support chat will be connected later.")
                        }
                        className="rounded-2xl border border-cyan-400/40 px-5 py-3 font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
                      >
                        Contact Support
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}