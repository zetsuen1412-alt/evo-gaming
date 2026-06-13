"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FaBoxOpen,
  FaClock,
  FaCreditCard,
  FaFilter,
  FaReceipt,
  FaSearch,
  FaShieldAlt,
  FaShoppingBag,
  FaStore,
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
  game_name?: string | null;
  category?: string | null;
  seller_name?: string | null;
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

function formatPrice(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberPrice(value));
}

function getOrderTotal(order: Order, product?: Product | null) {
  return (
    numberPrice(order.total_amount) ||
    numberPrice(order.total_price) ||
    numberPrice(order.price) ||
    numberPrice(product?.price)
  );
}

function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "Order"
  )}`;
}

function normalizeStatus(value?: string | null) {
  return String(value || "pending").toLowerCase();
}

function statusStyle(status?: string | null) {
  const value = normalizeStatus(status);

  if (value.includes("complete")) {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (value.includes("paid")) {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-300";
  }

  if (value.includes("waiting")) {
    return "border-yellow-400/40 bg-yellow-400/10 text-yellow-300";
  }

  if (value.includes("cancel")) {
    return "border-red-400/40 bg-red-400/10 text-red-300";
  }

  return "border-slate-400/30 bg-slate-400/10 text-slate-300";
}

function prettyStatus(status?: string | null) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError("");

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;

      if (!currentUser) {
        setUserId(null);
        setOrders([]);
        setProducts({});
        setLoading(false);
        return;
      }

      setUserId(currentUser.id);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .or(`buyer_id.eq.${currentUser.id},buyer.eq.${currentUser.email}`)
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
            category,
            seller_name
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

    loadOrders();
  }, []);

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
          order.seller_name || ""
        } ${product?.seller_name || ""}`
          .toLowerCase()
          .includes(q);
      });
    }

    return list;
  }, [orders, products, filter, query]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading your orders...
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <section className="mx-auto max-w-4xl px-4 py-24 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
            <FaShoppingBag className="text-4xl text-cyan-300" />
          </div>

          <h1 className="mt-8 text-5xl font-black">My Orders</h1>

          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Please login to view your purchases and marketplace order history.
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
            Purchase Center
          </div>

          <h1 className="mt-8 text-5xl font-black">My Orders</h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Track your purchases, payment status, seller delivery, and order
            history inside ComePlayers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by order, product, seller, or game..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-11 py-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-white outline-none focus:border-cyan-400"
            >
              {FILTERS.map((item) => (
                <option key={item.value} value={item.value} className="bg-[#050816]">
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

        <div className="mt-8 space-y-5">
          {filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
              <FaBoxOpen className="mx-auto text-5xl text-cyan-300" />

              <h2 className="mt-6 text-3xl font-black">No orders found</h2>

              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Your orders will appear here after you buy a product from
                ComePlayers marketplace.
              </p>

              <Link
                href="/games"
                className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-4 font-black text-black hover:bg-cyan-300"
              >
                Browse Games
              </Link>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const product = order.product_id ? products[order.product_id] : null;
              const title =
                order.product_title || order.product || product?.title || "Product";
              const seller =
                order.seller_name || product?.seller_name || "Verified Seller";
              const game = order.game_name || product?.game_name || "-";
              const category = order.category || product?.category || "Game Product";
              const total = getOrderTotal(order, product);
              const image = product?.image_url || fallbackImage(title);

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:border-cyan-400/50"
                >
                  <div className="grid gap-0 lg:grid-cols-[260px_1fr_260px]">
                    <div
                      className="min-h-56 bg-cover bg-center"
                      style={{ backgroundImage: `url(${image})` }}
                    />

                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-4 py-1 text-xs font-black ${statusStyle(
                            order.status
                          )}`}
                        >
                          {prettyStatus(order.status)}
                        </span>

                        <span
                          className={`rounded-full border px-4 py-1 text-xs font-black ${statusStyle(
                            order.payment_status
                          )}`}
                        >
                          Payment: {prettyStatus(order.payment_status)}
                        </span>
                      </div>

                      <h2 className="mt-4 text-2xl font-black">{title}</h2>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                          {category}
                        </span>

                        <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                          {game}
                        </span>

                        <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                          Qty: {order.quantity || 1}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <FaReceipt className="text-cyan-300" />
                          Order #{order.id}
                        </p>

                        <p className="flex items-center gap-2">
                          <FaStore className="text-cyan-300" />
                          {seller}
                        </p>

                        <p className="flex items-center gap-2">
                          <FaClock className="text-yellow-300" />
                          {formatDate(order.created_at)}
                        </p>

                        <p className="flex items-center gap-2">
                          <FaShieldAlt className="text-emerald-300" />
                          Protected transaction
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-white/10 p-6 lg:border-l lg:border-t-0">
                      <p className="text-sm text-slate-400">Total</p>
                      <p className="mt-2 text-3xl font-black text-cyan-300">
                        {formatPrice(total)}
                      </p>

                      <div className="mt-6 space-y-3">
                        <Link
                          href={`/order-success/${order.id}`}
                          className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-black text-black hover:bg-cyan-300"
                        >
                          <FaReceipt />
                          View Order
                        </Link>

                        {product?.id ? (
                          <Link
                            href={`/product/${product.id}`}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-black text-white hover:border-cyan-400"
                          >
                            <FaShoppingBag />
                            Product
                          </Link>
                        ) : null}

                        {normalizeStatus(order.payment_status) !== "paid" &&
                        normalizeStatus(order.status) !== "paid" ? (
                          <Link
                            href={`/payment/${order.id}`}
                            className="flex items-center justify-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-5 py-3 font-black text-yellow-200 hover:bg-yellow-400 hover:text-black"
                          >
                            <FaCreditCard />
                            Pay Now
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}