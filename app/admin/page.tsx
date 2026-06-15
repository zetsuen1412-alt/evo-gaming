"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  avatar_url: string | null;
  seller_name: string | null;
};

type Wallet = {
  id: number;
  user_id: string;
  balance: string | number;
  total_withdrawn: string | number;
};

type Withdrawal = {
  id: number;
  user_id: string;
  wallet_id: number;
  amount: string | number;
  payout_method: string;
  payout_account_name: string;
  payout_account_number: string;
  payout_note: string | null;
  status: string;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  profiles: Profile | null;
  wallets: Wallet | null;
};

const statusFilters = ["all", "pending", "approved", "rejected", "cancelled"];


function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

function statusClass(status: string) {
  if (status === "approved") return "border-green-400/20 bg-green-400/10 text-green-300";
  if (status === "pending") return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  if (status === "rejected" || status === "cancelled") return "border-red-400/20 bg-red-400/10 text-red-300";
  return "border-white/10 bg-white/[0.04] text-gray-300";
}

export default function AdminWithdrawalManagementV1Page() {
  const { formatPrice, currency } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  const isAdmin = profile?.role?.trim().toLowerCase() === "admin";

  const filteredWithdrawals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return withdrawals.filter((item) => {
      const p = item.profiles;
      const matchesStatus = activeStatus === "all" || item.status === activeStatus;
      const matchesSearch =
        !query ||
        String(item.id).includes(query) ||
        item.user_id.toLowerCase().includes(query) ||
        item.payout_method.toLowerCase().includes(query) ||
        item.payout_account_name.toLowerCase().includes(query) ||
        item.payout_account_number.toLowerCase().includes(query) ||
        (p?.email || "").toLowerCase().includes(query) ||
        (p?.username || "").toLowerCase().includes(query) ||
        (p?.seller_name || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [withdrawals, activeStatus, search]);

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
  const approvedCount = withdrawals.filter((w) => w.status === "approved").length;
  const rejectedCount = withdrawals.filter((w) => w.status === "rejected").length;
  const totalAmount = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const pendingAmount = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  async function loadWithdrawals() {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select(
        `
        *,
        profiles:user_id (
          id,
          email,
          username,
          role,
          avatar_url,
          seller_name
        ),
        wallets:wallet_id (
          id,
          user_id,
          balance,
          total_withdrawn
        )
      `
      )
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWithdrawals((data || []) as unknown as Withdrawal[]);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        alert(userError.message);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,username,role,avatar_url,seller_name")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        setLoading(false);
        return;
      }

      setProfile(profileData || null);

      if (profileData?.role?.trim().toLowerCase() === "admin") {
        await loadWithdrawals();
      }

      setLoading(false);
    }

    init();
  }, []);

  async function approveWithdrawal(item: Withdrawal) {
    if (item.status !== "pending") {
      alert("Only pending withdrawal can be approved.");
      return;
    }

    if (!confirm(`Approve withdrawal ${formatPrice(item.amount)}?`)) return;

    setUpdatingId(item.id);

    const note = adminNotes[item.id]?.trim() || "Withdrawal approved by admin.";

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "approved",
        admin_note: note,
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (requestError) {
      alert(requestError.message);
      setUpdatingId(null);
      return;
    }

    await supabase
      .from("wallet_transactions")
      .update({
        type: "withdraw_approved",
        status: "completed",
        description: note,
      })
      .eq("wallet_id", item.wallet_id)
      .eq("user_id", item.user_id)
      .eq("type", "withdraw_request")
      .eq("amount", Number(item.amount))
      .eq("status", "pending");

    await loadWithdrawals();
    setUpdatingId(null);
  }

  async function rejectWithdrawal(item: Withdrawal) {
    if (item.status !== "pending") {
      alert("Only pending withdrawal can be rejected.");
      return;
    }

    const note = adminNotes[item.id]?.trim();

    if (!note) {
      alert("Admin note is required when rejecting withdrawal.");
      return;
    }

    if (!confirm(`Reject and refund ${formatPrice(item.amount)}?`)) return;

    setUpdatingId(item.id);

    const currentBalance = Number(item.wallets?.balance || 0);
    const amount = Number(item.amount || 0);
    const balanceAfter = currentBalance + amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({
        balance: balanceAfter,
        total_withdrawn: Math.max(Number(item.wallets?.total_withdrawn || 0) - amount, 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.wallet_id);

    if (walletError) {
      alert(walletError.message);
      setUpdatingId(null);
      return;
    }

    const { error: requestError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        admin_note: note,
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (requestError) {
      alert(requestError.message);
      setUpdatingId(null);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      wallet_id: item.wallet_id,
      user_id: item.user_id,
      type: "withdraw_rejected",
      amount,
      balance_before: currentBalance,
      balance_after: balanceAfter,
      order_id: null,
      description: `Withdrawal rejected and refunded. ${note}`,
      status: "rejected",
    });

    await supabase
      .from("wallet_transactions")
      .update({
        status: "rejected",
        description: `Withdrawal request rejected. ${note}`,
      })
      .eq("wallet_id", item.wallet_id)
      .eq("user_id", item.user_id)
      .eq("type", "withdraw_request")
      .eq("amount", amount)
      .eq("status", "pending");

    await loadWithdrawals();
    setUpdatingId(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading withdrawals...</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Access Denied</h1>
          <p className="mt-4 text-gray-300">Only admin can access withdrawal management.</p>
          <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
              Admin Withdrawal Management
            </p>
            <h1 className="text-5xl font-black md:text-7xl">Withdrawals</h1>
            <p className="mt-5 max-w-3xl text-gray-300">
              Review seller withdrawal requests, approve payouts, reject requests, and refund wallet balance.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Admin Home
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total Requests</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">{withdrawals.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Pending</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">{pendingCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Approved</p>
            <p className="mt-2 text-3xl font-black text-green-300">{approvedCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Rejected</p>
            <p className="mt-2 text-3xl font-black text-red-300">{rejectedCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Pending Amount</p>
            <p className="mt-2 text-2xl font-black text-green-300">{formatPrice(pendingAmount)}</p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, username, payout method, account number, or request ID..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-3">
            {statusFilters.map((item) => (
              <button
                key={item}
                onClick={() => setActiveStatus(item)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  activeStatus === item
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {item === "all" ? "All" : item}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <p className="text-sm text-gray-400">Total Requested Amount</p>
          <p className="mt-2 text-3xl font-black text-purple-300">{formatPrice(totalAmount)}</p>
        </div>

        {filteredWithdrawals.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center">
            <h2 className="text-3xl font-black">No withdrawal requests found.</h2>
            <p className="mt-3 text-gray-400">Withdrawal requests from users will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredWithdrawals.map((item) => {
              const displayName =
                item.profiles?.seller_name ||
                item.profiles?.username ||
                item.profiles?.email ||
                "User";

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">Withdrawal #{item.id}</h2>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-4 text-4xl font-black text-green-300">
                        {formatPrice(item.amount)}
                      </p>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">User</p>
                          <p className="mt-1 font-black">{displayName}</p>
                          <p className="mt-1 break-words text-sm text-gray-400">{item.profiles?.email || item.user_id}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Payout Method</p>
                          <p className="mt-1 font-black">{item.payout_method}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Account Name</p>
                          <p className="mt-1 font-black">{item.payout_account_name}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Account Number</p>
                          <p className="mt-1 break-words font-black">{item.payout_account_number}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Requested At</p>
                          <p className="mt-1 font-black">{formatDate(item.created_at)}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Processed At</p>
                          <p className="mt-1 font-black">{formatDate(item.processed_at)}</p>
                        </div>
                      </div>

                      {item.payout_note && (
                        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-sm font-black text-cyan-300">User Note</p>
                          <p className="mt-2 text-sm text-gray-300">{item.payout_note}</p>
                        </div>
                      )}

                      {item.admin_note && (
                        <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                          <p className="text-sm font-black text-yellow-300">Admin Note</p>
                          <p className="mt-2 text-sm text-gray-300">{item.admin_note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-gray-400">Admin Note</label>

                      <textarea
                        value={adminNotes[item.id] || ""}
                        onChange={(event) =>
                          setAdminNotes((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="Write admin note..."
                        rows={5}
                        disabled={item.status !== "pending"}
                        className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400 disabled:opacity-60"
                      />

                      <button
                        onClick={() => approveWithdrawal(item)}
                        disabled={updatingId === item.id || item.status !== "pending"}
                        className="rounded-2xl bg-green-500 px-5 py-3 font-black text-white hover:bg-green-400 disabled:opacity-60"
                      >
                        Approve Withdrawal
                      </button>

                      <button
                        onClick={() => rejectWithdrawal(item)}
                        disabled={updatingId === item.id || item.status !== "pending"}
                        className="rounded-2xl bg-red-500 px-5 py-3 font-black text-white hover:bg-red-400 disabled:opacity-60"
                      >
                        Reject & Refund
                      </button>

                      <Link
                        href={`/seller-profile/${item.user_id}`}
                        className="rounded-2xl border border-cyan-400 px-5 py-3 text-center font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
                      >
                        View User Profile
                      </Link>

                      {updatingId === item.id && (
                        <p className="text-center text-sm text-gray-400">Updating withdrawal...</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}