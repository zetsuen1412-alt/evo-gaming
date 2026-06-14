import Link from "next/link";
import {
  FaCheckCircle,
  FaClock,
  FaHome,
  FaReceipt,
  FaShieldAlt,
  FaShoppingBag,
  FaStore,
} from "react-icons/fa";
import MarketplaceEventTracker from "@/components/marketplace/MarketplaceEventTracker";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Order = {
  id: number;
  created_at?: string | null;
  product?: string | null;
  buyer?: string | null;
  price?: string | number | null;
  status?: string | null;
  payment_proof?: string | null;
  product_id?: number | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  quantity?: number | null;
  total_amount?: string | number | null;
  total_price?: string | number | null;
  payment_status?: string | null;
  product_title?: string | null;
  seller_name?: string | null;
  game_name?: string | null;
  category?: string | null;
};

type Product = {
  id: number;
  title?: string | null;
  price?: string | number | null;
  image_url?: string | null;
  seller?: string | null;
  seller_name?: string | null;
  seller_id?: string | null;
  game_name?: string | null;
  category?: string | null;
  slug?: string | null;
};

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


function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTotal(order: Order | null, product: Product | null) {
  return (
    numberPrice(order?.total_amount) ||
    numberPrice(order?.total_price) ||
    numberPrice(order?.price) ||
    numberPrice(product?.price)
  );
}

export default async function OrderSuccessPage({ params }: PageProps) {
  const { id } = await params;
  const orderId = Number(id);

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  let product: Product | null = null;

  if (order?.product_id) {
    const { data: productData } = await supabase
      .from("products")
      .select(`
        id,
        title,
        price,
        image_url,
        seller,
        seller_name,
        seller_id,
        game_name,
        category,
        slug
      `)
      .eq("id", Number(order.product_id))
      .maybeSingle();

    product = productData || null;
  }

  const productTitle =
    order?.product_title || order?.product || product?.title || "Product";
  const sellerName =
    order?.seller_name || product?.seller_name || product?.seller || "Verified Seller";
  const gameName = order?.game_name || product?.game_name || "-";
  const category = order?.category || product?.category || "Game Product";
  const quantity = Number(order?.quantity || 1);
  const total = getTotal(order, product);
  const paymentStatus = order?.payment_status || "-";
  const orderStatus = order?.status || "-";
  const eventGameName = order?.game_name || product?.game_name || null;
  const eventCategoryName = order?.category || product?.category || null;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <MarketplaceEventTracker
        event_type="order_complete"
        order_id={order?.id || orderId}
        product_id={order?.product_id || product?.id || null}
        seller_id={order?.seller_id || product?.seller_id || null}
        game_slug={eventGameName ? slugify(eventGameName) : null}
        game_name={eventGameName}
        category_slug={eventCategoryName ? slugify(eventCategoryName) : null}
        category_name={eventCategoryName}
      />
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.18),transparent_38%)]">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
            <FaCheckCircle className="text-5xl text-emerald-300" />
          </div>

          <h1 className="mt-8 text-5xl font-black md:text-6xl">
            Order Created
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Your order has been recorded successfully. Keep all communication
            and delivery inside ComePlayers for safer trading.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2 text-sm font-black text-cyan-200">
            Order #{order?.id || orderId}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="flex items-center gap-3 text-2xl font-black">
              <FaReceipt className="text-cyan-300" />
              Order Summary
            </h2>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              <h3 className="text-2xl font-black">{productTitle}</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                  {category}
                </span>

                <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                  {gameName}
                </span>

                <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
                  Qty: {quantity}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-400">Seller</p>
                  <p className="mt-1 font-black">{sellerName}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-400">Total Paid</p>
                  <p className="mt-1 text-2xl font-black text-cyan-300">
                    {formatPrice(total)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">What Happens Next?</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <FaCheckCircle className="text-3xl text-emerald-300" />
                <h3 className="mt-4 font-black">1. Payment Recorded</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Your payment/order status has been updated.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <FaStore className="text-3xl text-cyan-300" />
                <h3 className="mt-4 font-black">2. Seller Processes</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Seller prepares delivery for your digital item.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <FaShieldAlt className="text-3xl text-yellow-300" />
                <h3 className="mt-4 font-black">3. Complete Safely</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Confirm delivery only after everything is received.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h3 className="text-xl font-black">Status</h3>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Order Status</span>
                <span className="font-black text-cyan-300">{orderStatus}</span>
              </div>

              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-300">Payment Status</span>
                <span className="font-black text-emerald-300">
                  {paymentStatus}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-300">Order ID</span>
                <span className="font-black">#{order?.id || orderId}</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="flex items-center gap-2 text-xl font-black">
              <FaClock className="text-yellow-300" />
              Keep Updated
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              You can check your order progress from My Orders. Seller delivery
              and confirmation should stay inside ComePlayers.
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href="/my-orders"
                className="flex items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-4 font-black text-black hover:bg-cyan-300"
              >
                <FaShoppingBag />
                View My Orders
              </Link>

              <Link
                href="/games"
                className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-black text-white hover:border-cyan-400"
              >
                <FaHome />
                Browse More Games
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}