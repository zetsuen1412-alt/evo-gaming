"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  created_at: string;
  product: string | null;
  buyer: string | null;
  price: string | number | null;
  status: string | null;
  payment_proof: string | null;
  payment_image: string | null;
  product_id: number | null;
  buyer_id: string | null;
  seller_id: string | null;
  quantity: number | null;
  total_price: string | number | null;
};

const statusFilters = [
  "all",
  "pending",
  "waiting_verification",
  "processing",
  "completed",
  "cancelled",
  "rejected",
];

function formatStatus(status: string | null) {
  if (!status) return "Pending";
  if (status === "pending") return "Pending Payment";
  if (status === "waiting_verification") return "Waiting Verification";
  if (status === "paid") return "Paid";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Rejected";
  return status;
}

function getStatusClass(status: string | null) {
  if (status === "completed") {
    return "border-green-400/20 bg-green-400/10 text-green-300";
  }

  if (status === "processing" || status === "paid") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  }

  if (status === "waiting_verification") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  }

  if (status === "cancelled" || status === "rejected") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
}


function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BuyerOrdersPage() {
  const { formatPrice, currency } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        alert(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData.session?.user) {
        window.location.href = "/";
        return;
      }

      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setOrders(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Load buyer orders error:", error);
      alert("Failed to load orders.");
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        activeStatus === "all" || order.status === activeStatus;

      const query = search.toLowerCase();

      const matchesSearch =
        !query ||
        String(order.id).includes(query) ||
        String(order.product || "").toLowerCase().includes(query) ||
        String(order.status || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, activeStatus, search]);

  const pendingCount = orders.filter((order) => order.status === "pending").length;

  const waitingCount = orders.filter(
    (order) => order.status === "waiting_verification"
  ).length;

  const processingCount = orders.filter(
    (order) => order.status === "processing" || order.status === "paid"
  ).length;

  const completedCount = orders.filter(
    (order) => order.status === "completed"
  ).length;

  const totalSpent = orders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + Number(order.total_price || order.price || 0), 0);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading your orders...
        </p>
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
              Buyer Center
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              My Orders
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Marketplace
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Buyer Orders
          </p>

          <h1 className="text-5xl font-black md:text-7xl">My Orders</h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Track your purchases, payment status, and order progress in one
            place.
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Logged in as {user?.email}
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
            <p className="text-sm text-gray-400">Pending</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Verification</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {waitingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Processing</p>
            <p className="mt-2 text-3xl font-black text-blue-300">
              {processingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total Spent</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {formatPrice(totalSpent)}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order ID, product, or status..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-3">
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  activeStatus === status
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {status === "all" ? "All" : formatStatus(status)}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center">
            <h2 className="text-3xl font-black">No Orders Found</h2>

            <p className="mt-3 text-gray-400">
              Your orders will appear here after you buy a product.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => {
              const orderPrice = order.total_price || order.price || 0;

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">
                          Order #{order.id}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {formatStatus(order.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-xl font-black">
                        {order.product || `Product #${order.product_id || "-"}`}
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Price</p>
                          <p className="mt-1 font-black text-cyan-300">
                            {formatPrice(orderPrice)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="mt-1 font-black">
                            {order.quantity || 1}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="mt-1 font-black">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>

                      {order.payment_image && (
                        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-sm font-black text-cyan-300">
                            Payment Proof Uploaded
                          </p>

                          <a
                            href={order.payment_image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm font-bold text-cyan-200 hover:text-white"
                          >
                            View Payment Proof
                          </a>
                        </div>
                      )}

                      {order.payment_proof && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Payment Notes</p>
                          <p className="mt-2 text-sm text-gray-300">
                            {order.payment_proof}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Link
                        href={`/order/${order.id}`}
                        className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-black hover:bg-cyan-300"
                      >
                        View Order
                      </Link>

                      {order.status === "pending" && (
                        <Link
                          href={`/order/${order.id}`}
                          className="rounded-2xl border border-yellow-400/40 px-5 py-3 text-center font-black text-yellow-300 hover:bg-yellow-400 hover:text-black"
                        >
                          Upload Payment
                        </Link>
                      )}

                      {order.product_id && (
                        <Link
                          href={`/product/${order.product_id}`}
                          className="rounded-2xl border border-white/10 px-5 py-3 text-center font-black text-gray-300 hover:bg-white hover:text-black"
                        >
                          View Product
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