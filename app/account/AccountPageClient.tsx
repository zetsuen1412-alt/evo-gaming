"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import InterestRecommendations from "@/components/marketplace/InterestRecommendations";
import RecentlyViewed from "@/components/marketplace/RecentlyViewed";
import RecommendedGames from "@/components/marketplace/RecommendedGames";
import { supabase } from "@/lib/supabase";

type AccountSettings = {
  first_name: string;
  last_name: string;
  national_identity_number: string;
  gender: "male" | "female" | "rather_not_say" | "";
  date_of_birth: string;
  instant_messenger_type: string;
  instant_messenger_value: string;
  phone_number: string;
};

type BillingProfile = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  tax_country_code: string;
  tax_identification_number: string;
};

type QuickStats = {
  orders: number;
  wishlist: number;
  following: number;
  unreadNotifications: number;
};

type RecentOrder = {
  id: number | string;
  status?: string | null;
  total_amount?: string | number | null;
  total_price?: string | number | null;
  product_title?: string | null;
  product_id?: number | null;
  created_at?: string | null;
};

type NotificationPreview = {
  id: number;
  title: string;
  message: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

const emptyAccount: AccountSettings = {
  first_name: "",
  last_name: "",
  national_identity_number: "",
  gender: "",
  date_of_birth: "",
  instant_messenger_type: "",
  instant_messenger_value: "",
  phone_number: "",
};

const emptyBilling: BillingProfile = {
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "ID",
  tax_country_code: "ID",
  tax_identification_number: "",
};

function getUsernameFromEmail(email?: string | null) {
  const localPart = (email || "").split("@")[0]?.trim();
  if (!localPart) return "player";
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "player";
}

function sanitizeUsername(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AccountPageClient() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState<AccountSettings>(emptyAccount);
  const [billing, setBilling] = useState<BillingProfile>(emptyBilling);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<QuickStats>({
    orders: 0,
    wishlist: 0,
    following: 0,
    unreadNotifications: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<NotificationPreview[]>([]);


  const loadBuyerDashboard = async (currentUserId: string, currentEmail: string) => {
    setDashboardLoading(true);

    const [ordersResult, wishlistResult, followingResult, notificationsCountResult, notificationsResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*", { count: "exact" })
          .or(`buyer_id.eq.${currentUserId},buyer.eq.${currentEmail}`)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("wishlists")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUserId),
        supabase
          .from("seller_followers")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", currentUserId),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .eq("is_read", false),
        supabase
          .from("notifications")
          .select("id,title,message,link_url,is_read,created_at")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

    if (!ordersResult.error) {
      setRecentOrders((ordersResult.data || []) as RecentOrder[]);
    }

    if (!notificationsResult.error) {
      setRecentNotifications((notificationsResult.data || []) as NotificationPreview[]);
    }

    setQuickStats({
      orders: ordersResult.count || 0,
      wishlist: wishlistResult.count || 0,
      following: followingResult.count || 0,
      unreadNotifications: notificationsCountResult.count || 0,
    });

    setDashboardLoading(false);
  };

  useEffect(() => {
    const loadAccount = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/");
        return;
      }

      const currentUserId = authData.user.id;
      const currentEmail = authData.user.email || "";

      setUserId(currentUserId);
      setAuthEmail(currentEmail);

      const [{ data: profileData }, { data: accountData }, { data: billingData }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", currentUserId).maybeSingle(),
        supabase.from("user_account_settings").select("*").eq("user_id", currentUserId).maybeSingle(),
        supabase.from("user_billing_profiles").select("*").eq("user_id", currentUserId).maybeSingle(),
      ]);

      setUsername(profileData?.username || getUsernameFromEmail(currentEmail));

      if (accountData) {
        setAccount({
          first_name: accountData.first_name || "",
          last_name: accountData.last_name || "",
          national_identity_number: accountData.national_identity_number || "",
          gender: accountData.gender || "",
          date_of_birth: accountData.date_of_birth || "",
          instant_messenger_type: accountData.instant_messenger_type || "",
          instant_messenger_value: accountData.instant_messenger_value || "",
          phone_number: accountData.phone_number || "",
        });
      }

      if (billingData) {
        setBilling({
          address_line_1: billingData.address_line_1 || "",
          address_line_2: billingData.address_line_2 || "",
          city: billingData.city || "",
          state: billingData.state || "",
          postal_code: billingData.postal_code || "",
          country_code: billingData.country_code || "ID",
          tax_country_code: billingData.tax_country_code || "ID",
          tax_identification_number: billingData.tax_identification_number || "",
        });
      }

      await loadBuyerDashboard(currentUserId, currentEmail);

      setLoading(false);
    };

    void loadAccount();
  }, [router]);

  const updateAccount = (field: keyof AccountSettings, value: string) => {
    setAccount((current) => ({ ...current, [field]: value }));
  };

  const updateBilling = (field: keyof BillingProfile, value: string) => {
    setBilling((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    const cleanUsername = sanitizeUsername(username);

    if (cleanUsername.length < 3) {
      alert("Username minimal 3 karakter.");
      return;
    }

    setSaving(true);

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", userId)
      .maybeSingle();

    if (existingUsername) {
      setSaving(false);
      alert("Username sudah dipakai user lain.");
      return;
    }

    const profileResult = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
      })
      .eq("id", userId);

    const accountPayload = {
      user_id: userId,
      ...account,
      gender: account.gender || null,
      date_of_birth: account.date_of_birth || null,
      updated_at: new Date().toISOString(),
    };

    const billingPayload = {
      user_id: userId,
      ...billing,
      updated_at: new Date().toISOString(),
    };

    const [accountResult, billingResult] = await Promise.all([
      supabase.from("user_account_settings").upsert(accountPayload, { onConflict: "user_id" }),
      supabase.from("user_billing_profiles").upsert(billingPayload, { onConflict: "user_id" }),
    ]);

    setSaving(false);

    if (profileResult.error || accountResult.error || billingResult.error) {
      alert(
        profileResult.error?.message ||
          accountResult.error?.message ||
          billingResult.error?.message ||
          "Failed to save account."
      );
      return;
    }

    setUsername(cleanUsername);
    alert("Account saved successfully.");
  };

  if (loading) {
    return (
      <AccountShell>
        <div className="p-8 text-slate-300">Loading account...</div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <form onSubmit={handleSave}>

        <section className="border-b border-white/10 p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">
                Buyer Dashboard
              </p>
              <h1 className="mt-4 text-3xl font-black md:text-4xl">Welcome back, {username || "player"}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Track your orders, wishlist, followed sellers, notifications, and personalized marketplace picks from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/my-orders"
                className="rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                My Orders
              </Link>
              <Link
                href="/notifications"
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white hover:border-cyan-400"
              >
                Notifications
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders" value={quickStats.orders} href="/my-orders" loading={dashboardLoading} />
            <StatCard label="Wishlist" value={quickStats.wishlist} href="/wishlist" loading={dashboardLoading} />
            <StatCard label="Following Sellers" value={quickStats.following} href="/following" loading={dashboardLoading} />
            <StatCard label="Unread Notifications" value={quickStats.unreadNotifications} href="/notifications" loading={dashboardLoading} highlight />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <RecentOrdersPreview orders={recentOrders} loading={dashboardLoading} />
            <NotificationPreviewList notifications={recentNotifications} loading={dashboardLoading} />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-black">Your Marketplace Activity</h2>
          <p className="mt-2 text-sm text-slate-400">
            Continue from your recent views and discover personalized recommendations.
          </p>

          <div className="mt-6 space-y-8">
            <RecentlyViewed />
            <RecommendedGames />
            <InterestRecommendations />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h1 className="text-2xl font-black">Personal</h1>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field
              label="Username"
              value={username}
              onChange={(value) => setUsername(sanitizeUsername(value))}
              helper={`Default dari email: ${getUsernameFromEmail(authEmail)}`}
            />
            <Field label="Email" value={authEmail} onChange={() => undefined} disabled />
            <Field label="First Name" value={account.first_name} onChange={(value) => updateAccount("first_name", value)} />
            <Field label="Last Name" value={account.last_name} onChange={(value) => updateAccount("last_name", value)} />
            <Field
              label="National identity number"
              value={account.national_identity_number}
              onChange={(value) => updateAccount("national_identity_number", value)}
            />
            <Field label="Mobile number" value={account.phone_number} onChange={(value) => updateAccount("phone_number", value)} />
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm text-slate-300">Gender</p>
            <div className="flex flex-wrap gap-3">
              {[
                ["male", "Male"],
                ["female", "Female"],
                ["rather_not_say", "Rather not say"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="gender"
                    checked={account.gender === value}
                    onChange={() => updateAccount("gender", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 max-w-sm">
            <Field
              type="date"
              label="Date of birth"
              value={account.date_of_birth}
              onChange={(value) => updateAccount("date_of_birth", value)}
            />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-black">Instant messenger</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Instant messenger</span>
              <select
                value={account.instant_messenger_type}
                onChange={(event) => updateAccount("instant_messenger_type", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400"
              >
                <option value="">Please select</option>
                <option value="discord">Discord</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="line">LINE</option>
              </select>
            </label>
            <Field
              label="Messenger ID / Number"
              value={account.instant_messenger_value}
              onChange={(value) => updateAccount("instant_messenger_value", value)}
            />
          </div>
        </section>

        <section className="border-b border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-black">Billing address</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Address" value={billing.address_line_1} onChange={(value) => updateBilling("address_line_1", value)} />
            <Field label="Address line 2" value={billing.address_line_2} onChange={(value) => updateBilling("address_line_2", value)} />
            <Field label="City" value={billing.city} onChange={(value) => updateBilling("city", value)} />
            <Field label="State" value={billing.state} onChange={(value) => updateBilling("state", value)} />
            <Field label="ZIP code" value={billing.postal_code} onChange={(value) => updateBilling("postal_code", value)} />
            <Field label="Country / Region" value={billing.country_code} onChange={(value) => updateBilling("country_code", value)} />
          </div>
        </section>

        <section className="p-6 md:p-8">
          <h2 className="text-2xl font-black">Tax</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Tax country" value={billing.tax_country_code} onChange={(value) => updateBilling("tax_country_code", value)} />
            <Field
              label="Tax identification number"
              value={billing.tax_identification_number}
              onChange={(value) => updateBilling("tax_identification_number", value)}
            />
          </div>
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-8 py-3 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>
      </form>
    </AccountShell>
  );
}


function StatCard({
  label,
  value,
  href,
  loading,
  highlight = false,
}: {
  label: string;
  value: number;
  href: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
        highlight
          ? "border-cyan-400/30 bg-cyan-400/10 hover:border-cyan-300"
          : "border-white/10 bg-black/30 hover:border-cyan-400"
      }`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-cyan-300">
        {loading ? "..." : value.toLocaleString("id-ID")}
      </p>
    </Link>
  );
}

function RecentOrdersPreview({ orders, loading }: { orders: RecentOrder[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">Recent Orders</h3>
        <Link href="/my-orders" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            No orders yet. Start exploring marketplace offers.
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={String(order.id)}
              href={`/order/${order.id}`}
              className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{order.product_title || `Order #${order.id}`}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(order.created_at)}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {order.status || "pending"}
                </span>
              </div>
              <p className="mt-3 font-black text-cyan-300">
                {formatPrice(order.total_amount ?? order.total_price)}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationPreviewList({
  notifications,
  loading,
}: {
  notifications: NotificationPreview[];
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">Recent Notifications</h3>
        <Link href="/notifications" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            No notifications yet.
          </div>
        ) : (
          notifications.map((item) => (
            <Link
              key={item.id}
              href={item.link_url || "/notifications"}
              className={`block rounded-xl border p-4 transition hover:border-cyan-400 ${
                item.is_read ? "border-white/10 bg-white/[0.03]" : "border-cyan-400/30 bg-cyan-400/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.message || "Marketplace notification"}</p>
                </div>
                {!item.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" /> : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at)}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
    </label>
  );
}
