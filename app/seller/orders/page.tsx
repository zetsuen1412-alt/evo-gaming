"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaClock,
  FaCreditCard,
  FaEye,
  FaFilter,
  FaReceipt,
  FaSearch,
  FaShoppingBag,
  FaStore,
  FaWallet,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
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
  game_name?: string | null;
  category?: string | null;
};

type ProductMap = Record<number, Product>;

const FILTERS = [
  { label: "All Orders", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Waiting Payment", value: "waiting_payment" },
  { label: "Paid", value: "paid" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}


function getOrderTotal(order: Order, product?: Product | null) {
  return (
    numberPrice(order.total_amount) ||
    numberPrice(order.total_price) ||
    numberPrice(order.price) ||
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

export default function SellerOrdersPage() {
  const { formatPrice, currency } = useCurrency();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadSellerOrders() {
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;

    if (!currentUser) {
      setSellerId(null);
      setOrders([]);
      setProducts({});
      setLoading(false);
      return;
    }

    setSellerId(currentUser.id);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("seller_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      setError(orderError.message);
      setOrders([]);
      setProducts({});
      setLoading(false);
      return;
    }

    const safeOrders = orderData || [];
    setOrders(safeOrders);

    const productIds = Array.from(
      new Set(
        safeOrders
          .map((order) => order.product_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    if (productIds.length > 0) {
      const { data: productData } = await supabase
        .from("products")
        .select(`
          id,
          title,
          image_url,
          price,
          game_name,
          category
        `)
        .in("id", productIds);

      const map: ProductMap = {};

      (productData || []).forEach((product) => {
        map[product.id] = product;
      });

      setProducts(map);
    } else {
      setProducts({});
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSellerOrders();
  }, []);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const pending = orders.filter((order) =>
      normalizeStatus(order.status).includes("pending")
    ).length;
    const paid = orders.filter(
      (order) =>
        normalizeStatus(order.status).includes("paid") ||
        normalizeStatus(order.payment_status).includes("paid")
    ).length;
    const completed = orders.filter((order) =>
      normalizeStatus(order.status).includes("completed")
    ).length;
    const revenue = orders.reduce((sum, order) => {
      const product = order.product_id ? products[order.product_id] : null;
      const isPaid =
        normalizeStatus(order.status).includes("paid") ||
        normalizeStatus(order.payment_status).includes("paid") ||
        normalizeStatus(order.status).includes("completed");

      return isPaid ? sum + getOrderTotal(order, product) : sum;
    }, 0);

    return {
      totalOrders,
      pending,
      paid,
      completed,
      revenue,
    };
  }, [orders, products]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (filter !== "all") {
      list = list.filter((order) => {
        const orderStatus = normalizeStatus(order.status);
        const paymentStatus = normalizeStatus(order.payment_status);

        return orderStatus === filter || paymentStatus === filter;
      });
    }

    if (query.trim()) {
      const q = query.toLowerCase();

      list = list.filter((order) => {
        const product = order.product_id ? products[order.product_id] : null;

        return `${order.id} ${order.product || ""} ${order.product_title || ""} ${
          product?.title || ""
        } ${order.game_name || ""} ${product?.game_name || ""} ${
          order.buyer || ""
        } ${order.buyer_id || ""}`
          .toLowerCase()
          .includes(q);
      });
    }

    return list;
  }, [orders, products, filter, query]);

  async function markCompleted(orderId: number) {
    setUpdatingId(orderId);
    setError("");

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "completed",
      })
      .eq("id", orderId);

    if (updateError) {
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    await loadSellerOrders();
    setUpdatingId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading seller orders...
      </main>
    );
  }

  if (!sellerId) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <section className="mx-auto max-w-4xl px-4 py-24 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
            <FaStore className="text-4xl text-cyan-300" />
          </div>

          <h1 className="mt-8 text-5xl font-black">Seller Orders</h1>

          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Please login as seller to view incoming marketplace orders.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-4 font-black text-black hover:bg-cyan-300"
          >
            Back Home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2 text-sm font-black text-cyan-200">
            Seller Center
          </div>

          <h1 className="mt-8 text-5xl font-black">Seller Orders</h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Manage incoming orders, track payments, deliver products, and update
            completion status.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <FaReceipt className="text-3xl text-cyan-300" />
            <p className="mt-4 text-sm text-slate-400">Total Orders</p>
            <p className="mt-1 text-3xl font-black">{stats.totalOrders}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <FaClock className="text-3xl text-yellow-300" />
            <p className="mt-4 text-sm text-slate-400">Pending</p>
            <p className="mt-1 text-3xl font-black">{stats.pending}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <FaCreditCard className="text-3xl text-cyan-300" />
            <p className="mt-4 text-sm text-slate-400">Paid</p>
            <p className="mt-1 text-3xl font-black">{stats.paid}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <FaCheckCircle className="text-3xl text-emerald-300" />
            <p className="mt-4 text-sm text-slate-400">Completed</p>
            <p className="mt-1 text-3xl font-black">{stats.completed}</p>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <FaWallet className="text-3xl text-cyan-300" />
            <p className="mt-4 text-sm text-slate-300">Revenue</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">
              {formatPrice(stats.revenue)}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by order, product, buyer, or game..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-11 py-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {FILTERS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                  className="bg-[#050816]"
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
            <FaFilter className="text-cyan-300" />
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <FaShoppingBag className="mx-auto text-5xl text-cyan-300" />

              <h2 className="mt-6 text-3xl font-black">No seller orders yet</h2>

              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Incoming buyer orders for your products will appear here.
              </p>

              <Link
                href="/seller/products"
                className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-4 font-black text-black hover:bg-cyan-300"
              >
                Manage Products
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-white/10 bg-black/30 text-sm text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Buyer</th>
                    <th className="px-5 py-4">Game</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => {
                    const product =
                      order.product_id ? products[order.product_id] : null;
                    const title =
                      order.product_title ||
                      order.product ||
                      product?.title ||
                      "Product";
                    const buyer = order.buyer || order.buyer_id || "-";
                    const game = order.game_name || product?.game_name || "-";
                    const total = getOrderTotal(order, product);

                    return (
                      <tr
                        key={order.id}
                        className="border-b border-white/10 align-top transition hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-5">
                          <p className="font-black">#{order.id}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Qty: {order.quantity || 1}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-14 w-14 rounded-xl bg-cover bg-center"
                              style={{
                                backgroundImage: `url(${
                                  product?.image_url || fallbackImage(title)
                                })`,
                              }}
                            />

                            <div>
                              <p className="line-clamp-2 font-bold">{title}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {order.category || product?.category || "Game Product"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <p className="max-w-[180px] truncate text-sm text-slate-300">
                            {buyer}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="max-w-[160px] truncate text-sm text-slate-300">
                            {game}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="font-black text-cyan-300">
                            {formatPrice(total)}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                                order.status
                              )}`}
                            >
                              {prettyStatus(order.status)}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyle(
                                order.payment_status
                              )}`}
                            >
                              Pay: {prettyStatus(order.payment_status)}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <p className="text-sm text-slate-400">
                            {formatDate(order.created_at)}
                          </p>
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/order-success/${order.id}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-cyan-300 hover:border-cyan-400"
                              title="View Order"
                            >
                              <FaEye />
                            </Link>

                            {!normalizeStatus(order.status).includes("completed") ? (
                              <button
                                onClick={() => markCompleted(order.id)}
                                disabled={updatingId === order.id}
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60"
                              >
                                {updatingId === order.id
                                  ? "Updating..."
                                  : "Complete"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}