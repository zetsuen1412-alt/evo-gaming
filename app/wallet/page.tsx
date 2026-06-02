"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Wallet = {
  id: number;
  user_id: string;
  balance: string | number;
  pending_balance: string | number;
  total_earned: string | number;
  total_spent: string | number;
  total_withdrawn: string | number;
  status: string;
  created_at: string;
  updated_at: string;
};

type WalletTransaction = {
  id: number;
  wallet_id: number;
  user_id: string;
  type: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  order_id: number | null;
  description: string | null;
  status: string;
  created_at: string;
};

type WithdrawalRequest = {
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
};

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

function getTransactionClass(type: string) {
  if (["deposit", "sale_release", "refund", "adjustment"].includes(type)) {
    return "text-green-300";
  }

  if (["purchase", "withdraw_approved"].includes(type)) {
    return "text-red-300";
  }

  return "text-yellow-300";
}

function getStatusClass(status: string) {
  if (status === "completed" || status === "approved") {
    return "border-green-400/20 bg-green-400/10 text-green-300";
  }

  if (status === "pending") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  }

  if (status === "rejected" || status === "cancelled") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  return "border-white/10 bg-white/[0.04] text-gray-300";
}

export default function WalletPageV1() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [requestingWithdraw, setRequestingWithdraw] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("all");

  const transactionTypes = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(transactions.map((item) => item.type))).sort(),
    ];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesType = activeType === "all" || transaction.type === activeType;

      const matchesSearch =
        !query ||
        transaction.type.toLowerCase().includes(query) ||
        transaction.status.toLowerCase().includes(query) ||
        (transaction.description || "").toLowerCase().includes(query) ||
        String(transaction.id).includes(query) ||
        String(transaction.order_id || "").includes(query);

      return matchesType && matchesSearch;
    });
  }, [transactions, search, activeType]);

  async function loadWalletData(currentUser: User) {
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (walletError) {
      alert(walletError.message);
      return;
    }

    setWallet(walletData || null);

    if (!walletData) {
      setTransactions([]);
      setWithdrawals([]);
      return;
    }

    const [transactionsResult, withdrawalsResult] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", walletData.id)
        .order("id", { ascending: false }),
      supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("wallet_id", walletData.id)
        .order("id", { ascending: false }),
    ]);

    if (transactionsResult.error) {
      alert(transactionsResult.error.message);
      return;
    }

    if (withdrawalsResult.error) {
      alert(withdrawalsResult.error.message);
      return;
    }

    setTransactions(transactionsResult.data || []);
    setWithdrawals(withdrawalsResult.data || []);
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
      await loadWalletData(userData.user);
      setLoading(false);
    }

    initializePage();
  }, []);

  async function createWallet() {
    if (!user) return;

    setCreatingWallet(true);

    const { error } = await supabase.from("wallets").insert({
      user_id: user.id,
      balance: 0,
      pending_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_withdrawn: 0,
      status: "active",
    });

    if (error) {
      alert(error.message);
      setCreatingWallet(false);
      return;
    }

    await loadWalletData(user);
    setCreatingWallet(false);
  }

  async function requestWithdrawal(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !wallet) return;

    const amount = Number(withdrawAmount || 0);

    if (wallet.status !== "active") {
      alert("Wallet is frozen.");
      return;
    }

    if (amount <= 0) {
      alert("Withdrawal amount must be greater than 0.");
      return;
    }

    if (amount > Number(wallet.balance || 0)) {
      alert("Insufficient wallet balance.");
      return;
    }

    if (!payoutMethod.trim()) {
      alert("Please select payout method.");
      return;
    }

    if (!payoutAccountName.trim()) {
      alert("Please enter payout account name.");
      return;
    }

    if (!payoutAccountNumber.trim()) {
      alert("Please enter payout account number.");
      return;
    }

    setRequestingWithdraw(true);

    const balanceBefore = Number(wallet.balance || 0);
    const balanceAfter = balanceBefore - amount;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({
        balance: balanceAfter,
        total_withdrawn: Number(wallet.total_withdrawn || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("user_id", user.id);

    if (walletError) {
      alert(walletError.message);
      setRequestingWithdraw(false);
      return;
    }

    const { error: withdrawError } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        amount,
        payout_method: payoutMethod,
        payout_account_name: payoutAccountName.trim(),
        payout_account_number: payoutAccountNumber.trim(),
        payout_note: payoutNote.trim() || null,
        status: "pending",
      });

    if (withdrawError) {
      alert(withdrawError.message);
      setRequestingWithdraw(false);
      return;
    }

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: "withdraw_request",
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        order_id: null,
        description: `Withdrawal request via ${payoutMethod}`,
        status: "pending",
      });

    if (transactionError) {
      alert(transactionError.message);
      setRequestingWithdraw(false);
      return;
    }

    setWithdrawAmount("");
    setPayoutMethod("Bank Transfer");
    setPayoutAccountName("");
    setPayoutAccountNumber("");
    setPayoutNote("");

    await loadWalletData(user);
    setRequestingWithdraw(false);
    alert("Withdrawal request submitted.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading wallet...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>

          <p className="mt-4 text-gray-400">
            Please login first to access wallet.
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

  if (!wallet) {
    return (
      <main className="min-h-screen bg-[#020617] px-6 py-20 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-10 text-center shadow-2xl shadow-black/30">
          <h1 className="text-5xl font-black">Create Wallet</h1>

          <p className="mt-5 text-gray-300">
            Your wallet stores seller earnings, withdrawal history, and future
            buyer balance features.
          </p>

          <button
            onClick={createWallet}
            disabled={creatingWallet}
            className="mt-8 rounded-full bg-cyan-400 px-8 py-4 font-black text-black hover:bg-cyan-300 disabled:opacity-60"
          >
            {creatingWallet ? "Creating Wallet..." : "Create My Wallet"}
          </button>
        </div>
      </main>
    );
  }

  const balance = Number(wallet.balance || 0);
  const pendingBalance = Number(wallet.pending_balance || 0);
  const totalEarned = Number(wallet.total_earned || 0);
  const totalSpent = Number(wallet.total_spent || 0);
  const totalWithdrawn = Number(wallet.total_withdrawn || 0);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Wallet System V1
            </p>

            <h1 className="text-5xl font-black md:text-7xl">My Wallet</h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              Manage your marketplace balance, seller earnings, withdrawals,
              and wallet transactions.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${
                  wallet.status === "active"
                    ? "border-green-400/20 bg-green-400/10 text-green-300"
                    : "border-red-400/20 bg-red-400/10 text-red-300"
                }`}
              >
                Wallet {wallet.status}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                Wallet #{wallet.id}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/my-orders"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              My Orders
            </Link>

            <Link
              href="/seller"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Seller Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <p className="text-sm text-gray-300">Available Balance</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {formatPrice(balance)}
            </p>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
            <p className="text-sm text-gray-300">Pending Balance</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {formatPrice(pendingBalance)}
            </p>
          </div>

          <div className="rounded-3xl border border-green-400/20 bg-green-400/10 p-6">
            <p className="text-sm text-gray-300">Total Earned</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {formatPrice(totalEarned)}
            </p>
          </div>

          <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-6">
            <p className="text-sm text-gray-300">Total Spent</p>
            <p className="mt-2 text-3xl font-black text-red-300">
              {formatPrice(totalSpent)}
            </p>
          </div>

          <div className="rounded-3xl border border-purple-400/20 bg-purple-400/10 p-6">
            <p className="text-sm text-gray-300">Total Withdrawn</p>
            <p className="mt-2 text-3xl font-black text-purple-300">
              {formatPrice(totalWithdrawn)}
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Transactions</h2>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transactions by type, status, order ID, or description..."
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />

              <div className="flex flex-wrap gap-2">
                {transactionTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      activeType === type
                        ? "bg-cyan-400 text-black"
                        : "border border-white/10 bg-black/30 text-gray-300 hover:border-cyan-400 hover:text-white"
                    }`}
                  >
                    {type === "all" ? "All" : type}
                  </button>
                ))}
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-gray-400">
                No wallet transactions found.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-black">
                            {transaction.type}
                          </p>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                              transaction.status
                            )}`}
                          >
                            {transaction.status}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-400">
                          {transaction.description || "No description."}
                        </p>

                        <p className="mt-2 text-xs text-gray-500">
                          {formatDate(transaction.created_at)}
                          {transaction.order_id
                            ? ` · Order #${transaction.order_id}`
                            : ""}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p
                          className={`text-2xl font-black ${getTransactionClass(
                            transaction.type
                          )}`}
                        >
                          {formatPrice(transaction.amount)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Balance: {formatPrice(transaction.balance_after)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <form
              onSubmit={requestWithdrawal}
              className="rounded-3xl border border-green-400/20 bg-green-400/10 p-7 shadow-2xl shadow-black/30"
            >
              <h2 className="text-3xl font-black text-green-300">
                Request Withdrawal
              </h2>

              <p className="mt-2 text-sm text-gray-300">
                Withdraw your available balance to bank or e-wallet.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="50000"
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Payout Method
                  </label>
                  <select
                    value={payoutMethod}
                    onChange={(event) => setPayoutMethod(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-green-400"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="DANA">DANA</option>
                    <option value="OVO">OVO</option>
                    <option value="GoPay">GoPay</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="PayPal">PayPal</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Account Name
                  </label>
                  <input
                    value={payoutAccountName}
                    onChange={(event) =>
                      setPayoutAccountName(event.target.value)
                    }
                    placeholder="Your bank/e-wallet account name"
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Account Number / Wallet ID
                  </label>
                  <input
                    value={payoutAccountNumber}
                    onChange={(event) =>
                      setPayoutAccountNumber(event.target.value)
                    }
                    placeholder="Account number or wallet phone number"
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Note
                  </label>
                  <textarea
                    value={payoutNote}
                    onChange={(event) => setPayoutNote(event.target.value)}
                    placeholder="Optional payout note."
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={requestingWithdraw || balance <= 0}
                className="mt-6 w-full rounded-2xl bg-green-400 py-4 font-black text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingWithdraw ? "Submitting..." : "Request Withdrawal"}
              </button>
            </form>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black">Withdrawals</h2>

              {withdrawals.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                  No withdrawal requests yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {withdrawals.slice(0, 6).map((withdrawal) => (
                    <div
                      key={withdrawal.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xl font-black text-green-300">
                          {formatPrice(withdrawal.amount)}
                        </p>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                            withdrawal.status
                          )}`}
                        >
                          {withdrawal.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-400">
                        {withdrawal.payout_method} ·{" "}
                        {withdrawal.payout_account_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(withdrawal.created_at)}
                      </p>

                      {withdrawal.admin_note && (
                        <p className="mt-3 text-sm text-gray-300">
                          Admin Note: {withdrawal.admin_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}