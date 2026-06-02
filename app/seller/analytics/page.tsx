"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_status: string | null;
  seller_name: string | null;
};

type Order = {
  id: number;
  product_id: number | null;
  product: string | null;
  price: string | number | null;
  total_price: string | number | null;
  status: string | null;
  created_at: string;
};

type Product = {
  id: number;
  title: string | null;
  price: string | number | null;
  status: string | null;
  stock: number | null;
};

type Review = {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
};

function normalizeStatus(status: string | null) {
  if (status === "Selesai") return "Completed";
  if (status === "Diproses") return "Processing";
  if (status === "Menunggu Cek Pembayaran") return "Payment Verification";
  if (status === "Menunggu Pembayaran") return "Pending Payment";
  return status || "Pending Payment";
}

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function getDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export default function SellerAnalyticsV1Page() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const sellerDisplayName =
    profile?.seller_name || profile?.username || user?.email || "Seller";

  const completedOrders = useMemo(
    () => orders.filter((order) => normalizeStatus(order.status) === "Completed"),
    [orders]
  );

  const totalRevenue = useMemo(
    () =>
      completedOrders.reduce(
        (sum, order) => sum + Number(order.total_price || order.price || 0),
        0
      ),
    [completedOrders]
  );

  const revenue7Days = useMemo(() => {
    const since = getDaysAgo(7).getTime();

    return completedOrders
      .filter((order) => new Date(order.created_at).getTime() >= since)
      .reduce(
        (sum, order) => sum + Number(order.total_price || order.price || 0),
        0
      );
  }, [completedOrders]);

  const revenue30Days = useMemo(() => {
    const since = getDaysAgo(30).getTime();

    return completedOrders
      .filter((order) => new Date(order.created_at).getTime() >= since)
      .reduce(
        (sum, order) => sum + Number(order.total_price || order.price || 0),
        0
      );
  }, [completedOrders]);

  const conversionRate = useMemo(() => {
    if (orders.length === 0) return 0;
    return Math.round((completedOrders.length / orders.length) * 100);
  }, [orders, completedOrders]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce((sum, review) => sum + Number(review.rating), 0);

    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, number>();

    completedOrders.forEach((order) => {
      const monthKey = new Date(order.created_at).toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      });

      map.set(
        monthKey,
        (map.get(monthKey) || 0) + Number(order.total_price || order.price || 0)
      );
    });

    return Array.from(map.entries()).slice(-6);
  }, [completedOrders]);

  const maxMonthlyRevenue = Math.max(
    1,
    ...monthlyRevenue.map(([, revenue]) => revenue)
  );

  const topProducts = useMemo(() => {
    const productMap = new Map<
      string,
      { name: string; orders: number; revenue: number }
    >();

    completedOrders.forEach((order) => {
      const key = String(order.product_id || order.product || "unknown");
      const current = productMap.get(key) || {
        name: order.product || "Unknown Product",
        orders: 0,
        revenue: 0,
      };

      current.orders += 1;
      current.revenue += Number(order.total_price || order.price || 0);
      productMap.set(key, current);
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [completedOrders]);

  const dailyRevenue7Days = useMemo(() => {
    const days: { date: string; revenue: number }[] = [];

    for (let index = 6; index >= 0; index--) {
      const date = getDaysAgo(index);
      const key = date.toISOString().slice(0, 10);

      const revenue = completedOrders
        .filter((order) => getDayKey(order.created_at) === key)
        .reduce(
          (sum, order) => sum + Number(order.total_price || order.price || 0),
          0
        );

      days.push({
        date: date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
        revenue,
      });
    }

    return days;
  }, [completedOrders]);

  const maxDailyRevenue = Math.max(1, ...dailyRevenue7Days.map((day) => day.revenue));

  async function loadSellerAnalytics(currentUser: User) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,username,seller_status,seller_name")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      return;
    }

    setProfile(profileData || null);

    if (!profileData || profileData.seller_status !== "approved") {
      return;
    }

    const [ordersResult, productsResult, reviewsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,product_id,product,price,total_price,status,created_at")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
      supabase
        .from("products")
        .select("id,title,price,status,stock")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
      supabase
        .from("seller_reviews")
        .select("id,rating,review_text,created_at")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
    ]);

    if (ordersResult.error) {
      alert(ordersResult.error.message);
      return;
    }

    if (productsResult.error) {
      alert(productsResult.error.message);
      return;
    }

    if (reviewsResult.error) {
      alert(reviewsResult.error.message);
      return;
    }

    setOrders(ordersResult.data || []);
    setProducts(productsResult.data || []);
    setReviews(reviewsResult.data || []);
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
      await loadSellerAnalytics(userData.user);
      setLoading(false);
    }

    initializePage();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller analytics...
        </p>
      </main>
    );
  }

  if (!user || profile?.seller_status !== "approved") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-yellow-300">
            Seller Approval Required
          </h1>

          <p className="mt-4 text-gray-300">
            Only approved sellers can access analytics.
          </p>

          <Link
            href="/seller"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Seller Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(250,204,21,.14),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Seller Analytics V1
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Analytics</h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              Track revenue, completed orders, rating, top products, and sales
              performance for {sellerDisplayName}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller/orders"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              Orders
            </Link>

            <Link
              href="/seller"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Total Revenue</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {formatPrice(totalRevenue)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Revenue 7 Days</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {formatPrice(revenue7Days)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Revenue 30 Days</p>
            <p className="mt-2 text-3xl font-black text-blue-300">
              {formatPrice(revenue30Days)}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Average Rating</p>
            <p className="mt-2 text-4xl font-black text-yellow-300">
              {averageRating || "0.0"}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Total Orders</p>
            <p className="mt-2 text-4xl font-black text-cyan-300">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Completed Orders</p>
            <p className="mt-2 text-4xl font-black text-green-300">
              {completedOrders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Conversion Rate</p>
            <p className="mt-2 text-4xl font-black text-purple-300">
              {conversionRate}%
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Active Products</p>
            <p className="mt-2 text-4xl font-black text-cyan-300">
              {products.filter((product) => product.status === "active").length}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Revenue Last 7 Days</h2>

            <div className="mt-8 flex h-72 items-end gap-4 rounded-2xl border border-white/10 bg-black/30 p-5">
              {dailyRevenue7Days.map((day) => {
                const height = Math.max(8, (day.revenue / maxDailyRevenue) * 100);

                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-44 w-full items-end">
                      <div
                        className="w-full rounded-t-2xl bg-cyan-400"
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <p className="text-center text-xs text-gray-400">{day.date}</p>
                    <p className="text-center text-xs font-bold text-cyan-300">
                      {formatPrice(day.revenue)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black text-yellow-300">
              Recent Reviews
            </h2>

            {reviews.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No reviews yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {reviews.slice(0, 5).map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <p className="text-xl text-yellow-300">
                      {"★★★★★".slice(0, review.rating)}
                      {"☆☆☆☆☆".slice(0, 5 - review.rating)}
                    </p>

                    <p className="mt-3 text-sm leading-6 text-gray-300">
                      {review.review_text || "No written review."}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Top Selling Products</h2>

            {topProducts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No completed sales yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {topProducts.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <p className="text-sm font-black text-cyan-300">
                          #{index + 1}
                        </p>

                        <h3 className="mt-1 text-xl font-black">{item.name}</h3>

                        <p className="mt-1 text-sm text-gray-400">
                          {item.orders} completed orders
                        </p>
                      </div>

                      <p className="text-2xl font-black text-green-300">
                        {formatPrice(item.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Monthly Revenue</h2>

            {monthlyRevenue.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No monthly revenue yet.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {monthlyRevenue.map(([month, revenue]) => {
                  const width = Math.max(8, (revenue / maxMonthlyRevenue) * 100);

                  return (
                    <div key={month}>
                      <div className="mb-2 flex justify-between gap-4">
                        <span className="font-bold text-gray-300">{month}</span>
                        <span className="font-black text-green-300">
                          {formatPrice(revenue)}
                        </span>
                      </div>

                      <div className="h-4 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full rounded-full bg-green-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}