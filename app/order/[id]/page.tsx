"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";

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

type Product = {
  id: number;
  title: string;
  image_url: string | null;
  seller_name: string | null;
};

type SellerProfile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_name: string | null;
  seller_status: string | null;
  avatar_url: string | null;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
};


type Dispute = {
  id: number;
  order_id: number;
  buyer_id: string;
  seller_id: string;
  opened_by: string | null;
  reason: string;
  description: string | null;
  status: string;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
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

export default function OrderDetailV2Page() {
  const { formatPrice, currency } = useCurrency();
  const params = useParams();
  const orderId = String(params.id || "");

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const [disputeReason, setDisputeReason] = useState("Delivery Issue");
  const [disputeDescription, setDisputeDescription] = useState("");

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(
    null
  );
  const [gameMaster, setGameMaster] = useState<GameMaster | null>(null);
  const [existingDispute, setExistingDispute] = useState<Dispute | null>(null);

  const normalizedStatus = useMemo(() => {
    return normalizeStatus(order?.status || null);
  }, [order]);

  const totalAmount = useMemo(() => {
    return Number(order?.total_price || order?.price || 0);
  }, [order]);

  const displayImage = useMemo(() => {
    return product?.image_url || gameMaster?.image_url || null;
  }, [product, gameMaster]);

  const sellerDisplayName = useMemo(() => {
    return (
      sellerProfile?.seller_name ||
      sellerProfile?.username ||
      product?.seller_name ||
      order?.seller_id ||
      "Unknown Seller"
    );
  }, [sellerProfile, product, order]);

  const canPay = useMemo(() => {
    return (
      normalizedStatus === "Pending Payment" ||
      normalizedStatus === "Payment Verification"
    );
  }, [normalizedStatus]);

  const canReview = useMemo(() => {
    return normalizedStatus === "Completed";
  }, [normalizedStatus]);

  useEffect(() => {
    if (orderId) {
      initializePage();
    }
  }, [orderId]);

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

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", Number(orderId))
      .maybeSingle();

    if (orderError) {
      alert(orderError.message);
      setLoading(false);
      return;
    }

    if (!orderData) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const isBuyer =
      orderData.buyer_id === userData.user.id ||
      orderData.buyer === userData.user.email;

    const isSeller = orderData.seller_id === userData.user.id;

    if (!isBuyer && !isSeller) {
      alert("You are not allowed to access this order.");
      window.location.href = "/my-orders";
      return;
    }

    setOrder(orderData);

    if (orderData.product_id) {
      const { data: productData } = await supabase
        .from("products")
        .select("id,title,image_url,seller_name")
        .eq("id", orderData.product_id)
        .maybeSingle();

      setProduct(productData || null);
    }

    if (orderData.seller_id) {
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("id,email,username,seller_name,seller_status,avatar_url")
        .eq("id", orderData.seller_id)
        .maybeSingle();

      setSellerProfile(sellerData || null);
    }

    if (orderData.game_master_id) {
      const { data: gameData } = await supabase
        .from("game_master")
        .select("id,name,slug,image_url")
        .eq("id", orderData.game_master_id)
        .maybeSingle();

      setGameMaster(gameData || null);
    }

    const { data: disputeData, error: disputeError } = await supabase
      .from("disputes")
      .select("*")
      .eq("order_id", orderData.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (disputeError) {
      console.error("Load dispute error:", disputeError.message);
      setExistingDispute(null);
    } else {
      setExistingDispute(disputeData || null);
    }

    setLoading(false);
  }

  async function handleMessageOrder() {
    if (!user || !order) return;

    if (!order.buyer_id || !order.seller_id) {
      alert("Buyer or seller not found.");
      return;
    }

    const isSeller = order.seller_id === user.id;
    const isBuyer = order.buyer_id === user.id || order.buyer === user.email;

    if (!isBuyer && !isSeller) {
      alert("You are not allowed to message this order.");
      return;
    }

    const buyerId = order.buyer_id;
    const sellerId = order.seller_id;
    const receiverId = isSeller ? buyerId : sellerId;

    if (receiverId === user.id) {
      alert("You cannot message yourself.");
      return;
    }

    try {
      setMessaging(true);

      const { data: existingRoom, error: existingRoomError } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("buyer_id", buyerId)
        .eq("seller_id", sellerId)
        .eq("order_id", order.id)
        .maybeSingle();

      if (existingRoomError) {
        alert(existingRoomError.message);
        setMessaging(false);
        return;
      }

      let roomId = existingRoom?.id;

      if (!existingRoom) {
        const { data: createdRoom, error: createRoomError } = await supabase
          .from("chat_rooms")
          .insert({
            buyer_id: buyerId,
            seller_id: sellerId,
            product_id: order.product_id,
            order_id: order.id,
            last_message: `Started conversation about order #${order.id}`,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createRoomError) {
          alert(createRoomError.message);
          setMessaging(false);
          return;
        }

        roomId = createdRoom.id;
      }

      window.location.href = `/messages?room=${roomId}`;
    } catch (error) {
      console.error("Message order error:", error);
      alert("Failed to open order chat.");
    } finally {
      setMessaging(false);
    }
  }

  async function submitDispute(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !order) return;

    if (!order.buyer_id || !order.seller_id) {
      alert("Buyer or seller not found.");
      return;
    }

    const isBuyer = order.buyer_id === user.id || order.buyer === user.email;
    const isSeller = order.seller_id === user.id;

    if (!isBuyer && !isSeller) {
      alert("You are not allowed to open dispute for this order.");
      return;
    }

    if (existingDispute) {
      alert("A dispute already exists for this order.");
      setShowDisputeModal(false);
      return;
    }

    if (!disputeReason.trim()) {
      alert("Please select dispute reason.");
      return;
    }

    if (!disputeDescription.trim()) {
      alert("Please describe the problem.");
      return;
    }

    try {
      setSubmittingDispute(true);

      const { data: duplicateDispute } = await supabase
        .from("disputes")
        .select("*")
        .eq("order_id", order.id)
        .maybeSingle();

      if (duplicateDispute) {
        setExistingDispute(duplicateDispute);
        alert("A dispute already exists for this order.");
        setShowDisputeModal(false);
        setSubmittingDispute(false);
        return;
      }

      const { data: createdDispute, error: disputeError } = await supabase
        .from("disputes")
        .insert({
          order_id: order.id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          opened_by: user.id,
          reason: disputeReason.trim(),
          description: disputeDescription.trim(),
          status: "open",
        })
        .select("*")
        .single();

      if (disputeError) {
        alert(disputeError.message);
        setSubmittingDispute(false);
        return;
      }

      setExistingDispute(createdDispute);

      const counterpartUserId = isBuyer ? order.seller_id : order.buyer_id;
      const notificationRows = [
        {
          user_id: counterpartUserId,
          type: "dispute",
          title: `Dispute Opened for Order #${order.id}`,
          message: `${user.email || "A user"} opened a dispute: ${disputeReason.trim()}`,
          link_url: `/order/${order.id}`,
          is_read: false,
        },
      ];

      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("role", "admin");

      (adminProfiles || []).forEach((admin) => {
        notificationRows.push({
          user_id: admin.id,
          type: "dispute",
          title: `New Dispute #${createdDispute.id}`,
          message: `Order #${order.id} needs admin review: ${disputeReason.trim()}`,
          link_url: "/admin/disputes",
          is_read: false,
        });
      });

      await supabase.from("notifications").insert(notificationRows);

      setShowDisputeModal(false);
      setDisputeDescription("");
      alert("Dispute opened successfully.");
    } catch (error) {
      console.error("Open dispute error:", error);
      alert("Failed to open dispute.");
    } finally {
      setSubmittingDispute(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading order detail...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Login Required
          </h1>

          <p className="mt-4 text-gray-400">
            Please login first to view this order.
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

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Order Not Found</h1>

          <p className="mt-4 text-gray-300">
            This order does not exist or has been removed.
          </p>

          <Link
            href="/my-orders"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Open My Orders
          </Link>
        </div>
      </main>
    );
  }

  const isSeller = order.seller_id === user.id;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Order Detail
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Order #{order.id}
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Track payment, seller verification, and delivery progress for this
              order.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${getStatusClass(
                  order.status
                )}`}
              >
                {normalizedStatus}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-gray-300">
                {order.category_name || "Marketplace"} /{" "}
                {order.game_name || gameMaster?.name || "Game"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={isSeller ? "/seller/orders" : "/my-orders"}
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              {isSeller ? "Seller Orders" : "My Orders"}
            </Link>

            {order.product_id && (
              <Link
                href={`/product/${order.product_id}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
              >
                View Product
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
            <div className="flex h-72 items-center justify-center bg-black">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={order.product || "Order product"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-7xl">🎮</span>
              )}
            </div>

            <div className="p-7">
              <p className="text-sm font-black text-cyan-300">
                {order.category_name || "Marketplace"} /{" "}
                {order.game_name || gameMaster?.name || "Game"}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {order.product || product?.title || "Unknown Product"}
              </h2>

              <p className="mt-4 text-4xl font-black text-cyan-300">
                {formatPrice(totalAmount)}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Quantity</p>
                  <p className="mt-1 font-bold">{order.quantity || 1}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Buyer</p>
                  <p className="mt-1 break-words font-bold">
                    {order.buyer || order.buyer_id || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">Seller</p>
                  <p className="mt-1 break-words font-bold">
                    {sellerDisplayName}
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
            </div>
          </div>

          {order.payment_proof && (
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black text-cyan-300">
                Payment Details
              </h2>

              <p className="mt-5 whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-gray-300">
                {order.payment_proof}
              </p>
            </div>
          )}

          {order.payment_image && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
              <h2 className="text-3xl font-black">Payment Proof Image</h2>

              <a
                href={order.payment_image}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <img
                  src={order.payment_image}
                  alt="Payment Proof"
                  className="max-h-[520px] w-full object-contain"
                />
              </a>
            </div>
          )}
        </div>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Order Status</h2>

            <div
              className={`mt-5 rounded-2xl border p-5 ${getStatusClass(
                order.status
              )}`}
            >
              <p className="text-2xl font-black">{normalizedStatus}</p>
            </div>

            <div className="mt-6 space-y-4">
              <div
                className={`rounded-2xl border p-4 ${
                  [
                    "Pending Payment",
                    "Payment Verification",
                    "Processing",
                    "Completed",
                  ].includes(normalizedStatus)
                    ? "border-cyan-400/20 bg-cyan-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-cyan-300">1. Order Created</p>
                <p className="mt-1 text-sm text-gray-400">
                  Buyer created checkout order.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  ["Payment Verification", "Processing", "Completed"].includes(
                    normalizedStatus
                  )
                    ? "border-yellow-400/20 bg-yellow-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-yellow-300">
                  2. Payment Submitted
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Buyer submitted payment proof.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  ["Processing", "Completed"].includes(normalizedStatus)
                    ? "border-blue-400/20 bg-blue-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-blue-300">3. Processing</p>
                <p className="mt-1 text-sm text-gray-400">
                  Seller is processing the order.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  normalizedStatus === "Completed"
                    ? "border-green-400/20 bg-green-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-black text-green-300">4. Completed</p>
                <p className="mt-1 text-sm text-gray-400">
                  Order has been completed.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">
            <h2 className="text-2xl font-black">Actions</h2>

            <div className="mt-5 grid gap-3">
              {canPay && !isSeller && (
                <Link
                  href={`/payment?order=${order.id}`}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-black transition hover:bg-cyan-300"
                >
                  Continue Payment
                </Link>
              )}

              {canReview && !isSeller && (
                <Link
                  href={`/review/${order.id}`}
                  className="rounded-2xl bg-yellow-400 px-5 py-3 text-center font-black text-black transition hover:bg-yellow-300"
                >
                  Leave Review
                </Link>
              )}

              <button
                onClick={handleMessageOrder}
                disabled={messaging}
                className="rounded-2xl border border-yellow-400 px-5 py-3 font-black text-yellow-300 transition hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {messaging
                  ? "Opening Chat..."
                  : isSeller
                  ? "💬 Message Buyer"
                  : "💬 Message Seller"}
              </button>

              {existingDispute ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4">
                  <p className="font-black text-red-300">
                    ⚠ Dispute #{existingDispute.id} Opened
                  </p>
                  <p className="mt-1 text-sm text-gray-300">
                    Status: {existingDispute.status}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="rounded-2xl border border-red-400 px-5 py-3 font-black text-red-300 transition hover:bg-red-400 hover:text-black"
                >
                  ⚠ Open Dispute
                </button>
              )}

              {order.seller_id && (
                <Link
                  href={`/seller-profile/${order.seller_id}`}
                  className="rounded-2xl border border-cyan-400 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                >
                  View Seller Profile
                </Link>
              )}

              <button
                onClick={() => alert("Support chat will be connected later.")}
                className="rounded-2xl border border-white/10 px-5 py-3 font-black text-gray-300 transition hover:bg-white hover:text-black"
              >
                Contact Support
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7">
            <h2 className="text-xl font-black text-yellow-300">
              Buyer Protection
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              Keep every transaction inside ComePlayers. Do not send payments or
              delivery information outside the platform.
            </p>
          </div>
        </aside>
      </section>
      {showDisputeModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-6 backdrop-blur-md">
          <form
            onSubmit={submitDispute}
            className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-[#111827] p-7 shadow-2xl shadow-black/80"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-3 inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-black text-red-300">
                  Dispute Center
                </p>

                <h2 className="text-3xl font-black text-white">
                  Open Dispute
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-400">
                  Use this only if there is a real problem with order #{order.id}.
                  Admin will review the case.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="text-2xl font-black text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Reason
                </label>
                <select
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-red-400"
                >
                  <option value="Delivery Issue">Delivery Issue</option>
                  <option value="Wrong Product">Wrong Product</option>
                  <option value="Product Not Received">Product Not Received</option>
                  <option value="Payment Issue">Payment Issue</option>
                  <option value="Seller Not Responding">Seller Not Responding</option>
                  <option value="Buyer Issue">Buyer Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Description
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(event) => setDisputeDescription(event.target.value)}
                  placeholder="Explain the problem clearly. Include timeline, proof, or what resolution you expect."
                  rows={7}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-red-400"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="rounded-2xl border border-white/10 px-5 py-4 font-black text-gray-300 transition hover:bg-white hover:text-black"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingDispute}
                className="rounded-2xl bg-red-400 px-5 py-4 font-black text-black transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingDispute ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </form>
        </div>
      )}

    </main>
  );
}