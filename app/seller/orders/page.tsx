"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/createNotification";

type Order = {
  id: number;
  buyer_id: string | null;
  buyer: string | null;
  seller_id: string | null;
  product_id: number | null;
  product: string | null;
  price: string | number | null;
  quantity: number | null;
  total_price: string | number | null;
  category_id: number | null;
  category_name: string | null;
  game_master_id: number | null;
  game_name: string | null;
  status: string | null;
  payment_proof: string | null;
  payment_image: string | null;
  created_at: string;
};

type Wallet = {
  id: number;
  user_id: string;
  balance: string | number;
  pending_balance: string | number;
  total_earned: string | number;
  total_spent: string | number;
  total_withdrawn: string | number;
  status: string;
};

const orderStatuses = [
  "all",
  "Pending Payment",
  "Payment Verification",
  "Processing",
  "Completed",
  "Cancelled",
];

const statusOptions = [
  "Pending Payment",
  "Payment Verification",
  "Processing",
  "Completed",
  "Cancelled",
];

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

function getStatusClass(status: string | null) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "Completed") {
    return "border-green-400/20 bg-green-400/10 text-green-300";
  }

  if (normalizedStatus === "Processing") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  }

  if (normalizedStatus === "Cancelled") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  if (normalizedStatus === "Payment Verification") {
    return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  }

  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
}

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);

  if (!Number.isFinite(price)) {
    return "Rp 0";
  }

  return `Rp ${price.toLocaleString("id-ID")}`;
}

function getBuyerNotificationMessage(status: string, order: Order) {
  if (status === "Payment Verification") {
    return `Your payment proof for order #${order.id} is waiting for verification.`;
  }

  if (status === "Processing") {
    return `Your order #${order.id} is now being processed by the seller.`;
  }

  if (status === "Completed") {
    return `Your order #${order.id} has been completed successfully. You can now leave a review.`;
  }

  if (status === "Cancelled") {
    return `Your order #${order.id} was cancelled by the seller.`;
  }

  return `Your order #${order.id} status was updated to ${status}.`;
}

export default function SellerOrdersV3WalletReleasePage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [messagingOrderId, setMessagingOrderId] = useState<number | null>(null);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const normalizedStatus = normalizeStatus(order.status);

      const matchesStatus =
        activeStatus === "all" || normalizedStatus === activeStatus;

      const matchesSearch =
        !query ||
        (order.product || "").toLowerCase().includes(query) ||
        (order.buyer || "").toLowerCase().includes(query) ||
        (order.category_name || "").toLowerCase().includes(query) ||
        (order.game_name || "").toLowerCase().includes(query) ||
        String(order.id).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, activeStatus, search]);

  const totalRevenue = useMemo(() => {
    return orders
      .filter((order) => normalizeStatus(order.status) === "Completed")
      .reduce(
        (sum, order) => sum + Number(order.total_price || order.price || 0),
        0
      );
  }, [orders]);

  const pendingPaymentCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Pending Payment"
  ).length;

  const verificationCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Payment Verification"
  ).length;

  const processingCount = orders.filter(
    (order) => normalizeStatus(order.status) === "Processing"
  ).length;

  async function loadSellerOrders(userId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("seller_id", userId)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(data || []);
  }

  async function ensureSellerWallet(sellerId: string) {
    const { data: existingWallet, error: walletFetchError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", sellerId)
      .maybeSingle();

    if (walletFetchError) {
      throw new Error(walletFetchError.message);
    }

    if (existingWallet) {
      return existingWallet as Wallet;
    }

    const { data: createdWallet, error: walletCreateError } = await supabase
      .from("wallets")
      .insert({
        user_id: sellerId,
        balance: 0,
        pending_balance: 0,
        total_earned: 0,
        total_spent: 0,
        total_withdrawn: 0,
        status: "active",
      })
      .select("*")
      .single();

    if (walletCreateError) {
      throw new Error(walletCreateError.message);
    }

    return createdWallet as Wallet;
  }

  async function hasExistingReleaseTransaction(walletId: number, orderId: number) {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("wallet_id", walletId)
      .eq("order_id", orderId)
      .eq("type", "sale_release")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }

  async function releaseSellerEarning(order: Order) {
    if (!order.seller_id) return;

    const wallet = await ensureSellerWallet(order.seller_id);

    if (wallet.status !== "active") {
      throw new Error("Seller wallet is frozen.");
    }

    const alreadyReleased = await hasExistingReleaseTransaction(
      wallet.id,
      order.id
    );

    if (alreadyReleased) {
      return;
    }

    const earningAmount = Number(order.total_price || order.price || 0);

    if (earningAmount <= 0) {
      return;
    }

    const balanceBefore = Number(wallet.balance || 0);
    const balanceAfter = balanceBefore + earningAmount;

    const { error: walletUpdateError } = await supabase
      .from("wallets")
      .update({
        balance: balanceAfter,
        total_earned: Number(wallet.total_earned || 0) + earningAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("user_id", order.seller_id);

    if (walletUpdateError) {
      throw new Error(walletUpdateError.message);
    }

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: order.seller_id,
        type: "sale_release",
        amount: earningAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        order_id: order.id,
        description: `Seller earning released from completed order #${order.id}`,
        status: "completed",
      });

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    await createNotification({
      userId: order.seller_id,
      type: "payment",
      title: "Seller Earning Released",
      message: `${formatPrice(
        earningAmount
      )} has been added to your wallet from completed order #${order.id}.`,
      linkUrl: "/wallet",
    });
  }

  useEffect(() => {
    async function initializePage() {
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
      await loadSellerOrders(userData.user.id);
      setLoading(false);
    }

    initializePage();
  }, []);

  async function updateOrderStatus(order: Order, newStatus: string) {
    if (!user) return;

    const previousStatus = normalizeStatus(order.status);

    if (previousStatus === newStatus) {
      return;
    }

    setUpdatingOrderId(order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        status: newStatus,
      })
      .eq("id", order.id)
      .eq("seller_id", user.id);

    if (error) {
      alert(error.message);
      setUpdatingOrderId(null);
      return;
    }

    if (newStatus === "Completed") {
      try {
        await releaseSellerEarning({
          ...order,
          status: newStatus,
        });
      } catch (releaseError) {
        console.error("Seller earning release error:", releaseError);
        alert(
          releaseError instanceof Error
            ? releaseError.message
            : "Order completed, but failed to release wallet earning."
        );
      }
    }

    await createNotification({
      userId: order.buyer_id,
      type: "order",
      title: `Order ${newStatus}`,
      message: getBuyerNotificationMessage(newStatus, order),
      linkUrl:
        newStatus === "Completed"
          ? `/review/${order.id}`
          : `/order/${order.id}`,
    });

    if (newStatus === "Processing") {
      await createNotification({
        userId: order.seller_id,
        type: "seller",
        title: "Order Processing Started",
        message: `You started processing order #${order.id}.`,
        linkUrl: "/seller/orders",
      });
    }

    if (newStatus === "Completed") {
      await createNotification({
        userId: order.seller_id,
        type: "seller",
        title: "Order Completed",
        message: `Order #${order.id} has been completed and the earning has been released to your wallet.`,
        linkUrl: "/wallet",
      });
    }

    if (newStatus === "Cancelled") {
      await createNotification({
        userId: order.seller_id,
        type: "seller",
        title: "Order Cancelled",
        message: `You cancelled order #${order.id}.`,
        linkUrl: "/seller/orders",
      });
    }

    await loadSellerOrders(user.id);
    setUpdatingOrderId(null);
  }


  async function handleMessageBuyer(order: Order) {
    if (!user) return;

    if (!order.buyer_id || !order.seller_id) {
      alert("Buyer or seller not found.");
      return;
    }

    if (order.seller_id !== user.id) {
      alert("You are not allowed to message this buyer.");
      return;
    }

    if (order.buyer_id === user.id) {
      alert("You cannot message yourself.");
      return;
    }

    try {
      setMessagingOrderId(order.id);

      const { data: existingRoom, error: existingRoomError } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("buyer_id", order.buyer_id)
        .eq("seller_id", order.seller_id)
        .eq("order_id", order.id)
        .maybeSingle();

      if (existingRoomError) {
        alert(existingRoomError.message);
        setMessagingOrderId(null);
        return;
      }

      let roomId = existingRoom?.id;

      if (!existingRoom) {
        const { data: createdRoom, error: createRoomError } = await supabase
          .from("chat_rooms")
          .insert({
            buyer_id: order.buyer_id,
            seller_id: order.seller_id,
            product_id: order.product_id,
            order_id: order.id,
            last_message: `Started conversation about order #${order.id}`,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createRoomError) {
          alert(createRoomError.message);
          setMessagingOrderId(null);
          return;
        }

        roomId = createdRoom.id;
      }

      window.location.href = `/messages?room=${roomId}`;
    } catch (error) {
      console.error("Message buyer error:", error);
      alert("Failed to open buyer chat.");
      setMessagingOrderId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading seller orders...
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
            Please login first to manage seller orders.
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
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Seller Dashboard
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Seller Orders</h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Manage buyer orders, verify payments, update delivery status, and
              automatically release seller earnings to wallet when completed.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Logged in as {user.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/wallet"
              className="inline-flex h-12 items-center justify-center rounded-full border border-green-400 px-6 font-bold text-green-300 transition hover:bg-green-400 hover:text-black"
            >
              Wallet
            </Link>

            <Link
              href="/seller/products"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              Products
            </Link>

            <Link
              href="/notifications"
              className="inline-flex h-12 items-center justify-center rounded-full border border-yellow-400 px-6 font-bold text-yellow-300 transition hover:bg-yellow-400 hover:text-black"
            >
              Notifications
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

      <section className="px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total Orders</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {orders.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Pending Payment</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {pendingPaymentCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Verification</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {verificationCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Processing</p>
            <p className="mt-2 text-3xl font-black text-blue-300">
              {processingCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Completed Revenue</p>
            <p className="mt-2 text-2xl font-black text-green-300">
              {formatPrice(totalRevenue)}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product, buyer, category, game, or order ID..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-3">
            {orderStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  activeStatus === status
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {status === "all" ? "All" : status}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
            <h2 className="text-3xl font-black">No seller orders found.</h2>

            <p className="mt-3 text-gray-400">
              Buyer orders will appear here after checkout.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => {
              const normalizedStatus = normalizeStatus(order.status);
              const totalPrice = Number(order.total_price || order.price || 0);

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">
                          {order.product || "Unknown Product"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {normalizedStatus}
                        </span>
                      </div>

                      <p className="mt-3 text-3xl font-black text-cyan-300">
                        {formatPrice(totalPrice)}
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Order ID</p>
                          <p className="mt-1 font-bold">#{order.id}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Buyer</p>
                          <p className="mt-1 break-words font-bold">
                            {order.buyer || order.buyer_id || "Unknown Buyer"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Category</p>
                          <p className="mt-1 font-bold">
                            {order.category_name || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Game</p>
                          <p className="mt-1 font-bold">
                            {order.game_name || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="mt-1 font-bold">
                            {order.quantity || 1}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="mt-1 font-bold">
                            {order.created_at
                              ? new Date(order.created_at).toLocaleString()
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {order.payment_proof && (
                        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-sm font-black text-cyan-300">
                            Payment Details
                          </p>

                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-300">
                            {order.payment_proof}
                          </p>
                        </div>
                      )}

                      {order.payment_image && (
                        <div className="mt-5">
                          <p className="mb-3 font-bold text-cyan-300">
                            Payment Proof Image
                          </p>

                          <a
                            href={order.payment_image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={order.payment_image}
                              alt="Payment Proof"
                              className="h-40 w-72 rounded-xl border border-white/10 object-cover transition hover:scale-105"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-gray-400">
                        Update Status
                      </label>

                      <select
                        value={normalizedStatus}
                        onChange={(event) =>
                          updateOrderStatus(order, event.target.value)
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl border border-white/10 bg-black px-4 py-3 font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          updateOrderStatus(order, "Payment Verification")
                        }
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
                      >
                        Mark Verification
                      </button>

                      <button
                        onClick={() => updateOrderStatus(order, "Processing")}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-blue-500 px-5 py-3 font-black text-white hover:bg-blue-400 disabled:opacity-60"
                      >
                        Mark Processing
                      </button>

                      <button
                        onClick={() => updateOrderStatus(order, "Completed")}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-green-500 px-5 py-3 font-black text-white hover:bg-green-400 disabled:opacity-60"
                      >
                        Mark Completed + Release Wallet
                      </button>

                      <button
                        onClick={() => updateOrderStatus(order, "Cancelled")}
                        disabled={updatingOrderId === order.id}
                        className="rounded-2xl bg-red-500 px-5 py-3 font-black text-white hover:bg-red-400 disabled:opacity-60"
                      >
                        Cancel Order
                      </button>

                      <button
                        onClick={() => handleMessageBuyer(order)}
                        disabled={messagingOrderId === order.id || !order.buyer_id}
                        className="rounded-2xl border border-yellow-400 px-5 py-3 font-black text-yellow-300 transition hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {messagingOrderId === order.id
                          ? "Opening Chat..."
                          : "💬 Message Buyer"}
                      </button>

                      {order.product_id && (
                        <Link
                          href={`/product/${order.product_id}`}
                          className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                        >
                          View Product
                        </Link>
                      )}

                      <Link
                        href={`/order/${order.id}`}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-center font-black text-gray-300 transition hover:bg-white hover:text-black"
                      >
                        View Order Detail
                      </Link>

                      {updatingOrderId === order.id && (
                        <p className="text-center text-sm text-gray-400">
                          Updating order...
                        </p>
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