"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SellerProfile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_name: string | null;
  seller_status: string | null;
};

type Product = {
  id: number;
  title: string | null;
  price: string | number | null;
  stock: number | null;
  status: string | null;
  created_at: string;
};

type Order = {
  id: number;
  product_id: number | null;
  product: string | null;
  total_price: number | string | null;
  price: string | null;
  status: string | null;
  created_at: string;
};

function money(value: string | number | null | undefined) {
  const amount = Number(String(value ?? 0).replace(/[^\d]/g, "") || 0);
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function SellerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,username,seller_name,seller_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        return;
      }

      if (!profile) {
        alert("Profile not found.");
        window.location.href = "/";
        return;
      }

      if (profile.seller_status !== "approved") {
        window.location.href = "/seller/apply";
        return;
      }

      setSeller(profile);

      const [productsResult, ordersResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,title,price,stock,status,created_at")
          .eq("seller_id", profile.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("orders")
          .select("id,product_id,product,total_price,price,status,created_at")
          .eq("seller_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);

      if (productsResult.error) {
        alert(productsResult.error.message);
        return;
      }

      if (ordersResult.error) {
        alert(ordersResult.error.message);
        return;
      }

      setProducts(productsResult.data || []);
      setOrders(ordersResult.data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load seller dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const activeProducts = products.filter(
      (product) => product.status === "active" && Number(product.stock || 0) > 0
    );

    const outOfStock = products.filter(
      (product) => Number(product.stock || 0) <= 0
    );

    const completedOrders = orders.filter(
      (order) => order.status === "completed"
    );

    const pendingOrders = orders.filter(
      (order) =>
        order.status !== "completed" &&
        order.status !== "cancelled" &&
        order.status !== "refunded"
    );

    const revenue = completedOrders.reduce((sum, order) => {
      return sum + Number(order.total_price || order.price || 0);
    }, 0);

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      outOfStock: outOfStock.length,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      revenue,
    };
  }, [orders, products]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] px-8 py-6 shadow-2xl shadow-cyan-500/10">
          <p className="text-lg font-black text-cyan-300">
            Loading seller dashboard...
          </p>
        </div>
      </main>
    );
  }

  const displayName = seller?.seller_name || seller?.username || "Seller";

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-6 py-12 md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,.16),transparent_36%)]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_580px] lg:items-center">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2 text-sm font-black text-cyan-300 shadow-lg shadow-cyan-500/10">
                <span>▥</span>
                Seller Dashboard
              </div>

              <h1 className="text-5xl font-black tracking-tight md:text-7xl">
                Welcome,{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                  {displayName}
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                Track your marketplace performance, orders, revenue, products,
                and seller activity from one clean dashboard.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/seller/products"
                className="group rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-cyan-400/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="rounded-2xl bg-blue-500/15 p-4 text-3xl">
                    📦
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-2 transition group-hover:bg-cyan-400 group-hover:text-black">
                    →
                  </span>
                </div>
                <h2 className="mt-6 text-xl font-black">My Products</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Manage your listed products.
                </p>
              </Link>

              <Link
                href="/seller/products/new"
                className="group rounded-3xl border border-cyan-400/20 bg-cyan-400/15 p-6 shadow-2xl shadow-cyan-500/10 transition hover:-translate-y-1 hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="rounded-2xl bg-cyan-400/20 p-4 text-3xl">
                    ＋
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-2 transition group-hover:bg-cyan-400 group-hover:text-black">
                    →
                  </span>
                </div>
                <h2 className="mt-6 text-xl font-black">Add Product</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Create a new product listing.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["💰", "Revenue", money(stats.revenue), "Total earnings", "text-cyan-300"],
            ["🛍️", "Orders", stats.totalOrders, "Total orders", "text-emerald-300"],
            ["📦", "Active Products", stats.activeProducts, "Currently live", "text-cyan-300"],
            ["⏱️", "Pending Orders", stats.pendingOrders, "Awaiting action", "text-yellow-300"],
          ].map(([icon, label, value, desc, color]) => (
            <div
              key={label}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20"
            >
              <div className="flex items-center gap-5">
                <div className="rounded-2xl bg-white/10 p-4 text-3xl">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">{label}</p>
                  <h2 className={`mt-2 text-4xl font-black ${color}`}>
                    {value}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Recent Orders</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest buyer activity for your products.
              </p>
            </div>

            <Link
              href="/seller/orders"
              className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-sm font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              View All Orders →
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-3xl">
                ▱
              </div>
              <p className="font-black text-white">No orders yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Orders will appear here once you start getting sales.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href="/seller/orders"
                  className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/50 hover:bg-cyan-400/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-black">
                        {order.product || `Order #${order.id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(order.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-black text-cyan-300">
                        {money(order.total_price || order.price)}
                      </p>
                      <p
                        className={`mt-1 text-xs font-black ${
                          order.status === "completed"
                            ? "text-emerald-300"
                            : "text-yellow-300"
                        }`}
                      >
                        {order.status || "pending"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
            <h2 className="text-2xl font-black">Seller Snapshot</h2>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              {[
                ["Total Products", stats.totalProducts, "text-white"],
                ["Completed Orders", stats.completedOrders, "text-emerald-300"],
                ["Out Of Stock", stats.outOfStock, "text-red-300"],
                ["Seller Status", seller?.seller_status || "approved", "text-cyan-300"],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-white/10 px-5 py-4 last:border-b-0"
                >
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`font-black ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
            <h2 className="text-2xl font-black">Tips to Grow Your Store</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["👤", "Complete Your Profile", "Add store description and logo to build trust."],
                ["🏷️", "List Quality Products", "Use clear titles, details, and images."],
                ["💬", "Respond Quickly", "Fast responses improve buyer satisfaction."],
                ["📣", "Promote Listings", "Share your products on social media."],
              ].map(([icon, title, desc]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="mb-4 text-3xl">{icon}</div>
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}