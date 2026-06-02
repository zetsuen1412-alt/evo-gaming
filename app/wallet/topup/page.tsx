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

type WalletTopup = {
  id: number;
  user_id: string;
  wallet_id: number;
  amount: string | number;
  payment_method: string;
  sender_name: string | null;
  sender_account: string | null;
  payment_note: string | null;
  payment_image: string | null;
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

function getStatusClass(status: string) {
  if (status === "approved") return "border-green-400/20 bg-green-400/10 text-green-300";
  if (status === "pending") return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  if (status === "rejected" || status === "cancelled") return "border-red-400/20 bg-red-400/10 text-red-300";
  return "border-white/10 bg-white/[0.04] text-gray-300";
}

function createSafeFileName(fileName: string) {
  const extension = fileName.split(".").pop() || "jpg";

  const baseName = fileName
    .replace(`.${extension}`, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseName || "wallet-topup"}.${extension}`;
}

export default function WalletTopUpPageV1() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [topups, setTopups] = useState<WalletTopup[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");

  const pendingTopups = useMemo(() => {
    return topups.filter((item) => item.status === "pending");
  }, [topups]);

  const approvedTopups = useMemo(() => {
    return topups.filter((item) => item.status === "approved");
  }, [topups]);

  async function loadWalletAndTopups(currentUser: User) {
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
      setTopups([]);
      return;
    }

    const { data: topupData, error: topupError } = await supabase
      .from("wallet_topups")
      .select("*")
      .eq("wallet_id", walletData.id)
      .order("id", { ascending: false });

    if (topupError) {
      alert(topupError.message);
      return;
    }

    setTopups(topupData || []);
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
      await loadWalletAndTopups(userData.user);
      setLoading(false);
    }

    initializePage();
  }, []);

  useEffect(() => {
    return () => {
      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
      }
    };
  }, [proofPreviewUrl]);

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

    await loadWalletAndTopups(user);
    setCreatingWallet(false);
  }

  function handleProofFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setProofFile(null);
      setProofPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Payment proof image must be less than 5MB.");
      event.target.value = "";
      return;
    }

    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }

    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadTopupProof(file: File, currentUser: User) {
    const safeFileName = createSafeFileName(file.name);

    const filePath = `${currentUser.id}/wallet-topup-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async function submitTopup(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !wallet) return;

    if (wallet.status !== "active") {
      alert("Wallet is frozen.");
      return;
    }

    const topupAmount = Number(amount || 0);

    if (topupAmount <= 0) {
      alert("Top up amount must be greater than 0.");
      return;
    }

    if (!paymentMethod.trim()) {
      alert("Please select payment method.");
      return;
    }

    if (!senderName.trim()) {
      alert("Please enter sender name.");
      return;
    }

    if (!proofFile) {
      alert("Please upload payment proof image.");
      return;
    }

    try {
      setSubmitting(true);

      const uploadedProofUrl = await uploadTopupProof(proofFile, user);

      const { error } = await supabase.from("wallet_topups").insert({
        user_id: user.id,
        wallet_id: wallet.id,
        amount: topupAmount,
        payment_method: paymentMethod,
        sender_name: senderName.trim(),
        sender_account: senderAccount.trim() || null,
        payment_note: paymentNote.trim() || null,
        payment_image: uploadedProofUrl,
        status: "pending",
      });

      if (error) {
        alert(error.message);
        setSubmitting(false);
        return;
      }

      setAmount("");
      setPaymentMethod("Bank Transfer");
      setSenderName("");
      setSenderAccount("");
      setPaymentNote("");
      setProofFile(null);
      setProofPreviewUrl("");

      await loadWalletAndTopups(user);

      alert("Top up request submitted. Waiting for admin approval.");
      setSubmitting(false);
    } catch (error) {
      console.error("Wallet top up error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit wallet top up."
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading wallet top up...
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
            Please login first to top up wallet.
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
            Create your wallet first before topping up balance.
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

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
              Wallet Top Up V1
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Top Up Wallet</h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              Add balance to your ComePlayers wallet using manual payment proof.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
                Balance: {formatPrice(wallet.balance)}
              </span>

              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
                Pending: {pendingTopups.length}
              </span>
            </div>
          </div>

          <Link
            href="/wallet"
            className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Wallet
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={submitTopup}
          className="rounded-3xl border border-green-400/20 bg-green-400/10 p-7 shadow-2xl shadow-black/30"
        >
          <h2 className="text-3xl font-black text-green-300">
            Submit Top Up Request
          </h2>

          <p className="mt-2 text-sm text-gray-300">
            Transfer the amount first, then upload your payment proof.
          </p>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Top Up Amount
              </label>

              <input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="100000"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
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
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Sender Name
              </label>

              <input
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                placeholder="Name on bank/e-wallet account"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Sender Account / Wallet ID
              </label>

              <input
                value={senderAccount}
                onChange={(event) => setSenderAccount(event.target.value)}
                placeholder="Account number, phone, wallet ID"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Upload Payment Proof Image
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleProofFileChange}
              className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-black px-5 py-4 text-sm text-gray-300 outline-none file:mr-4 file:rounded-full file:border-0 file:bg-green-400 file:px-5 file:py-2 file:font-black file:text-black hover:file:bg-green-300"
            />

            <p className="mt-2 text-xs text-gray-500">
              Supported: JPG, PNG, WEBP. Max 5MB.
            </p>
          </div>

          {proofPreviewUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-green-400/20 bg-black/30">
              <div className="flex max-h-[420px] items-center justify-center bg-black">
                <img
                  src={proofPreviewUrl}
                  alt="Top up proof preview"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>

              <div className="p-4">
                <p className="text-sm font-bold text-green-300">
                  Payment proof preview
                </p>
              </div>
            </div>
          )}

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Payment Note
            </label>

            <textarea
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              placeholder="Write transfer time, bank name, reference number, or additional notes."
              rows={5}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-green-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-2xl bg-green-400 py-4 text-lg font-black text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting Top Up..." : "Submit Top Up Request"}
          </button>
        </form>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Wallet Summary</h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Available Balance</p>
                <p className="mt-2 text-3xl font-black text-cyan-300">
                  {formatPrice(wallet.balance)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Pending Requests</p>
                <p className="mt-2 text-3xl font-black text-yellow-300">
                  {pendingTopups.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Approved Top Ups</p>
                <p className="mt-2 text-3xl font-black text-green-300">
                  {approvedTopups.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7">
            <h2 className="text-2xl font-black">Payment Destination</h2>

            <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div>
                <p className="text-sm text-gray-400">Bank</p>
                <p className="mt-1 text-xl font-black">BCA</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Account Number</p>
                <p className="mt-1 text-xl font-black text-cyan-300">
                  1234567890
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Account Name</p>
                <p className="mt-1 font-black">ComePlayers Official</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-300">
              Replace this destination later with your real payment account or
              Midtrans integration.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
            <h2 className="text-3xl font-black">Top Up History</h2>

            {topups.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-400">
                No top up requests yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {topups.slice(0, 8).map((topup) => (
                  <div
                    key={topup.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xl font-black text-green-300">
                        {formatPrice(topup.amount)}
                      </p>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                          topup.status
                        )}`}
                      >
                        {topup.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-400">
                      {topup.payment_method} · {topup.sender_name || "-"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(topup.created_at)}
                    </p>

                    {topup.payment_image && (
                      <a
                        href={topup.payment_image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block text-sm font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        View Proof →
                      </a>
                    )}

                    {topup.admin_note && (
                      <p className="mt-3 text-sm text-gray-300">
                        Admin Note: {topup.admin_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}