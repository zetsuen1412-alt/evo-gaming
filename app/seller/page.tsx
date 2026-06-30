"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FaBolt,
  FaBoxOpen,
  FaChartLine,
  FaClock,
  FaClipboardList,
  FaMedal,
  FaMoneyBillWave,
  FaPlus,
  FaSignal,
  FaStar,
  FaStore,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";
import {
  effectivePresence,
  formatDeliveryEta,
  serviceLevelClass,
  serviceLevelDescription,
  serviceLevelLabel,
} from "@/lib/sellerServiceLevel";
import { supabase } from "@/lib/supabase";

type Overview = {
  profile: {
    seller_name?: string | null;
    username?: string | null;
    email?: string | null;
    seller_rating?: number | string | null;
    seller_review_count?: number | string | null;
    seller_presence_mode?: string | null;
    seller_last_seen_at?: string | null;
    seller_delivery_sla_minutes?: number | null;
    seller_avg_delivery_minutes?: number | string | null;
    seller_on_time_rate?: number | string | null;
    seller_total_deliveries?: number | null;
    seller_late_deliveries?: number | null;
    seller_service_level?: string | null;
  };
  wallet: {
    balance?: number | string | null;
    pending_balance?: number | string | null;
  };
  metrics: {
    products: number;
    activeProducts: number;
    orders: number;
    paidOrders: number;
    awaitingDelivery: number;
    completedOrders: number;
    lateOrders: number;
    followers: number;
    lifetimeEarnings: number;
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
    delivery_due_at?: string | null;
    delivery_sla_status?: string | null;
    delivered_at?: string | null;
  }>;
};

function prettyStatus(value?: string | null) {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function SellerDashboardPage() {
  const { formatPrice } = useCurrency();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sellerStatus, setSellerStatus] = useState("");

  useEffect(() => {
    async function loadOverview() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (sessionError || !accessToken) {
          throw new Error("Please login to open your seller dashboard.");
        }

        const response = await fetch("/api/seller/overview", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const json = await response.json();

        if (!response.ok) {
          setSellerStatus(json.sellerStatus || "");
          throw new Error(json.error || "Seller dashboard is unavailable.");
        }

        setOverview(json);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load seller dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  useEffect(() => {
    if (!overview) return;

    const presence = effectivePresence(
      overview.profile.seller_presence_mode,
      overview.profile.seller_last_seen_at
    );

    if (presence === "offline") return;

    const heartbeat = async () => {
      try {
        await authenticatedFetchJson("/api/seller/service-level", {
          method: "POST",
          body: JSON.stringify({ action: "heartbeat" }),
        });
      } catch {
        // Presence falls back to offline automatically when heartbeats stop.
      }
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [overview]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-24 text-center text-white">
        Loading seller dashboard...
      </main>
    );
  }

  if (!overview) {
    const href =
      sellerStatus === "pending" || sellerStatus === "rejected"
        ? "/seller/verification"
        : "/seller/apply";

    return (
      <main className="min-h-screen bg-[#050816] px-4 py-24 text-center text-white">
        <h1 className="text-4xl font-black">Seller Access Required</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">{error}</p>
        <Link
          href={href}
          className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-4 font-black text-black"
        >
          Open Seller Verification
        </Link>
      </main>
    );
  }

  const name =
    overview.profile.seller_name ||
    overview.profile.username ||
    overview.profile.email ||
    "Seller";
  const presence = effectivePresence(
    overview.profile.seller_presence_mode,
    overview.profile.seller_last_seen_at
  );
  const serviceLevel = serviceLevelLabel(overview.profile.seller_service_level);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_38%)]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-4 py-14 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap gap-3">
              <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
                Approved Seller
              </p>
              <p className={`inline-flex rounded-full border px-4 py-2 text-sm font-black capitalize ${
                presence === "online"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : presence === "away"
                    ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                    : "border-slate-400/30 bg-slate-400/10 text-slate-300"
              }`}>
                {presence}
              </p>
              <p className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${serviceLevelClass(overview.profile.seller_service_level)}`}>
                {serviceLevel} Service
              </p>
            </div>
            <h1 className="mt-5 text-5xl font-black md:text-7xl">{name}</h1>
            <p className="mt-4 text-slate-300">
              Manage listings, paid orders, deliveries, followers, and earnings.
            </p>
          </div>
          <Link
            href="/seller/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-4 font-black text-black hover:bg-cyan-300"
          >
            <FaPlus /> Create Product
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<FaBoxOpen />} label="Active Listings" value={String(overview.metrics.activeProducts)} />
          <Metric icon={<FaClipboardList />} label="Paid Orders" value={String(overview.metrics.paidOrders)} />
          <Metric icon={<FaStore />} label="Awaiting Delivery" value={String(overview.metrics.awaitingDelivery)} attention={overview.metrics.awaitingDelivery > 0} />
          <Metric icon={<FaClock />} label="Late Orders" value={String(overview.metrics.lateOrders)} attention={overview.metrics.lateOrders > 0} />
          <Metric icon={<FaMoneyBillWave />} label="Lifetime Earnings" value={formatPrice(overview.metrics.lifetimeEarnings)} />
          <Metric icon={<FaWallet />} label="Available Wallet" value={formatPrice(overview.wallet.balance)} />
          <Metric icon={<FaSignal />} label="On-Time Rate" value={`${Number(overview.profile.seller_on_time_rate || 100).toFixed(1)}%`} />
          <Metric icon={<FaBolt />} label="Average Delivery" value={formatDeliveryEta(overview.profile.seller_avg_delivery_minutes)} />
          <Metric icon={<FaUsers />} label="Followers" value={String(overview.metrics.followers)} />
          <Metric icon={<FaStar />} label="Rating" value={Number(overview.profile.seller_rating || 0).toFixed(1)} />
          <Metric icon={<FaChartLine />} label="Completed Orders" value={String(overview.metrics.completedOrders)} />
          <Metric icon={<FaMedal />} label="Service Level" value={serviceLevel} />
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">Recent Orders</h2>
              <Link href="/seller/orders" className="font-black text-cyan-300">
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
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-400"
                  >
                    <div>
                      <p className="font-black">
                        #{order.id} · {order.product_title || order.product || "Product"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {prettyStatus(order.payment_status || order.status)}
                      </p>
                    </div>
                    <p className="font-black text-cyan-300">
                      {formatPrice(order.total_amount || order.total_price)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Seller Tools</h2>
            <div className={`mt-5 rounded-2xl border p-4 ${serviceLevelClass(overview.profile.seller_service_level)}`}>
              <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{serviceLevel} Service</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {serviceLevelDescription(overview.profile.seller_service_level)}
              </p>
              <p className="mt-3 text-xs text-slate-300">
                Promise: {formatDeliveryEta(overview.profile.seller_delivery_sla_minutes)}
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              <Tool href="/seller/products" label="Manage Products" />
              <Tool href="/seller/products/import" label="Bulk Listing Import" />
              <Tool href="/seller/storefront" label="Storefront Studio" />
              <Tool href="/seller/orders" label="Manage Orders" />
              <Tool href="/seller/service-level" label="Service Level & SLA" />
              <Tool href="/seller/analytics" label="Analytics" />
              <Tool href="/seller/reviews" label="Verified Reviews" />
              <Tool href="/seller/followers" label="Followers" />
              <Tool href="/wallet" label="Wallet" />
              <Tool href="/seller/payouts" label="Payout Center" />
              <Tool href="/seller/tax-profile" label="Tax Residency" />
              <Tool href="/seller/tax-statements" label="Tax Statements" />
              <Tool href="/seller/verification" label="Verification Status" />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  attention = false,
}: {
  icon: React.ReactNode;
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
      <div className={attention ? "text-yellow-300" : "text-cyan-300"}>{icon}</div>
      <p className="mt-4 text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Tool({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-black transition hover:border-cyan-400 hover:text-cyan-300"
    >
      {label} →
    </Link>
  );
}
