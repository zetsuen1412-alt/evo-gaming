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
  product: string | null;
  buyer: string | null;
  price: string | number | null;
  total_price: string | number | null;
  status: string | null;
  created_at: string;
};

type SellerApplication = {
  id: number;
  seller_name: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
};

type Stats = {
  users: number;
  sellers: number;
  pendingSellers: number;
  products: number;
  games: number;
  mappings: number;
  orders: number;
  disputes: number;
  revenue: number;
};

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

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

export default function AdminDashboardV3Page() {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    users: 0,
    sellers: 0,
    pendingSellers: 0,
    products: 0,
    games: 0,
    mappings: 0,
    orders: 0,
    disputes: 0,
    revenue: 0,
  });

  const [latestOrders, setLatestOrders] = useState<Order[]>([]);
  const [latestApplications, setLatestApplications] = useState<
    SellerApplication[]
  >([]);

  const isAdmin = adminProfile?.role?.trim().toLowerCase() === "admin";

  const adminCards = useMemo(
    () => [
      {
        title: "Order Management",
        description: "Verify payments, monitor orders, refunds, disputes.",
        href: "/admin/orders",
        value: stats.orders,
        label: "orders",
        accent: "text-cyan-300",
        border: "border-cyan-400/20",
        bg: "bg-cyan-400/10",
      },
      {
        title: "Seller Applications",
        description: "Approve or reject seller verification requests.",
        href: "/admin/seller-applications",
        value: stats.pendingSellers,
        label: "pending",
        accent: "text-yellow-300",
        border: "border-yellow-400/20",
        bg: "bg-yellow-400/10",
      },
      {
        title: "Product Management",
        description: "Review, hide, approve, reject, or delete products.",
        href: "/admin/products",
        value: stats.products,
        label: "products",
        accent: "text-purple-300",
        border: "border-purple-400/20",
        bg: "bg-purple-400/10",
      },
      {
        title: "User Management",
        description: "Manage roles, admin access, and seller status.",
        href: "/admin/users",
        value: stats.users,
        label: "users",
        accent: "text-green-300",
        border: "border-green-400/20",
        bg: "bg-green-400/10",
      },
      {
        title: "Dispute Center",
        description: "Resolve disputed orders and marketplace cases.",
        href: "/admin/disputes",
        value: stats.disputes,
        label: "open disputes",
        accent: "text-orange-300",
        border: "border-orange-400/20",
        bg: "bg-orange-400/10",
      },
      {
        title: "Game Master",
        description: "Manage A-Z game catalog and game assets.",
        href: "/admin/games",
        value: stats.games,
        label: "games",
        accent: "text-blue-300",
        border: "border-blue-400/20",
        bg: "bg-blue-400/10",
      },
      {
        title: "Category Mapping",
        description: "Map games into marketplace categories.",
        href: "/admin/category-mapping",
        value: stats.mappings,
        label: "mappings",
        accent: "text-pink-300",
        border: "border-pink-400/20",
        bg: "bg-pink-400/10",
      },
      {
        title: "Browse Site",
        description: "Return to marketplace homepage.",
        href: "/",
        value: "Open",
        label: "site",
        accent: "text-white",
        border: "border-white/10",
        bg: "bg-white/[0.04]",
      },
    ],
    [stats]
  );

  async function loadDashboard() {
    const [
      profilesResult,
      productsResult,
      ordersResult,
      applicationsResult,
      gamesResult,
      mappingsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("products").select("*"),
      supabase.from("orders").select("*").order("id", { ascending: false }),
      supabase
        .from("seller_applications")
        .select("*")
        .order("id", { ascending: false }),
      supabase.from("game_master").select("*"),
      supabase.from("category_game_master").select("*"),
    ]);

    if (profilesResult.error) alert(profilesResult.error.message);
    if (productsResult.error) alert(productsResult.error.message);
    if (ordersResult.error) alert(ordersResult.error.message);
    if (applicationsResult.error) alert(applicationsResult.error.message);
    if (gamesResult.error) alert(gamesResult.error.message);
    if (mappingsResult.error) alert(mappingsResult.error.message);

    const profiles = profilesResult.data || [];
    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const applications = applicationsResult.data || [];
    const games = gamesResult.data || [];
    const mappings = mappingsResult.data || [];

    const sellers = profiles.filter(
      (profile: any) =>
        profile.seller_status === "approved" || profile.role === "seller"
    );

    const pendingSellers = applications.filter(
      (application: any) => application.status === "pending"
    );

    const disputes = orders.filter(
      (order: any) => normalizeStatus(order.status) === "Disputed"
    );

    const completedOrders = orders.filter(
      (order: any) => normalizeStatus(order.status) === "Completed"
    );

    const revenue = completedOrders.reduce(
      (sum: number, order: any) =>
        sum + Number(order.total_price || order.price || 0),
      0
    );

    setStats({
      users: profiles.length,
      sellers: sellers.length,
      pendingSellers: pendingSellers.length,
      products: products.length,
      games: games.length,
      mappings: mappings.length,
      orders: orders.length,
      disputes: disputes.length,
      revenue,
    });

    setLatestOrders((orders || []).slice(0, 8) as Order[]);
    setLatestApplications((applications || []).slice(0, 6) as SellerApplication[]);
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
        await loadDashboard();
      }

      setLoading(false);
    }

    initializePage();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading admin dashboard...
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
            Only admin accounts can access admin dashboard.
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
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Admin Dashboard V3
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              ComePlayers Control Center
            </h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              Manage sellers, orders, products, users, disputes, game master,
              and category mapping from one dashboard.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Logged in as {user.email}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Open Marketplace
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Total Users</p>
            <p className="mt-2 text-4xl font-black text-cyan-300">
              {stats.users}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Sellers</p>
            <p className="mt-2 text-4xl font-black text-green-300">
              {stats.sellers}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Orders</p>
            <p className="mt-2 text-4xl font-black text-blue-300">
              {stats.orders}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-gray-400">Revenue</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {formatPrice(stats.revenue)}
            </p>
          </div>
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {adminCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group rounded-3xl border ${card.border} ${card.bg} p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-400`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={`text-2xl font-black ${card.accent}`}>
                    {card.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-gray-300">
                    {card.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
                  <p className={`text-2xl font-black ${card.accent}`}>
                    {card.value}
                  </p>

                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              </div>

              <p className="mt-6 text-sm font-black text-cyan-300 opacity-80 group-hover:opacity-100">
                Open →
              </p>
            </Link>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Latest Orders</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Newest marketplace transactions.
                </p>
              </div>

              <Link
                href="/admin/orders"
                className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                View All
              </Link>
            </div>

            {latestOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No orders yet.
              </div>
            ) : (
              <div className="space-y-4">
                {latestOrders.map((order) => (
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
                          Buyer: {order.buyer || "-"}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p className="font-black text-green-300">
                          {formatPrice(order.total_price || order.price)}
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          {normalizeStatus(order.status)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Seller Requests</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Latest seller applications.
                </p>
              </div>

              <Link
                href="/admin/seller-applications"
                className="rounded-full border border-yellow-400 px-5 py-2 font-bold text-yellow-300 hover:bg-yellow-400 hover:text-black"
              >
                View
              </Link>
            </div>

            {latestApplications.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No seller applications yet.
              </div>
            ) : (
              <div className="space-y-4">
                {latestApplications.map((application) => (
                  <Link
                    key={application.id}
                    href="/admin/seller-applications"
                    className="block rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-yellow-400"
                  >
                    <p className="text-sm font-black text-yellow-300">
                      Application #{application.id}
                    </p>

                    <h3 className="mt-1 text-lg font-black">
                      {application.seller_name || "Unknown Seller"}
                    </h3>

                    <p className="mt-1 text-sm text-gray-400">
                      {application.email || "-"}
                    </p>

                    <p className="mt-2 text-xs text-gray-500">
                      Status: {application.status || "pending"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}