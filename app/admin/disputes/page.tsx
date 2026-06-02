"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
};

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

const statusOptions = [
  "Disputed",
  "Payment Verification",
  "Processing",
  "Completed",
  "Refunded",
  "Cancelled",
];

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

  if (normalizedStatus === "Refunded") {
    return "border-purple-400/20 bg-purple-400/10 text-purple-300";
  }

  if (normalizedStatus === "Cancelled") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  if (normalizedStatus === "Disputed") {
    return "border-orange-400/20 bg-orange-400/10 text-orange-300";
  }

  return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
}

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

export default function DisputeCenterV1Page() {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const isAdmin = adminProfile?.role?.trim().toLowerCase() === "admin";

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        String(order.id).includes(query) ||
        (order.product || "").toLowerCase().includes(query) ||
        (order.buyer || "").toLowerCase().includes(query) ||
        (order.buyer_id || "").toLowerCase().includes(query) ||
        (order.seller_id || "").toLowerCase().includes(query) ||
        (order.category_name || "").toLowerCase().includes(query) ||
        (order.game_name || "").toLowerCase().includes(query);

      return matchesSearch;
    });
  }, [orders, search]);

  const totalDisputes = orders.length;

  const disputedValue = orders.reduce(
    (sum, order) => sum + Number(order.total_price || order.price || 0),
    0
  );

  async function loadDisputes() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "Disputed")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(data || []);
  }

  useEffect(() => {
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

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,username,role")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        setLoading(false);
        return;
      }

      setAdminProfile(profileData || null);

      if (profileData?.role?.trim().toLowerCase() === "admin") {
        await loadDisputes();
      }

      setLoading(false);
    }

    initializePage();
  }, []);

  async function updateOrderStatus(orderId: number, newStatus: string) {
    if (!isAdmin) return;

    setUpdatingOrderId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      setUpdatingOrderId(null);
      return;
    }

    await loadDisputes();
    setUpdatingOrderId(null);
  }

  async function resolveToProcessing(orderId: number) {
    if (!confirm("Move this dispute back to Processing?")) return;
    await updateOrderStatus(orderId, "Processing");
  }

  async function resolveToCompleted(orderId: number) {
    if (!confirm("Resolve this dispute as Completed?")) return;
    await updateOrderStatus(orderId, "Completed");
  }

  async function resolveToRefunded(orderId: number) {
    if (!confirm("Resolve this dispute as Refunded?")) return;
    await updateOrderStatus(orderId, "Refunded");
  }

  async function resolveToCancelled(orderId: number) {
    if (!confirm("Resolve this dispute as Cancelled?")) return;
    await updateOrderStatus(orderId, "Cancelled");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading dispute center...
        </p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Access Denied</h1>

          <p className="mt-4 text-gray-300">
            Only admin accounts can access dispute center.
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

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-300">
              Admin Dispute Center
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Disputes</h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Review disputed transactions, check payment evidence, and resolve
              marketplace cases.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Logged in as {user.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex h-12 items-center justify-center rounded-full border border-orange-400 px-6 font-bold text-orange-300 transition hover:bg-orange-400 hover:text-black"
            >
              All Orders
            </Link>

            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Admin Home
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-orange-400/20 bg-orange-400/10 p-5">
            <p className="text-sm text-orange-200">Open Disputes</p>
            <p className="mt-2 text-4xl font-black text-orange-300">
              {totalDisputes}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Disputed Value</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {formatPrice(disputedValue)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Status Filter</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              Disputed
            </p>
          </div>
        </div>

        <div className="mb-8">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID, buyer, seller, product, category, or game..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-orange-400"
          />
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
            <h2 className="text-3xl font-black">No disputed orders found.</h2>

            <p className="mt-3 text-gray-400">
              Disputed orders will appear here after admin or seller marks an
              order as Disputed.
            </p>

            <Link
              href="/admin/orders"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
            >
              Open All Orders
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => {
              const totalPrice = Number(order.total_price || order.price || 0);
              const normalizedStatus = normalizeStatus(order.status);

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-orange-400/20 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
                    <div>
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

                      <p className="mt-3 text-3xl font-black text-yellow-300">
                        {formatPrice(totalPrice)}
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Order ID</p>
                          <p className="mt-1 font-bold">#{order.id}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Buyer</p>
                          <p className="mt-1 break-words font-bold">
                            {order.buyer || order.buyer_id || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Seller ID</p>
                          <p className="mt-1 break-words font-bold">
                            {order.seller_id || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Product ID</p>
                          <p className="mt-1 font-bold">
                            {order.product_id || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Category</p>
                          <p className="mt-1 font-bold">
                            {order.category_name || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Game</p>
                          <p className="mt-1 font-bold">
                            {order.game_name || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="mt-1 font-bold">
                            {order.quantity || 1}
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

                      {order.payment_proof && (
                        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-sm font-black text-cyan-300">
                            Payment Details
                          </p>

                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-300">
                            {order.payment_proof}
                          </p>
                        </div>
                      )}

                      {order.payment_image && (
                        <div className="mt-5">
                          <p className="mb-3 font-bold text-orange-300">
                            Payment Proof Image
                          </p>

                          <a
                            href={order.payment_image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={order.payment_image}
                              alt="Payment Proof"
                              className="h-40 w-72 rounded-xl border border-orange-400/20 object-cover transition hover:scale-105"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-gray-400">
                        Resolve Status
                      </label>

                      <select
                        value={normalizedStatus}
                        onChange={(event) =>
                          updateOrderStatus(order.id, event.target.value)
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl border border-white/10 bg-black px-4 py-3 font-bold text-white outline-none focus:border-orange-400 disabled:opacity-60"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => resolveToProcessing(order.id)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-blue-500 px-5 py-3 font-black text-white hover:bg-blue-400 disabled:opacity-60"
                      >
                        Resolve to Processing
                      </button>

                      <button
                        onClick={() => resolveToCompleted(order.id)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-green-500 px-5 py-3 font-black text-white hover:bg-green-400 disabled:opacity-60"
                      >
                        Resolve Completed
                      </button>

                      <button
                        onClick={() => resolveToRefunded(order.id)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-purple-500 px-5 py-3 font-black text-white hover:bg-purple-400 disabled:opacity-60"
                      >
                        Resolve Refunded
                      </button>

                      <button
                        onClick={() => resolveToCancelled(order.id)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-red-500 px-5 py-3 font-black text-white hover:bg-red-400 disabled:opacity-60"
                      >
                        Resolve Cancelled
                      </button>

                      <Link
                        href={`/order/${order.id}`}
                        className="rounded-2xl border border-orange-400/40 px-5 py-3 text-center font-black text-orange-300 transition hover:bg-orange-400 hover:text-black"
                      >
                        View Order Detail
                      </Link>

                      {order.product_id && (
                        <Link
                          href={`/product/${order.product_id}`}
                          className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                        >
                          View Product
                        </Link>
                      )}

                      {order.seller_id && (
                        <Link
                          href={`/seller-profile/${order.seller_id}`}
                          className="rounded-2xl border border-white/10 px-5 py-3 text-center font-black text-gray-300 transition hover:bg-white hover:text-black"
                        >
                          View Seller
                        </Link>
                      )}

                      {updatingOrderId === order.id && (
                        <p className="text-center text-sm text-gray-400">
                          Updating dispute...
                        </p>
                      )}
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