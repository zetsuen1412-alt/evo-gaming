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

const statusOptions = [
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
    return "bg-green-400/10 text-green-300 border-green-400/20";
  }

  if (normalizedStatus === "Processing") {
    return "bg-blue-400/10 text-blue-300 border-blue-400/20";
  }

  if (normalizedStatus === "Cancelled") {
    return "bg-red-400/10 text-red-300 border-red-400/20";
  }

  if (normalizedStatus === "Payment Verification") {
    return "bg-yellow-400/10 text-yellow-300 border-yellow-400/20";
  }

  return "bg-cyan-400/10 text-cyan-300 border-cyan-400/20";
}

export default function SellerOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  async function loadSellerOrders(userId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("seller_id", userId)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(data || []);
  }

  useEffect(() => {
    async function initializePage() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);
      await loadSellerOrders(userData.user.id);
      setLoading(false);
    }

    initializePage();
  }, []);

  async function updateOrderStatus(orderId: number, newStatus: string) {
    if (!user) return;

    setUpdatingOrderId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId)
      .eq("seller_id", user.id);

    if (error) {
      alert(error.message);
      setUpdatingOrderId(null);
      return;
    }

    await loadSellerOrders(user.id);
    setUpdatingOrderId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const filteredOrders = orders.filter((order) => {
    const normalizedStatus = normalizeStatus(order.status);

    const matchesStatus =
      activeStatus === "all" || normalizedStatus === activeStatus;

    const matchesSearch =
      (order.product || "").toLowerCase().includes(search.toLowerCase()) ||
      (order.buyer || "").toLowerCase().includes(search.toLowerCase()) ||
      String(order.id).includes(search);

    return matchesStatus && matchesSearch;
  });

  const pendingPaymentCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Pending Payment"
  ).length;

  const verificationCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Payment Verification"
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
          Loading seller orders...
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
            Please login first to manage seller orders.
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
          <Link
            href="/seller"
            className="hidden rounded-full border border-white/10 px-5 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black sm:block"
          >
            Products
          </Link>

          <Link
            href="/"
            className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Home
          </Link>

          <button
            onClick={handleLogout}
            className="hidden rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300 md:block"
          >
            Logout
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Seller Dashboard
          </p>

          <h1 className="text-5xl font-black md:text-7xl">Seller Orders</h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Manage incoming orders, verify payments, and update delivery status.
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Logged in as {user.email}
          </p>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total Orders</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Pending Payment</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {pendingPaymentCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Verification</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {verificationCount}
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

        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product, buyer, or order ID..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-3">
            {orderStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  activeStatus === status
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {status === "all" ? "All" : status}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
            <h2 className="text-3xl font-black">No seller orders found.</h2>

            <p className="mt-3 text-gray-400">
              Orders from buyers will appear here after checkout.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => {
              const normalizedStatus = normalizeStatus(order.status);

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="flex flex-col justify-between gap-6 xl:flex-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">
                          {order.product || "Unknown Product"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {normalizedStatus}
                        </span>
                      </div>

                      <p className="mt-3 text-2xl font-black text-cyan-300">
                        {order.price}
                      </p>

                      <div className="mt-4 grid gap-2 text-sm text-gray-400 md:grid-cols-2">
                        <p>Order ID: #{order.id}</p>
                        <p>Buyer: {order.buyer || "Unknown Buyer"}</p>
                        <p>
                          Created:{" "}
                          {order.created_at
                            ? new Date(order.created_at).toLocaleString()
                            : "-"}
                        </p>
                        <p>Seller ID: {order.seller_id || "-"}</p>
                      </div>

                      {order.payment_proof && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-sm font-bold text-cyan-300">
                            Order Notes
                          </p>

                          <p className="mt-2 whitespace-pre-line text-sm text-gray-300">
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
                              className="h-36 w-64 rounded-xl border border-white/10 object-cover transition hover:scale-105"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-[260px] flex-col gap-3">
                      <label className="text-sm font-bold text-gray-400">
                        Update Status
                      </label>

                      <select
                        value={normalizedStatus}
                        onChange={(event) =>
                          updateOrderStatus(order.id, event.target.value)
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl border border-white/10 bg-black px-4 py-3 font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "Payment Verification")
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
                      >
                        Mark Verification
                      </button>

                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "Processing")
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-blue-500 px-5 py-3 font-black text-white hover:bg-blue-400 disabled:opacity-60"
                      >
                        Mark Processing
                      </button>

                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "Completed")
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-green-500 px-5 py-3 font-black text-white hover:bg-green-400 disabled:opacity-60"
                      >
                        Mark Completed
                      </button>

                      <button
                        onClick={() =>
                          updateOrderStatus(order.id, "Cancelled")
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-red-500 px-5 py-3 font-black text-white hover:bg-red-400 disabled:opacity-60"
                      >
                        Cancel Order
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