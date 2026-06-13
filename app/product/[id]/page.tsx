import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FaBolt,
  FaBoxOpen,
  FaCheckCircle,
  FaClock,
  FaComments,
  FaGamepad,
  FaGem,
  FaShieldAlt,
  FaShoppingCart,
  FaStar,
  FaStore,
  FaTag,
  FaUserShield,
  FaWallet,
} from "react-icons/fa";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

function fallbackImage(title: string) {
  return `https://placehold.co/900x600/020617/22d3ee?text=${encodeURIComponent(
    title || "ComePlayers Product"
  )}`;
}

function getCategoryIcon(category?: string | null) {
  const value = (category || "").toLowerCase();

  if (value.includes("coin")) return FaGem;
  if (value.includes("account")) return FaGamepad;
  if (value.includes("boost")) return FaBolt;
  if (value.includes("top")) return FaWallet;
  if (value.includes("item")) return FaBoxOpen;

  return FaTag;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  const productId = Number(id);
  const productQueryKey = decodeURIComponent(id);

  let productQuery = supabase
    .from("products")
    .select(`
      id,
      created_at,
      title,
      price,
      seller,
      seller_id,
      seller_name,
      description,
      category,
      slug,
      image_url,
      stock,
      status,
      category_id,
      game_category_id,
      game_name
    `);

  if (Number.isFinite(productId) && productId > 0) {
    productQuery = productQuery.eq("id", productId);
  } else {
    productQuery = productQuery.eq("slug", productQueryKey);
  }

  const { data: product } = await productQuery.maybeSingle();

  if (!product || product.status !== "active") {
    notFound();
  }

  const gameSlug = product.game_name ? slugify(product.game_name) : "";
  const categorySlug = product.category ? slugify(product.category) : "";
  const gameOffersHref = gameSlug
    ? `/games/${gameSlug}/offers${categorySlug ? `?category=${categorySlug}` : ""}`
    : "";
  const CategoryIcon = getCategoryIcon(product.category);
  const imageUrl = product.image_url || fallbackImage(product.title);
  const sellerName = product.seller_name || product.seller || "Verified Seller";
  const stock = Number(product.stock ?? 1);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-cyan-300">
              Home
            </Link>
            <span>/</span>

            {product.game_name ? (
              <>
                <Link
                  href={`/games/${gameSlug}`}
                  className="hover:text-cyan-300"
                >
                  {product.game_name}
                </Link>
                <span>/</span>
              </>
            ) : null}

            <span className="text-cyan-300">{product.title}</span>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
              <div className="relative h-[420px] bg-black">
                <Image
                  src={imageUrl}
                  alt={product.title}
                  fill
                  className="object-cover"
                  unoptimized
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-xs font-black text-black">
                    <CategoryIcon />
                    {product.category || "Game Product"}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300">
                    <FaShieldAlt />
                    Secure
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h1 className="text-4xl font-black leading-tight">
                  {product.title}
                </h1>

                <div className="mt-4 flex flex-wrap gap-3">
                  {product.game_name ? (
                    <Link
                      href={gameOffersHref || `/games/${gameSlug}/offers`}
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:border-cyan-300"
                    >
                      {product.game_name}
                    </Link>
                  ) : null}

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                    Stock: {stock}
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                    Fast Delivery
                  </span>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
                <p className="text-sm font-bold text-cyan-200">Total Price</p>

                <p className="mt-2 text-4xl font-black text-cyan-300">
                  {formatPrice(product.price)}
                </p>

                <div className="mt-6 space-y-3">
                  <Link
                    href={`/checkout/${product.id}`}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300"
                  >
                    <FaShoppingCart />
                    Buy Now
                  </Link>

                  <Link
                    href={`/messages?seller=${product.seller_id || ""}&product=${product.id}`}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 px-5 py-4 font-black text-white transition hover:border-cyan-400"
                  >
                    <FaComments />
                    Chat Seller
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <FaShieldAlt className="text-emerald-300" />
                    <p className="mt-2 font-bold">Escrow Protected</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <FaClock className="text-yellow-300" />
                    <p className="mt-2 font-bold">Fast Delivery</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <FaStore className="text-cyan-300" />
                  Seller
                </h2>

                <div className="mt-5 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-xl font-black text-black">
                    {sellerName.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p className="font-black">{sellerName}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-yellow-300">
                      <FaStar /> 4.9 Seller Rating
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <p className="flex items-center gap-2">
                    <FaCheckCircle className="text-emerald-300" />
                    Verified marketplace seller
                  </p>

                  <p className="flex items-center gap-2">
                    <FaUserShield className="text-cyan-300" />
                    Protected by ComePlayers
                  </p>
                </div>

                {product.seller_id ? (
                  <Link
                    href={`/seller-profile/${product.seller_id}`}
                    className="mt-5 block rounded-xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
                  >
                    View Seller Profile
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-black">Product Description</h2>

              <div className="mt-5 whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-5 leading-7 text-slate-300">
                {product.description || "No description provided by seller."}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-black">How It Works</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-black">
                    <FaShoppingCart />
                  </div>

                  <h3 className="mt-4 font-black">1. Place Order</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Buyer checks product details and starts checkout.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-black">
                    <FaWallet />
                  </div>

                  <h3 className="mt-4 font-black">2. Payment Held</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Payment is protected while seller delivers the item.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-black">
                    <FaCheckCircle />
                  </div>

                  <h3 className="mt-4 font-black">3. Complete Safely</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Buyer confirms delivery and transaction is completed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-xl font-black">Product Info</h3>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-400">Category</span>
                  <span className="font-bold">{product.category || "-"}</span>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-400">Game</span>
                  <span className="font-bold">{product.game_name || "-"}</span>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-400">Stock</span>
                  <span className="font-bold">{stock}</span>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-400">Status</span>
                  <span className="font-bold text-emerald-300">Active</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Product ID</span>
                  <span className="font-bold">#{product.id}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
              <h3 className="text-xl font-black text-emerald-200">
                Buyer Protection
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your payment is protected through ComePlayers marketplace flow.
                Always complete transactions inside ComePlayers.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}