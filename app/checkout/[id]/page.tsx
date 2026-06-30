"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaMinus,
  FaPaypal,
  FaPlus,
  FaShieldAlt,
  FaShoppingCart,
  FaWallet,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
import { trackMarketplaceEvent } from "@/lib/marketplace-events-client";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  price: string | number | null;
  seller?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  stock?: number | null;
  status?: string | null;
  game_name?: string | null;
  slug?: string | null;
  has_variants?: boolean | null;
};

type ProductVariant = {
  id: number;
  sku: string;
  name: string;
  attributes: Record<string, unknown> | null;
  price: string | number;
  stock: number;
  status: string;
};

type Coupon = {
  id: number;
  code: string;
  name: string;
  description: string | null;
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

type PaymentMethod = "wallet" | "paypal";

function numberPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d]/g, "") || 0);
}

function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "ComePlayers Product"
  )}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export default function CheckoutPage() {
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();

  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();

  const routeProductId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const productId = searchParams.get("product") || routeProductId || "";
  const requestedVariantId = Number(searchParams.get("variant") || 0);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponData, setCouponData] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
  const unitPrice = numberPrice(selectedVariant?.price ?? product?.price);
  const subtotal = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  const totalBeforePaymentFee = useMemo(
    () => Math.max(0, subtotal - discountAmount),
    [discountAmount, subtotal]
  );

  const paypalFee = useMemo(() => {
    if (paymentMethod !== "paypal") return 0;
    if (totalBeforePaymentFee <= 0) return 0;
    return Math.ceil(totalBeforePaymentFee * 0.05);
  }, [paymentMethod, totalBeforePaymentFee]);

  const total = useMemo(
    () => totalBeforePaymentFee + paypalFee,
    [paypalFee, totalBeforePaymentFee]
  );

  const stock = Number(selectedVariant?.stock ?? product?.stock ?? 1);
  const sellerName =
    product?.seller_name || product?.seller || "Verified Seller";

  useEffect(() => {
    async function loadCheckout() {
      setLoading(true);
      setError("");

      const { data: authData } = await supabase.auth.getUser();
      setUserId(authData.user?.id || null);

      if (!productId) {
        setError("Product tidak ditemukan.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          title,
          price,
          seller,
          seller_id,
          seller_name,
          description,
          category,
          image_url,
          stock,
          status,
          game_name,
          slug,
          has_variants
        `
        )
        .eq("id", Number(productId))
        .maybeSingle();

      if (error || !data || data.status !== "active") {
        setError("Produk tidak tersedia.");
        setLoading(false);
        return;
      }

      let loadedVariants: ProductVariant[] = [];
      let initialVariantId: number | null = null;

      if (data.has_variants) {
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select("id,sku,name,attributes,price,stock,status")
          .eq("product_id", data.id)
          .eq("status", "active")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true });

        if (variantError) {
          setError(variantError.message);
          setLoading(false);
          return;
        }

        loadedVariants = (variantRows || []) as ProductVariant[];
        const requested = loadedVariants.find((variant) => variant.id === requestedVariantId);
        const firstAvailable = loadedVariants.find((variant) => Number(variant.stock || 0) > 0);
        initialVariantId = requested?.id || firstAvailable?.id || loadedVariants[0]?.id || null;

        if (!initialVariantId) {
          setError("Produk ini belum memiliki varian aktif.");
          setLoading(false);
          return;
        }
      }

      setProduct(data);
      setVariants(loadedVariants);
      setSelectedVariantId(initialVariantId);
      setCouponCode("");
      setCouponError("");
      setCouponData(null);
      setDiscountAmount(0);
      setPaymentMethod("wallet");

      trackMarketplaceEvent({
        event_type: "checkout_start",
        user_id: authData.user?.id || null,
        product_id: data.id,
        seller_id: data.seller_id || null,
        game_slug: data.game_name ? slugify(data.game_name) : null,
        game_name: data.game_name || null,
        category_slug: data.category ? slugify(data.category) : null,
        category_name: data.category || null,
      });

      setQuantity(1);
      setLoading(false);
    }

    loadCheckout();
  }, [productId, requestedVariantId]);

  useEffect(() => {
    if (!couponData) return;
    calculateCouponDiscount(couponData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity, subtotal]);

  function calculateCouponDiscount(coupon: Coupon) {
    let discount = 0;

    if (coupon.discount_type === "percent") {
      discount = subtotal * (Number(coupon.discount_value || 0) / 100);

      if (coupon.maximum_discount_amount) {
        discount = Math.min(discount, Number(coupon.maximum_discount_amount));
      }
    } else {
      discount = Number(coupon.discount_value || 0);
    }

    discount = Math.min(discount, subtotal);
    setDiscountAmount(Math.max(0, discount));
  }

  function removeCoupon() {
    setCouponData(null);
    setCouponError("");
    setDiscountAmount(0);
  }

  async function applyCoupon() {
    const code = normalizeCouponCode(couponCode);

    if (!code) {
      setCouponError("Enter coupon code.");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      setCouponError("Coupon not found or inactive.");
      setCouponLoading(false);
      return;
    }

    const coupon = data as Coupon;
    const now = new Date();

    if (coupon.start_at && now < new Date(coupon.start_at)) {
      setCouponError("Coupon is not active yet.");
      setCouponLoading(false);
      return;
    }

    if (coupon.end_at && now > new Date(coupon.end_at)) {
      setCouponError("Coupon has expired.");
      setCouponLoading(false);
      return;
    }

    if (
      coupon.usage_limit !== null &&
      Number(coupon.used_count || 0) >= Number(coupon.usage_limit)
    ) {
      setCouponError("Coupon usage limit has been reached.");
      setCouponLoading(false);
      return;
    }

    if (subtotal < Number(coupon.minimum_order_amount || 0)) {
      setCouponError(
        `Minimum purchase is ${formatPrice(coupon.minimum_order_amount)}.`
      );
      setCouponLoading(false);
      return;
    }

    setCouponData(coupon);
    setCouponCode(coupon.code);
    calculateCouponDiscount(coupon);
    setCouponLoading(false);
  }

  async function createOrder() {
    if (!product || !userId) {
      setError("Silakan login terlebih dahulu.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Please login again before checkout.");
      }

      const response = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant?.id || null,
          quantity,
          paymentMethod,
          couponCode: couponData?.code || null,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.order?.id) {
        throw new Error(json.error || "Failed to create marketplace order.");
      }

      // The API recalculates product price, stock, coupon, and payment fee on
      // the server. Client totals are only a checkout preview.
      router.push(`/payment/${json.order.id}?method=${paymentMethod}`);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to create marketplace order."
      );
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        Loading checkout...
      </main>
    );
  }

  if (error && !product) {
    return (
      <main className="min-h-screen bg-[#050816] px-4 py-20 text-center text-white">
        <p className="text-xl font-black">{error}</p>
        <Link href="/" className="mt-5 inline-block text-cyan-300">
          Back Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.16),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Link
            href={`/product/${product?.slug || product?.id}`}
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300"
          >
            <FaArrowLeft />
            Back to Product
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <h1 className="text-5xl font-black">Checkout</h1>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              {currency}
            </span>
          </div>

          <p className="mt-3 text-slate-300">
            Review your order before continuing to payment.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Order Item</h2>

            <div className="mt-6 flex flex-col gap-5 md:flex-row">
              <div
                className="h-48 w-full rounded-2xl border border-white/10 bg-cover bg-center md:w-72"
                style={{
                  backgroundImage: `url(${
                    product?.image_url || fallbackImage(product?.title || "")
                  })`,
                }}
              />

              <div className="flex-1">
                <h3 className="text-2xl font-black">{product?.title}</h3>

                {variants.length > 0 ? (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-black text-slate-300">Selected Variant</label>
                    <select
                      value={selectedVariantId || ""}
                      onChange={(event) => {
                        setSelectedVariantId(Number(event.target.value));
                        setQuantity(1);
                        removeCoupon();
                      }}
                      className="w-full rounded-xl border border-cyan-400/30 bg-black px-4 py-3 text-white outline-none focus:border-cyan-400"
                    >
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id} disabled={Number(variant.stock || 0) <= 0}>
                          {variant.name} · {variant.sku} · {formatPrice(variant.price)} · Stock {variant.stock}
                        </option>
                      ))}
                    </select>
                    {selectedVariant ? (
                      <p className="mt-2 text-sm text-violet-300">
                        SKU {selectedVariant.sku}
                        {selectedVariant.attributes && Object.keys(selectedVariant.attributes).length > 0
                          ? ` · ${Object.entries(selectedVariant.attributes).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                    {product?.category || "Game Product"}
                  </span>

                  {product?.game_name ? (
                    <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                      {product.game_name}
                    </span>
                  ) : null}

                  <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                    Stock: {stock}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-black text-cyan-300">
                  {formatPrice(selectedVariant?.price ?? product?.price)}
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30"
                    type="button"
                  >
                    <FaMinus />
                  </button>

                  <div className="flex h-11 w-16 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 font-black">
                    {quantity}
                  </div>

                  <button
                    onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30"
                    type="button"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">Seller Information</h2>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-xl font-black text-black">
                {sellerName.charAt(0).toUpperCase()}
              </div>

              <div>
                <p className="font-black">{sellerName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  Verified marketplace seller
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaShieldAlt className="text-emerald-300" />
              <p className="mt-3 font-black">Escrow Protected</p>
              <p className="mt-2 text-sm text-slate-400">
                Payment held until order is completed.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaClock className="text-yellow-300" />
              <p className="mt-3 font-black">Fast Delivery</p>
              <p className="mt-2 text-sm text-slate-400">
                Seller processes digital product delivery.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <FaCheckCircle className="text-cyan-300" />
              <p className="mt-3 font-black">Safe Checkout</p>
              <p className="mt-2 text-sm text-slate-400">
                Complete everything inside ComePlayers.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-black">Order Summary</h2>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Item Price</span>
                <span className="font-bold">{formatPrice(selectedVariant?.price ?? product?.price)}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Quantity</span>
                <span className="font-bold">{quantity}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Subtotal</span>
                <span className="font-bold">{formatPrice(subtotal)}</span>
              </div>

              {discountAmount > 0 ? (
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-green-300">Coupon Discount</span>
                  <span className="font-bold text-green-300">
                    -{formatPrice(discountAmount)}
                  </span>
                </div>
              ) : null}

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Platform Fee</span>
                <span className="font-bold">{formatPrice(0)}</span>
              </div>

              {paymentMethod === "paypal" ? (
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-300">PayPal Processing Fee</span>
                  <span className="font-bold text-cyan-300">
                    {formatPrice(paypalFee)}
                  </span>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4 text-lg">
                <span className="font-black">Total</span>

                <div className="text-right">
                  <p className="text-xl font-black text-cyan-300">
                    {formatPrice(total)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Currency: {currency}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <label className="mb-2 block text-sm font-black text-slate-200">
                Coupon Code
              </label>

              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    setCouponError("");
                  }}
                  disabled={Boolean(couponData)}
                  placeholder="WELCOME10"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-yellow-400 disabled:opacity-60"
                />

                {couponData ? (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="rounded-xl border border-red-400/40 px-4 py-3 font-black text-red-300 hover:bg-red-500 hover:text-white"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading}
                    className="rounded-xl bg-yellow-400 px-4 py-3 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
                  >
                    {couponLoading ? "Checking..." : "Apply"}
                  </button>
                )}
              </div>

              {couponError ? (
                <p className="mt-2 text-sm font-bold text-red-300">
                  {couponError}
                </p>
              ) : null}

              {couponData ? (
                <div className="mt-3 rounded-xl border border-green-400/20 bg-green-400/10 p-3">
                  <p className="font-black text-green-300">
                    Coupon Applied: {couponData.code}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {couponData.name}
                  </p>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {!userId ? (
              <button
                onClick={() => router.push("/")}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-5 py-4 font-black text-black"
              >
                Login to Continue
              </button>
            ) : (
              <button
                onClick={createOrder}
                disabled={creating}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {paymentMethod === "paypal" ? <FaPaypal /> : <FaShoppingCart />}
                {creating
                  ? "Creating Order..."
                  : paymentMethod === "paypal"
                  ? "Continue with PayPal"
                  : "Continue to Payment"}
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="flex items-center gap-2 text-xl font-black">
              {paymentMethod === "paypal" ? (
                <FaPaypal className="text-cyan-300" />
              ) : (
                <FaWallet className="text-cyan-300" />
              )}
              Payment Method
            </h3>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={`rounded-2xl border p-4 text-left transition ${
                  paymentMethod === "wallet"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30 hover:border-cyan-400/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                      paymentMethod === "wallet"
                        ? "border-cyan-300"
                        : "border-white/30"
                    }`}
                  >
                    {paymentMethod === "wallet" ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    ) : null}
                  </div>

                  <div>
                    <p className="flex items-center gap-2 font-black">
                      <FaWallet className="text-cyan-300" />
                      ComePlayers Wallet / Payment
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Use the marketplace payment flow and continue to the
                      standard payment page.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("paypal")}
                className={`rounded-2xl border p-4 text-left transition ${
                  paymentMethod === "paypal"
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-black/30 hover:border-cyan-400/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                      paymentMethod === "paypal"
                        ? "border-cyan-300"
                        : "border-white/30"
                    }`}
                  >
                    {paymentMethod === "paypal" ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    ) : null}
                  </div>

                  <div>
                    <p className="flex items-center gap-2 font-black">
                      <FaPaypal className="text-cyan-300" />
                      PayPal
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Continue with PayPal. A processing fee will be added to
                      the final total.
                    </p>

                    {paymentMethod === "paypal" ? (
                      <div className="mt-3 rounded-xl border border-cyan-400/20 bg-black/30 p-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">PayPal Fee</span>
                          <span className="font-black text-cyan-300">
                            {formatPrice(paypalFee)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}