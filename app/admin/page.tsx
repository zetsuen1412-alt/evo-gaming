"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FaBalanceScale,
  FaBullhorn,
  FaClipboardList,
  FaChartLine,
  FaCommentDots,
  FaExclamationTriangle,
  FaGamepad,
  FaMoneyBillWave,
  FaRocket,
  FaShoppingBag,
  FaShieldAlt,
  FaStore,
  FaTicketAlt,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";

type Overview = {
  profile: {
    email?: string | null;
    username?: string | null;
  };
  metrics: {
    users: number;
    products: number;
    orders: number;
    pendingSellerApplications: number;
    activeDisputes: number;
    pendingWithdrawals: number;
    supportQueue: number;
    grossVolume: number;
    feeRevenue: number;
  };
  recentOrders: Array<{
    id: number;
    product_title?: string | null;
    product?: string | null;
    total_amount?: number | string | null;
    total_price?: number | string | null;
    status?: string | null;
    payment_status?: string | null;
    created_at?: string | null;
  }>;
};

const modules = [
  { href: "/admin/orders", label: "Orders", icon: FaShoppingBag },
  { href: "/admin/products", label: "Products", icon: FaStore },
  { href: "/admin/users", label: "Users", icon: FaUsers },
  { href: "/admin/seller-applications", label: "Seller Applications", icon: FaStore },
  { href: "/admin/disputes", label: "Disputes", icon: FaExclamationTriangle },
  { href: "/admin/risk", label: "Trust & Risk", icon: FaShieldAlt },
  { href: "/admin/chat-moderation", label: "Chat Moderation", icon: FaCommentDots },
  { href: "/admin/finance", label: "Finance", icon: FaChartLine },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: FaBalanceScale },
  { href: "/admin/operations", label: "Launch Readiness", icon: FaRocket },
  { href: "/admin/compliance", label: "Commerce Compliance", icon: FaShieldAlt },
  { href: "/admin/wallet-topups", label: "Wallet Top Ups", icon: FaWallet },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: FaMoneyBillWave },
  { href: "/admin/support", label: "Support", icon: FaTicketAlt },
  { href: "/admin/games", label: "Game Catalog", icon: FaGamepad },
  { href: "/admin/announcements", label: "Announcements", icon: FaBullhorn },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FaClipboardList },
];

function prettyStatus(value?: string | null) {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminDashboardPage() {
  const { formatPrice } = useCurrency();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOverview() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (sessionError || !accessToken) {
          throw new Error("Please login with an administrator account.");
        }

        const response = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Failed to load admin dashboard.");
        }

        setOverview(json);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load admin dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-24 text-center text-white">
        Loading admin dashboard...
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-24 text-center text-white">
        <h1 className="text-4xl font-black">Admin Dashboard Unavailable</h1>
        <p className="mt-4 text-red-300">{error}</p>
        <Link href="/" className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-4 font-black text-black">
          Back Home
        </Link>
      </main>
    );
  }

  const metrics = overview.metrics;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_38%)]">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            ComePlayers Operations Center
          </p>
          <h1 className="mt-5 text-5xl font-black md:text-7xl">Admin Dashboard</h1>
          <p className="mt-4 text-slate-300">
            Marketplace health, risk queue, finance, sellers, products, and support.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Users" value={metrics.users.toLocaleString("id-ID")} />
          <Metric label="Products" value={metrics.products.toLocaleString("id-ID")} />
          <Metric label="Orders" value={metrics.orders.toLocaleString("id-ID")} />
          <Metric label="Gross Volume" value={formatPrice(metrics.grossVolume)} />
          <Metric label="Fee Revenue" value={formatPrice(metrics.feeRevenue)} />
          <Metric label="Seller Applications" value={String(metrics.pendingSellerApplications)} attention />
          <Metric label="Active Disputes" value={String(metrics.activeDisputes)} attention />
          <Metric label="Support Queue" value={String(metrics.supportQueue)} attention />
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">Recent Orders</h2>
              <Link href="/admin/orders" className="font-black text-cyan-300">
                View all →
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {overview.recentOrders.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-slate-400">
                  No orders yet.
                </p>
              ) : (
                overview.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-400 md:grid-cols-[80px_1fr_auto]"
                  >
                    <span className="font-black text-cyan-300">#{order.id}</span>
                    <div>
                      <p className="font-black">
                        {order.product_title || order.product || "Product"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="font-black">
                        {formatPrice(order.total_amount || order.total_price)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        {prettyStatus(order.payment_status || order.status)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Management</h2>
            <div className="mt-5 grid gap-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-black transition hover:border-cyan-400 hover:text-cyan-300"
                  >
                    <Icon className="text-cyan-300" />
                    {module.label}
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${
      attention
        ? "border-yellow-400/20 bg-yellow-400/10"
        : "border-white/10 bg-white/[0.04]"
    }`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${
        attention ? "text-yellow-300" : "text-cyan-300"
      }`}>
        {value}
      </p>
    </div>
  );
}
