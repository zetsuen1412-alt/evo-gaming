"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/createNotification";

type Product = {
  id: number;
  title: string;
  price: string | number | null;
  seller_id: string | null;
  seller_name: string | null;
  seller: string | null;
  category: string | null;
  category_id: number | null;
  game_name: string | null;
  game_category_id: number | null;
  image_url: string | null;
  stock: number | null;
  status: string | null;
};

type Category = {
  id: number;
  name: string;
  slug: string;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
};

type Coupon = {
  id: number;
  code: string;
  name: string;
  discount_type: "fixed" | "percent";
  discount_value: string | number;
  minimum_order_amount: string | number;
  maximum_discount_amount: string | number | null;
  usage_limit: number | null;
  used_count: number;
  start_at: string | null;
  end_at: string | null;
  status: "active" | "inactive";
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

type PaymentMethod = "manual" | "wallet";

function formatPrice(value: string | number | null) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function normalizeCouponCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function calculateDiscount(coupon: Coupon, subtotal: number) {
  if (coupon.discount_type === "fixed") {
    return Math.min(Number(coupon.discount_value || 0), subtotal);
  }

  const percentDiscount = (subtotal * Number(coupon.discount_value || 0)) / 100;
  const maxDiscount =
    coupon.maximum_discount_amount === null
      ? percentDiscount
      : Math.min(percentDiscount, Number(coupon.maximum_discount_amount || 0));

  return Math.min(maxDiscount, subtotal);
}

export default function CheckoutV3WalletPaymentPage() {
  const params = useParams();
  const productId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [gameMaster, setGameMaster] = useState<GameMaster | null>(null);
  const [buyerWallet, setBuyerWallet] = useState<Wallet | null>(null);

  const [buyerNote, setBuyerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("manual");

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");

  const categoryDisplayName = useMemo(() => {
    return category?.name || product?.category || "Marketplace";
  }, [category, product]);

  const gameDisplayName = useMemo(() => {
    return gameMaster?.name || product?.game_name || "-";
  }, [gameMaster, product]);

  const sellerDisplayName = useMemo(() => {
    return product?.seller_name || product?.seller || "Unknown Seller";
  }, [product]);

  const subtotal = useMemo(() => Number(product?.price || 0), [product]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return calculateDiscount(appliedCoupon, subtotal);
  }, [appliedCoupon, subtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(subtotal - discountAmount, 0);
  }, [subtotal, discountAmount]);

  const walletBalance = Number(buyerWallet?.balance || 0);
  const walletEnough = walletBalance >= finalTotal;

  useEffect(() => {
    if (productId) loadCheckout();
  }, [productId]);

  async function loadCheckout() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      alert("Please login before checkout.");
      window.location.href = "/";
      return;
    }

    const buyer = sessionData.session.user;

    const { data: walletData } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", buyer.id)
      .maybeSingle();

    setBuyerWallet(walletData || null);

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", Number(productId))
      .maybeSingle();

    if (productError) {
      alert(productError.message);
      setLoading(false);
      return;
    }

    if (!productData) {
      setProduct(null);
      setLoading(false);
      return;
    }

    setProduct(productData);

    if (productData.category_id) {
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug")
        .eq("id", productData.category_id)
        .maybeSingle();

      setCategory(data || null);
    }

    if (productData.game_category_id) {
      const { data } = await supabase
        .from("game_master")
        .select("id,name,slug,image_url")
        .eq("id", productData.game_category_id)
        .maybeSingle();

      setGameMaster(data || null);
    }

    setLoading(false);
  }

  async function applyCoupon() {
    const normalizedCode = normalizeCouponCode(couponCode);

    if (!normalizedCode) {
      setCouponError("Please enter coupon code.");
      return;
    }

    setCheckingCoupon(true);
    setCouponError("");
    setAppliedCoupon(null);

    const { data: couponData, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error) {
      setCouponError(error.message);
      setCheckingCoupon(false);
      return;
    }

    if (!couponData) {
      setCouponError("Coupon not found.");
      setCheckingCoupon(false);
      return;
    }

    if (couponData.status !== "active") {
      setCouponError("Coupon is inactive.");
      setCheckingCoupon(false);
      return;
    }

    const now = Date.now();

    if (couponData.start_at && new Date(couponData.start_at).getTime() > now) {
      setCouponError("Coupon is not started yet.");
      setCheckingCoupon(false);
      return;
    }

    if (couponData.end_at && new Date(couponData.end_at).getTime() < now) {
      setCouponError("Coupon has expired.");
      setCheckingCoupon(false);
      return;
    }

    if (
      couponData.usage_limit !== null &&
      Number(couponData.used_count || 0) >= Number(couponData.usage_limit)
    ) {
      setCouponError("Coupon usage limit reached.");
      setCheckingCoupon(false);
      return;
    }

    if (subtotal < Number(couponData.minimum_order_amount || 0)) {
      setCouponError(
        `Minimum order amount is ${formatPrice(couponData.minimum_order_amount)}.`
      );
      setCheckingCoupon(false);
      return;
    }

    setAppliedCoupon(couponData);
    setCouponCode(couponData.code);
    setCheckingCoupon(false);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
  }

  async function createBuyerWalletIfMissing(userId: string) {
    const { data: existingWallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingWallet) return existingWallet as Wallet;

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        user_id: userId,
        balance: 0,
        pending_balance: 0,
        total_earned: 0,
        total_spent: 0,
        total_withdrawn: 0,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data as Wallet;
  }

  async function saveCouponUsage(orderId: number, buyerId: string) {
    if (!appliedCoupon) return;

    const { error } = await supabase.from("coupon_usages").insert({
      coupon_id: appliedCoupon.id,
      order_id: orderId,
      user_id: buyerId,
      discount_amount: discountAmount,
    });

    if (!error) {
      await supabase
        .from("coupons")
        .update({
          used_count: Number(appliedCoupon.used_count || 0) + 1,
        })
        .eq("id", appliedCoupon.id);
    }
  }

  async function notifyCouponApplied(orderId: number, buyerId: string) {
    if (!appliedCoupon || discountAmount <= 0) return;

    await createNotification({
      userId: buyerId,
      type: "coupon",
      title: "Coupon Applied",
      message: `${appliedCoupon.code} saved you ${formatPrice(discountAmount)}.`,
      linkUrl: `/order/${orderId}`,
    });
  }

  async function payWithWallet(orderId: number, buyerId: string) {
    const wallet = await createBuyerWalletIfMissing(buyerId);

    if (wallet.status !== "active") {
      throw new Error("Your wallet is frozen.");
    }

    const balanceBefore = Number(wallet.balance || 0);

    if (balanceBefore < finalTotal) {
      throw new Error("Insufficient wallet balance.");
    }

    const balanceAfter = balanceBefore - finalTotal;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({
        balance: balanceAfter,
        total_spent: Number(wallet.total_spent || 0) + finalTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("user_id", buyerId);

    if (walletError) throw new Error(walletError.message);

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: buyerId,
        type: "purchase",
        amount: finalTotal,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        order_id: orderId,
        description: `Wallet payment for order #${orderId}`,
        status: "completed",
      });

    if (transactionError) throw new Error(transactionError.message);
  }

  async function createOrder() {
    if (!product) return;

    if (product.status !== "active") {
      alert("This product is not available.");
      return;
    }

    if (Number(product.stock || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    if (paymentMethod === "wallet" && !walletEnough) {
      alert("Insufficient wallet balance.");
      return;
    }

    setCreatingOrder(true);

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      alert("Please login again.");
      window.location.href = "/";
      return;
    }

    const buyer = sessionData.session.user;

    const noteWithCoupon = [
      buyerNote.trim() ? `Buyer Note: ${buyerNote.trim()}` : null,
      `Payment Method: ${paymentMethod === "wallet" ? "Wallet Balance" : "Manual Transfer"}`,
      appliedCoupon
        ? `Coupon: ${appliedCoupon.code} (${formatPrice(discountAmount)} discount)`
        : null,
      appliedCoupon ? `Original Price: ${formatPrice(subtotal)}` : null,
      `Final Total: ${formatPrice(finalTotal)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const initialStatus =
      paymentMethod === "wallet" ? "Processing" : "Pending Payment";

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: buyer.id,
        buyer: buyer.email || "",
        seller_id: product.seller_id,
        product_id: product.id,

        product: product.title,
        price: subtotal,
        quantity: 1,
        total_price: finalTotal,

        category_id: product.category_id,
        category_name: categoryDisplayName,

        game_master_id: gameMaster?.id || product.game_category_id || null,
        game_name: gameDisplayName,

        status: initialStatus,
        payment_proof: noteWithCoupon || null,
        payment_image: null,
      })
      .select("*")
      .single();

    if (orderError) {
      alert(`Order Error: ${orderError.message}`);
      setCreatingOrder(false);
      return;
    }

    try {
      await saveCouponUsage(orderData.id, buyer.id);

      if (paymentMethod === "wallet") {
        await payWithWallet(orderData.id, buyer.id);

        await createNotification({
          userId: buyer.id,
          type: "payment",
          title: "Wallet Payment Successful",
          message: `Your wallet payment for order #${orderData.id} was successful.`,
          linkUrl: `/order/${orderData.id}`,
        });

        await notifyCouponApplied(orderData.id, buyer.id);

        await createNotification({
          userId: product.seller_id,
          type: "order",
          title: "New Wallet Paid Order",
          message: `${buyer.email || "A buyer"} paid with wallet for ${
            product.title
          }. You can process the order now.`,
          linkUrl: "/seller/orders",
        });

        alert("Wallet payment successful. Order is now processing.");
        window.location.href = `/order/${orderData.id}`;
        return;
      }

      await createNotification({
        userId: buyer.id,
        type: "order",
        title: "Order Created",
        message: `Your order #${orderData.id} has been created successfully. Please complete your payment.`,
        linkUrl: `/payment?order=${orderData.id}`,
      });

      await notifyCouponApplied(orderData.id, buyer.id);

      await createNotification({
        userId: product.seller_id,
        type: "order",
        title: "New Order Received",
        message: `${buyer.email || "A buyer"} created a new order for ${
          product.title
        }. Waiting for payment.`,
        linkUrl: "/seller/orders",
      });

      alert("Order created successfully.");
      window.location.href = `/payment?order=${orderData.id}`;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Order created, but payment processing failed."
      );
      setCreatingOrder(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading checkout...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Product not found</h1>
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

  const productImage = product.image_url || gameMaster?.image_url || null;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-black text-green-300">
              Checkout V3 Wallet Payment
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Checkout</h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Pay with manual transfer or use your ComePlayers wallet balance.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              {categoryDisplayName} / {gameDisplayName}
            </p>
          </div>

          <Link
            href={`/product/${product.id}`}
            className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Product
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Order Details</h2>

            <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-white/10 bg-black/30 p-5 md:flex-row">
              <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black md:w-36">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-5xl">🎮</span>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-black text-cyan-300">
                  {categoryDisplayName} / {gameDisplayName}
                </p>

                <h2 className="mt-2 text-2xl font-black">{product.title}</h2>

                <p className="mt-2 text-sm text-gray-400">
                  Seller: {sellerDisplayName}
                </p>

                <p className="mt-4 text-3xl font-black text-cyan-300">
                  {formatPrice(product.price)}
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  Stock: {product.stock || 0}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Buyer Note
              </label>

              <textarea
                value={buyerNote}
                onChange={(event) => setBuyerNote(event.target.value)}
                placeholder="Write account ID, server, character name, delivery notes, or other order details."
                rows={6}
                className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-green-400/20 bg-green-400/10 p-7">
            <h2 className="text-3xl font-black text-green-300">
              Payment Method
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("manual")}
                className={`rounded-2xl border p-5 text-left transition ${
                  paymentMethod === "manual"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="text-xl font-black">Manual Transfer</p>
                <p className="mt-2 text-sm text-gray-400">
                  Upload payment proof after order creation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={`rounded-2xl border p-5 text-left transition ${
                  paymentMethod === "wallet"
                    ? "border-green-400 bg-green-400/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className="text-xl font-black">Wallet Balance</p>
                <p className="mt-2 text-sm text-gray-400">
                  Balance: {formatPrice(walletBalance)}
                </p>
              </button>
            </div>

            {paymentMethod === "wallet" && !walletEnough && (
              <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-300">
                Insufficient wallet balance. Please top up later or use manual
                transfer.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-7">
            <h2 className="text-3xl font-black text-yellow-300">Coupon Code</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_160px]">
              <input
                value={couponCode}
                onChange={(event) =>
                  setCouponCode(normalizeCouponCode(event.target.value))
                }
                disabled={Boolean(appliedCoupon)}
                placeholder="WELCOME10"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 font-black uppercase text-white outline-none placeholder:text-gray-500 focus:border-yellow-400 disabled:opacity-60"
              />

              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="rounded-2xl border border-red-400/40 px-5 py-4 font-black text-red-300 hover:bg-red-500 hover:text-white"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checkingCoupon}
                  className="rounded-2xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
                >
                  {checkingCoupon ? "Checking..." : "Apply"}
                </button>
              )}
            </div>

            {couponError && (
              <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-300">
                {couponError}
              </p>
            )}

            {appliedCoupon && (
              <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
                <p className="font-black text-green-300">
                  Coupon Applied: {appliedCoupon.code}
                </p>
                <p className="mt-3 text-lg font-black text-green-300">
                  You save {formatPrice(discountAmount)}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Order Summary</h2>

          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Product Price</span>
              <span className="font-black">{formatPrice(subtotal)}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Quantity</span>
              <span className="font-black">1</span>
            </div>

            {appliedCoupon && (
              <div className="flex justify-between gap-4 text-green-300">
                <span>Coupon ({appliedCoupon.code})</span>
                <span className="font-black">-{formatPrice(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Payment</span>
              <span className="font-black">
                {paymentMethod === "wallet" ? "Wallet" : "Manual Transfer"}
              </span>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Total</span>
                <span className="text-3xl font-black text-cyan-300">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={createOrder}
            disabled={creatingOrder || (paymentMethod === "wallet" && !walletEnough)}
            className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingOrder
              ? "Creating Order..."
              : paymentMethod === "wallet"
              ? "Pay with Wallet"
              : "Continue to Payment"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-400">
            {paymentMethod === "wallet"
              ? "Wallet payment will process your order instantly."
              : "Manual transfer requires payment proof upload."}
          </p>
        </aside>
      </section>
    </main>
  );
}