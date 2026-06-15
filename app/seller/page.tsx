"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/components/CurrencyProvider";
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
  const { formatPrice, currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
  }

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

    const productOrderCount = new Map<number, number>();

    for (const order of completedOrders) {
      if (!order.product_id) continue;
      productOrderCount.set(
        order.product_id,
        (productOrderCount.get(order.product_id) || 0) + 1
      );
    }

    const bestProduct = products
      .map((product) => ({
        ...product,
        sold: productOrderCount.get(product.id) || 0,
      }))
      .sort((a, b) => b.sold - a.sold)[0];

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      outOfStock: outOfStock.length,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      revenue,
      bestProduct,
    };
  }, [orders, products]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Seller Dashboard
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Welcome, {seller?.seller_name || seller?.username || "Seller"}
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Track your marketplace performance, orders, revenue, products,
              and seller activity from one dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller/products"
              className="rounded-full border border-cyan-400 px-5 py-3 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              My Products
            </Link>

            <Link
              href="/seller/products/new"
              className="rounded-full bg-cyan-400 px-5 py-3 font-black text-black transition hover:bg-cyan-300"
            >
              Add Product
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-gray-400">Revenue</p>
            <h2 className="mt-3 text-3xl font-black text-cyan-300">
              {money(stats.revenue)}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-gray-400">Orders</p>
            <h2 className="mt-3 text-4xl font-black text-green-300">
              {stats.totalOrders}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-gray-400">Active Products</p>
            <h2 className="mt-3 text-4xl font-black text-cyan-300">
              {stats.activeProducts}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-bold text-gray-400">Pending Orders</p>
            <h2 className="mt-3 text-4xl font-black text-yellow-300">
              {stats.pendingOrders}
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Recent Orders</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Latest buyer activity for your products.
                </p>
              </div>

              <Link
                href="/seller/orders"
                className="rounded-xl border border-cyan-400/40 px-4 py-2 font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                View All
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-gray-400">
                No orders yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 6).map((order) => (
                  <Link
                    key={order.id}
                    href={`/seller/orders`}
                    className="block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-400"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {order.product || `Order #${order.id}`}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
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
                              ? "text-green-300"
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

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <h2 className="text-2xl font-black">Seller Snapshot</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400">Total Products</span>
                  <span className="font-black">{stats.totalProducts}</span>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400">Completed Orders</span>
                  <span className="font-black text-green-300">
                    {stats.completedOrders}
                  </span>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-gray-400">Out Of Stock</span>
                  <span className="font-black text-red-300">
                    {stats.outOfStock}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Seller Status</span>
                  <span className="font-black text-cyan-300">
                    {seller?.seller_status || "approved"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
              <h2 className="text-2xl font-black text-cyan-200">
                Best Selling Product
              </h2>

              {stats.bestProduct && stats.bestProduct.sold > 0 ? (
                <>
                  <p className="mt-4 text-xl font-black">
                    {stats.bestProduct.title}
                  </p>
                  <p className="mt-2 text-sm text-gray-300">
                    {stats.bestProduct.sold} completed orders
                  </p>
                </>
              ) : (
                <p className="mt-4 text-gray-300">
                  No completed sales yet. Keep improving your listings.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <h2 className="text-2xl font-black">Quick Actions</h2>

              <div className="mt-5 grid gap-3">
  <Link
    href="/seller/products"
    className="rounded-xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black"
  >
    Manage Products
  </Link>

  <Link
    href="/seller/orders"
    className="rounded-xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black"
  >
    Manage Orders
  </Link>

  <Link
    href="/seller/verification"
    className="rounded-xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black"
  >
    Verification Center
  </Link>

  <Link
    href="/seller/analytics"
    className="rounded-xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black"
  >
    View Analytics
  </Link>
</div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}