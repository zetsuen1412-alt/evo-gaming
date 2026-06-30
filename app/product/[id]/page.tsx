import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FaAward,
  FaBolt,
  FaBoxOpen,
  FaCheckCircle,
  FaClock,
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
import MarketplaceBreadcrumbs from "@/components/marketplace/MarketplaceBreadcrumbs";
import MarketplaceEventTracker from "@/components/marketplace/MarketplaceEventTracker";
import ProductVariantPurchase from "@/components/marketplace/ProductVariantPurchase";
import RecentlyViewedTracker from "@/components/marketplace/RecentlyViewedTracker";
import RecommendedProducts from "@/components/marketplace/RecommendedProducts";
import { convertFromIdr, formatLocalizedPrice } from "@/lib/localization";
import { calculateSellerReputation } from "@/lib/sellerReputation";
import {
  effectivePresence,
  formatDeliveryEta,
  serviceLevelClass,
  serviceLevelDescription,
  serviceLevelLabel,
} from "@/lib/sellerServiceLevel";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://comeplayers.com"
).replace(/\/$/, "");

function absoluteUrl(path: string) {
  if (!path) return SITE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

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

function CategoryIcon({ category }: { category?: string | null }) {
  const value = (category || "").toLowerCase();

  if (value.includes("coin")) return <FaGem />;
  if (value.includes("account")) return <FaGamepad />;
  if (value.includes("boost")) return <FaBolt />;
  if (value.includes("top")) return <FaWallet />;
  if (value.includes("item")) return <FaBoxOpen />;

  return <FaTag />;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const productId = Number(id);
  const productQueryKey = decodeURIComponent(id);

  let productQuery = supabase
    .from("products")
    .select("id,title,description,category,slug,image_url,status,game_name,price")
    .limit(1);

  if (Number.isFinite(productId) && productId > 0) {
    productQuery = productQuery.eq("id", productId);
  } else {
    productQuery = productQuery.eq("slug", productQueryKey);
  }

  const { data: product } = await productQuery.maybeSingle();

  if (!product || product.status !== "active") {
    return {
      title: "Product Not Found | ComePlayers",
      robots: { index: false, follow: false },
    };
  }

  const title = `${product.title} | ComePlayers`;
  const description = product.description
    ? String(product.description).slice(0, 155)
    : `Buy ${product.title}${
        product.game_name ? ` for ${product.game_name}` : ""
      } on ComePlayers.`;
  const canonicalKey = product.slug || String(product.id);
  const canonical = `/product/${canonicalKey}`;
  const image = product.image_url || fallbackImage(product.title);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ComePlayers",
      type: "website",
      images: [{ url: image, alt: product.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("cp_locale")?.value || "id-ID";
  const currency = cookieStore.get("cp_currency")?.value || "IDR";

  const formatPrice = (value: string | number | null | undefined) =>
    formatLocalizedPrice(value, locale, currency);

  const { id } = await params;
  const productId = Number(id);
  const productQueryKey = decodeURIComponent(id);

  let productQuery = supabase.from("products").select(`
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
      game_name,
      delivery_eta_minutes,
      offer_region,
      offer_platform,
      offer_server,
      offer_tags,
      has_variants,
      variant_count,
      min_variant_price,
      max_variant_price
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

  const { data: productVariants } = product.has_variants
    ? await supabase
        .from("product_variants")
        .select("id,sku,name,attributes,price,stock,status,sort_order")
        .eq("product_id", product.id)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
    : { data: [] };

  const [
    { data: sellerProfile },
    { data: sellerCompletedOrdersData },
    { data: sellerFollowerRows },
    { data: sellerActiveProducts },
  ] = product.seller_id
    ? await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,username,seller_name,seller_rating,seller_review_count,seller_status,seller_presence_mode,seller_last_seen_at,seller_delivery_sla_minutes,seller_avg_delivery_minutes,seller_on_time_rate,seller_total_deliveries,seller_late_deliveries,seller_service_level"
          )
          .eq("id", product.seller_id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id")
          .eq("seller_id", product.seller_id)
          .eq("status", "completed"),
        supabase
          .from("seller_followers")
          .select("id")
          .eq("seller_id", product.seller_id),
        supabase
          .from("products")
          .select("id")
          .eq("seller_id", product.seller_id)
          .eq("status", "active"),
      ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }];

  const sellerAverageRating = Number(sellerProfile?.seller_rating || 0);
  const sellerReviewCount = Number(sellerProfile?.seller_review_count || 0);
  const sellerCompletedOrdersCount = sellerCompletedOrdersData?.length || 0;
  const sellerFollowersCount = sellerFollowerRows?.length || 0;
  const sellerActiveProductsCount = sellerActiveProducts?.length || 0;
  const sellerReputation = calculateSellerReputation({
    averageRating: sellerAverageRating,
    reviewCount: sellerReviewCount,
    completedOrders: sellerCompletedOrdersCount,
    followersCount: sellerFollowersCount,
    activeProducts: sellerActiveProductsCount,
    sellerStatus: sellerProfile?.seller_status || null,
  });
  const sellerPresence = effectivePresence(
    sellerProfile?.seller_presence_mode,
    sellerProfile?.seller_last_seen_at
  );
  const deliveryEtaMinutes = Number(
    product.delivery_eta_minutes ||
      sellerProfile?.seller_delivery_sla_minutes ||
      60
  );
  const sellerOnTimeRate = Number(sellerProfile?.seller_on_time_rate || 100);
  const sellerAverageDelivery = Number(
    sellerProfile?.seller_avg_delivery_minutes || 0
  );

  const gameSlug = product.game_name ? slugify(product.game_name) : "";
  const categorySlug = product.category ? slugify(product.category) : "";
  const gameOffersHref = gameSlug
    ? `/games/${gameSlug}/offers${
        categorySlug ? `?category=${categorySlug}` : ""
      }`
    : "";

  let relatedProductsQuery = supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      price,
      image_url,
      category,
      game_name,
      stock,
      status,
      created_at,
      seller_id,
      seller_name,
      seller
    `)
    .eq("status", "active")
    .neq("id", product.id)
    .limit(24);

  if (product.game_name) {
    relatedProductsQuery = relatedProductsQuery.eq(
      "game_name",
      product.game_name
    );
  } else if (product.category) {
    relatedProductsQuery = relatedProductsQuery.eq("category", product.category);
  }

  const { data: relatedProductCandidates } = await relatedProductsQuery.order(
    "created_at",
    {
      ascending: false,
    }
  );

  const relatedSellerIds = Array.from(
    new Set(
      (relatedProductCandidates || [])
        .map((item: any) => item.seller_id)
        .filter((sellerId): sellerId is string => Boolean(sellerId))
    )
  );

  const [
    { data: relatedProfiles },
    { data: relatedReviews },
    { data: relatedOrders },
  ] =
    relatedSellerIds.length > 0
      ? await Promise.all([
          supabase
            .from("profiles")
            .select("id,username,seller_name,seller_rating,seller_review_count")
            .in("id", relatedSellerIds),
          supabase
            .from("reviews")
            .select("seller_id,rating")
            .in("seller_id", relatedSellerIds),
          supabase
            .from("orders")
            .select("seller_id,status")
            .in("seller_id", relatedSellerIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const relatedSellerStats = new Map<
    string,
    {
      name: string;
      ratingTotal: number;
      reviewCount: number;
      completedOrders: number;
    }
  >();

  for (const sellerId of relatedSellerIds) {
    relatedSellerStats.set(sellerId, {
      name: "Verified Seller",
      ratingTotal: 0,
      reviewCount: 0,
      completedOrders: 0,
    });
  }

  for (const profile of relatedProfiles || []) {
    if (!profile.id) continue;

    const current = relatedSellerStats.get(profile.id);
    if (!current) continue;

    current.name = profile.seller_name || profile.username || current.name;

    if (profile.seller_rating && profile.seller_review_count) {
      current.ratingTotal =
        Number(profile.seller_rating) * Number(profile.seller_review_count);
      current.reviewCount = Number(profile.seller_review_count);
    }
  }

  for (const review of relatedReviews || []) {
    if (!review.seller_id) continue;

    const current = relatedSellerStats.get(review.seller_id);
    if (!current) continue;

    current.ratingTotal += Number(review.rating || 0);
    current.reviewCount += 1;
  }

  for (const order of relatedOrders || []) {
    if (!order.seller_id || order.status !== "completed") continue;

    const current = relatedSellerStats.get(order.seller_id);
    if (!current) continue;

    current.completedOrders += 1;
  }

  const basePrice = Math.max(numberPrice(product.price), 1);
  const relatedProducts = (relatedProductCandidates || [])
    .map((item: any) => {
      const stats = item.seller_id
        ? relatedSellerStats.get(item.seller_id)
        : null;
      const sellerRating = stats?.reviewCount
        ? Number((stats.ratingTotal / stats.reviewCount).toFixed(1))
        : null;
      const priceDelta = Math.abs(numberPrice(item.price) - basePrice) / basePrice;
      const sameCategory =
        Boolean(product.category && item.category) &&
        slugify(String(item.category)) === slugify(String(product.category));
      const inStock = Number(item.stock ?? 1) > 0;

      const score =
        (sameCategory ? 45 : 0) +
        Math.max(0, 25 - priceDelta * 25) +
        (sellerRating ? sellerRating * 4 : 0) +
        Math.min(Number(stats?.completedOrders || 0), 50) * 0.25 +
        (inStock ? 8 : -10);

      return {
        ...item,
        seller_display_name:
          stats?.name || item.seller_name || item.seller || "Verified Seller",
        seller_rating: sellerRating,
        seller_review_count: stats?.reviewCount || 0,
        seller_completed_orders: stats?.completedOrders || 0,
        related_score: score,
      };
    })
    .sort((a: any, b: any) => b.related_score - a.related_score)
    .slice(0, 6);

  const imageUrl = product.image_url || fallbackImage(product.title);
  const sellerName =
    sellerProfile?.seller_name ||
    sellerProfile?.username ||
    product.seller_name ||
    product.seller ||
    "Verified Seller";
  const stock = Number(product.stock ?? 1);
  const productCanonicalPath = `/product/${product.slug || product.id}`;
  const structuredPrice = Number(convertFromIdr(product.price, currency).toFixed(2));

  const productStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Games",
          item: absoluteUrl("/games"),
        },
        ...(product.game_name
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: product.game_name,
                item: absoluteUrl(`/games/${gameSlug}`),
              },
            ]
          : []),
        {
          "@type": "ListItem",
          position: product.game_name ? 4 : 3,
          name: product.title,
          item: absoluteUrl(productCanonicalPath),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description || `Buy ${product.title} on ComePlayers.`,
      image: absoluteUrl(imageUrl),
      sku: String(product.id),
      category: product.category || "Game Product",
      brand: product.game_name
        ? {
            "@type": "Brand",
            name: product.game_name,
          }
        : undefined,
      offers: {
        "@type": "Offer",
        url: absoluteUrl(productCanonicalPath),
        priceCurrency: currency,
        price: structuredPrice,
        availability:
          stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: sellerName,
        },
      },
    },
  ];

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <MarketplaceEventTracker
        event_type="product_view"
        product_id={product.id}
        seller_id={product.seller_id}
        game_slug={gameSlug || null}
        game_name={product.game_name || null}
        category_slug={categorySlug || null}
        category_name={product.category || null}
      />

      <RecentlyViewedTracker productId={product.id} />

      <JsonLd data={productStructuredData} />

      <section className="border-b border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_35%)]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <MarketplaceBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Games", href: "/games" },
              ...(product.game_name
                ? [{ label: product.game_name, href: `/games/${gameSlug}` }]
                : []),
              ...(product.category && gameOffersHref
                ? [{ label: product.category, href: gameOffersHref }]
                : []),
              { label: product.title },
            ]}
          />

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
                    <CategoryIcon category={product.category} />
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
                    Delivery ETA: {formatDeliveryEta(deliveryEtaMinutes)}
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                    Region: {product.offer_region || "Global"}
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                    Platform: {product.offer_platform || "Any"}
                  </span>

                  {product.offer_server ? (
                    <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                      Server: {product.offer_server}
                    </span>
                  ) : null}

                  <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-300">
                    {currency}
                  </span>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
                <ProductVariantPurchase
                  productId={Number(product.id)}
                  sellerId={product.seller_id || null}
                  basePrice={product.price}
                  baseStock={Number(product.stock || 0)}
                  variants={(productVariants || []).map((variant) => ({
                    id: Number(variant.id),
                    sku: String(variant.sku || ""),
                    name: String(variant.name || "Variant"),
                    attributes: (variant.attributes || {}) as Record<string, unknown>,
                    price: variant.price,
                    stock: Number(variant.stock || 0),
                  }))}
                />

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <FaShieldAlt className="text-emerald-300" />
                    <p className="mt-2 font-bold">Escrow Protected</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <FaClock className="text-yellow-300" />
                    <p className="mt-2 font-bold">{formatDeliveryEta(deliveryEtaMinutes)} ETA</p>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{sellerName}</p>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          sellerPresence === "online"
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                            : sellerPresence === "away"
                              ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                              : "border-slate-400/30 bg-slate-400/10 text-slate-400"
                        }`}
                      >
                        {sellerPresence}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-yellow-300">
                      <FaStar />
                      {sellerAverageRating > 0
                        ? `${sellerAverageRating.toFixed(
                            1
                          )} rating • ${sellerReviewCount} reviews`
                        : "New seller"}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-5 rounded-2xl border p-4 ${sellerReputation.colorClass}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">
                    Seller Reputation
                  </p>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-4xl font-black text-white">
                        {sellerReputation.score}
                      </p>
                      <p className="mt-1 text-sm font-black">
                        {sellerReputation.badge} {sellerReputation.tierLabel}
                      </p>
                    </div>

                    <div className="text-right text-xs text-slate-300">
                      <p>{sellerCompletedOrdersCount} completed</p>
                      <p>{sellerFollowersCount} followers</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-300">
                    {sellerReputation.description}
                  </p>
                </div>

                <div className={`mt-5 rounded-2xl border p-4 ${serviceLevelClass(sellerProfile?.seller_service_level)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">
                        Delivery Service Level
                      </p>
                      <p className="mt-2 text-xl font-black">
                        {serviceLevelLabel(sellerProfile?.seller_service_level)} Seller
                      </p>
                    </div>
                    <FaAward className="text-2xl" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">Delivery Promise</p>
                      <p className="mt-1 font-black text-white">{formatDeliveryEta(deliveryEtaMinutes)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">On-Time Rate</p>
                      <p className="mt-1 font-black text-white">{sellerOnTimeRate.toFixed(1)}%</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-300">
                    {serviceLevelDescription(sellerProfile?.seller_service_level)}
                    {sellerAverageDelivery > 0
                      ? ` Average delivery: ${formatDeliveryEta(sellerAverageDelivery)}.`
                      : ""}
                  </p>
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

            {relatedProducts && relatedProducts.length > 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">
                      Smart Related Offers
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Ranked by same game, category match, similar price, stock,
                      and seller reputation.
                    </p>
                  </div>

                  {gameOffersHref ? (
                    <Link
                      href={gameOffersHref}
                      className="rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
                    >
                      View All Offers
                    </Link>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {relatedProducts.map((item) => {
                    const itemHref = `/product/${item.slug || item.id}`;
                    const itemImage =
                      item.image_url || fallbackImage(item.title);

                    return (
                      <Link
                        key={item.id}
                        href={itemHref}
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-cyan-400"
                      >
                        <div className="relative h-36 bg-black">
                          <Image
                            src={itemImage}
                            alt={item.title}
                            fill
                            className="object-cover transition group-hover:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </div>

                        <div className="p-4">
                          <p className="line-clamp-2 font-black text-white group-hover:text-cyan-300">
                            {item.title}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {item.game_name || product.game_name || "Game"}
                            {item.category ? ` • ${item.category}` : ""}
                          </p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <span className="font-black text-cyan-300">
                              {formatPrice(item.price)}
                            </span>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                              Stock {Number(item.stock ?? 1)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-2">
                              <FaStore className="text-cyan-300" />
                              {item.seller_display_name}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <FaStar className="text-yellow-300" />
                              {item.seller_rating
                                ? `${item.seller_rating} rating`
                                : "New seller"}
                              {Number(item.seller_completed_orders || 0) > 0
                                ? ` • ${item.seller_completed_orders} completed`
                                : ""}
                            </span>
                            {slugify(String(item.category || "")) ===
                            categorySlug ? (
                              <span className="inline-flex items-center gap-2 text-emerald-300">
                                <FaAward /> Same category match
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <RecommendedProducts
              currentProductId={product.id}
              title="Recommended For You"
              subtitle="More offers matched from your recently viewed games and categories."
              compact
            />

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

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-400">Currency</span>
                  <span className="font-bold text-cyan-300">{currency}</span>
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