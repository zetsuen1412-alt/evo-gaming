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
  seller_status: string | null;
  seller_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Product = {
  id: number;
  title: string | null;
  price: string | number | null;
  status: string | null;
  stock: number | null;
  created_at: string;
};

type Order = {
  id: number;
  product: string | null;
  price: string | number | null;
  total_price: string | number | null;
  status: string | null;
  created_at: string;
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

function renderStars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}

export default function SellerDashboardV3Page() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const sellerDisplayName = useMemo(() => {
    return profile?.seller_name || profile?.username || user?.email || "Seller";
  }, [profile, user]);

  const activeProducts = products.filter(
    (product) => product.status === "active"
  );

  const hiddenProducts = products.filter(
    (product) => product.status === "hidden"
  );

  const pendingPaymentOrders = orders.filter(
    (order) => normalizeStatus(order.status) === "Pending Payment"
  );

  const verificationOrders = orders.filter(
    (order) => normalizeStatus(order.status) === "Payment Verification"
  );

  const processingOrders = orders.filter(
    (order) => normalizeStatus(order.status) === "Processing"
  );

  const completedOrders = orders.filter(
    (order) => normalizeStatus(order.status) === "Completed"
  );

  const completedRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.total_price || order.price || 0),
    0
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce(
      (sum, review) => sum + Number(review.rating),
      0
    );

    return total / reviews.length;
  }, [reviews]);

  const roundedRating =
    averageRating > 0 ? Math.round(averageRating * 10) / 10 : 0;

  async function loadSellerData(currentUser: User) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
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

    const [productsResult, ordersResult, reviewsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,title,price,status,stock,created_at")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
      supabase
        .from("orders")
        .select("id,product,price,total_price,status,created_at")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
      supabase
        .from("seller_reviews")
        .select("id,rating,review_text,created_at")
        .eq("seller_id", currentUser.id)
        .order("id", { ascending: false }),
    ]);

    if (productsResult.error) {
      alert(productsResult.error.message);
      return;
    }

    if (ordersResult.error) {
      alert(ordersResult.error.message);
      return;
    }

    if (reviewsResult.error) {
      alert(reviewsResult.error.message);
      return;
    }

    setProducts(productsResult.data || []);
    setOrders(ordersResult.data || []);
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
      await loadSellerData(userData.user);
      setLoading(false);
    }

    initializePage();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller dashboard...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>

          <p className="mt-4 text-gray-400">
            Please login first to access seller dashboard.
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

  if (profile?.seller_status !== "approved") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-yellow-300">
            Seller Approval Required
          </h1>

          <p className="mt-4 text-gray-300">
            Your seller account is not approved yet. Please apply or wait for
            admin verification.
          </p>

          <Link
            href="/seller/apply"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Apply as Seller
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
            <p className="mb-4 inline-flex rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
              Verified Seller Dashboard
            </p>

            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/30 bg-cyan-400/10">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={sellerDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black text-cyan-300">
                    {sellerDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-5xl font-black md:text-7xl">
                  {sellerDisplayName}
                </h1>

                <p className="mt-3 max-w-2xl text-gray-300">
                  Manage your products, orders, revenue, analytics, and buyer
                  reviews.
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
                ★ {roundedRating || "0.0"} / 5
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                {reviews.length} Reviews
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                {completedOrders.length} Completed Orders
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller/analytics"
              className="inline-flex h-12 items-center justify-center rounded-full border border-yellow-400 px-6 font-bold text-yellow-300 transition hover:bg-yellow-400 hover:text-black"
            >
              Analytics
            </Link>

            <Link
              href="/seller/products/new"
              className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black transition hover:bg-cyan-300"
            >
              Add Product
            </Link>

            <Link
              href={`/seller-profile/${user.id}`}
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Public Profile
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Active Products</p>
            <p className="mt-2 text-4xl font-black text-cyan-300">
              {activeProducts.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Orders</p>
            <p className="mt-2 text-4xl font-black text-blue-300">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Payment Verification</p>
            <p className="mt-2 text-4xl font-black text-yellow-300">
              {verificationOrders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Completed Revenue</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {formatPrice(completedRevenue)}
            </p>
          </div>
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <Link
            href="/seller/products"
            className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 transition hover:-translate-y-1 hover:border-cyan-400"
          >
            <h2 className="text-2xl font-black text-cyan-300">My Products</h2>
            <p className="mt-3 text-sm text-gray-300">
              Manage listings, stock, and product status.
            </p>
            <p className="mt-5 text-sm font-black text-cyan-300">Open →</p>
          </Link>

          <Link
            href="/seller/products/new"
            className="rounded-3xl border border-green-400/20 bg-green-400/10 p-6 transition hover:-translate-y-1 hover:border-green-400"
          >
            <h2 className="text-2xl font-black text-green-300">Add Product</h2>
            <p className="mt-3 text-sm text-gray-300">
              Create a new marketplace listing.
            </p>
            <p className="mt-5 text-sm font-black text-green-300">Create →</p>
          </Link>

          <Link
            href="/seller/orders"
            className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6 transition hover:-translate-y-1 hover:border-yellow-400"
          >
            <h2 className="text-2xl font-black text-yellow-300">
              Seller Orders
            </h2>
            <p className="mt-3 text-sm text-gray-300">
              Process orders and verify payment proof.
            </p>
            <p className="mt-5 text-sm font-black text-yellow-300">Manage →</p>
          </Link>

          <Link
            href="/seller/analytics"
            className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-6 transition hover:-translate-y-1 hover:border-blue-400"
          >
            <h2 className="text-2xl font-black text-blue-300">Analytics</h2>
            <p className="mt-3 text-sm text-gray-300">
              Track revenue, sales, ratings, and top products.
            </p>
            <p className="mt-5 text-sm font-black text-blue-300">View →</p>
          </Link>

          <Link
            href={`/seller-profile/${user.id}`}
            className="rounded-3xl border border-purple-400/20 bg-purple-400/10 p-6 transition hover:-translate-y-1 hover:border-purple-400"
          >
            <h2 className="text-2xl font-black text-purple-300">
              Public Profile
            </h2>
            <p className="mt-3 text-sm text-gray-300">
              View rating, reviews, and public seller page.
            </p>
            <p className="mt-5 text-sm font-black text-purple-300">View →</p>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Latest Orders</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Recent buyer activity for your products.
                </p>
              </div>

              <Link
                href="/seller/orders"
                className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                View All
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No orders yet.
              </div>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 6).map((order) => (
                  <Link
                    key={order.id}
                    href={`/order/${order.id}`}
                    className="block rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-cyan-400"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <p className="text-sm font-black text-cyan-300">
                          Order #{order.id}
                        </p>

                        <h3 className="mt-1 text-lg font-black">
                          {order.product || "Unknown Product"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          {normalizeStatus(order.status)}
                        </p>
                      </div>

                      <p className="font-black text-green-300">
                        {formatPrice(order.total_price || order.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black">Order Status</h2>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Pending Payment</span>
                  <span className="font-black text-cyan-300">
                    {pendingPaymentOrders.length}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Verification</span>
                  <span className="font-black text-yellow-300">
                    {verificationOrders.length}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Processing</span>
                  <span className="font-black text-blue-300">
                    {processingOrders.length}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Completed</span>
                  <span className="font-black text-green-300">
                    {completedOrders.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black text-yellow-300">Rating</h2>

              <p className="mt-4 text-5xl font-black text-yellow-300">
                {roundedRating || "0.0"}
              </p>

              <p className="mt-2 text-xl text-yellow-300">
                {averageRating > 0
                  ? renderStars(Math.round(averageRating))
                  : "☆☆☆☆☆"}
              </p>

              <p className="mt-3 text-sm text-gray-300">
                Based on {reviews.length} buyer reviews.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
              <h2 className="text-2xl font-black">Product Status</h2>

              <div className="mt-5 space-y-4">
                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Active</span>
                  <span className="font-black text-green-300">
                    {activeProducts.length}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-gray-400">Hidden</span>
                  <span className="font-black text-yellow-300">
                    {hiddenProducts.length}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}