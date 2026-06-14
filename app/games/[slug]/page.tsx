import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FaBolt,
  FaBoxOpen,
  FaFire,
  FaGamepad,
  FaGem,
  FaGift,
  FaShieldAlt,
  FaStar,
  FaStore,
  FaTags,
  FaTrophy,
  FaUserShield,
  FaWallet,
} from "react-icons/fa";
import MarketplaceBreadcrumbs from "@/components/marketplace/MarketplaceBreadcrumbs";
import FeaturedSellers from "@/components/sellers/FeaturedSellers";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ slug: string }>;
};


const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://comeplayers.com").replace(/\/$/, "");

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
type JsonItem = {
  id?: number | string | null;
  name?: string | null;
  slug?: string | null;
};

function safeArray(value: unknown): JsonItem[] {
  return Array.isArray(value) ? value : [];
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getGameImage(game: any) {
  return (
    game.background_image ||
    game.cover_image_url ||
    game.image_url ||
    `https://placehold.co/1400x800/020617/22d3ee?text=${encodeURIComponent(
      game.name
    )}`
  );
}

function formatPrice(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    notation: Number(value || 0) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function buildGameFaqs(gameName: string) {
  return [
    {
      question: `How do I buy ${gameName} offers on ComePlayers?`,
      answer: `Choose a ${gameName} category, compare seller price and reputation, open the product detail, then continue to checkout.`,
    },
    {
      question: `What ${gameName} products can I find here?`,
      answer: `You can browse available ${gameName} accounts, coins, items, boosting, top-up, gift cards, and other marketplace services depending on seller listings.`,
    },
    {
      question: `Is buying ${gameName} products on ComePlayers safe?`,
      answer: `ComePlayers is designed as a secure marketplace flow where buyers can review product details, seller information, and order status before completing a purchase.`,
    },
    {
      question: `How long does ${gameName} delivery take?`,
      answer: `Delivery time depends on the seller and product type. Always check the product detail page and order instructions before buying.`,
    },
  ];
}

function normalizeCategorySlug(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function offersUrl(gameSlug: string, categoryName?: string) {
  if (!categoryName) return `/games/${gameSlug}/offers`;

  const params = new URLSearchParams({ category: categoryName });
  return `/games/${gameSlug}/offers?${params.toString()}`;
}



export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: game } = await supabase
    .from("game_master")
    .select("name,slug,background_image,cover_image_url,image_url,offer_count")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    return {
      title: "Game Not Found | ComePlayers",
      robots: { index: false, follow: false },
    };
  }

  const title = `${game.name} Marketplace | ComePlayers`;
  const description = `Buy and sell ${game.name} accounts, coins, items, boosting, top up, and gift card offers on ComePlayers.`;
  const image = getGameImage(game);
  const canonical = `/games/${game.slug}`;

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
      images: [{ url: image, alt: `${game.name} marketplace` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function getCategoryIcon(categoryName: string) {
  const slug = normalizeCategorySlug(categoryName);

  if (slug.includes("account")) return FaGamepad;
  if (slug.includes("coin") || slug.includes("currency")) return FaGem;
  if (slug.includes("item")) return FaBoxOpen;
  if (slug.includes("boost")) return FaBolt;
  if (slug.includes("top-up") || slug.includes("topup")) return FaWallet;
  if (slug.includes("gift")) return FaGift;

  return FaTags;
}

function sellerCreateUrl(gameSlug: string, categoryName?: string) {
  const params = new URLSearchParams({ game: gameSlug });

  if (categoryName) {
    params.set("category", categoryName);
  }

  return `/seller/products/new?${params.toString()}`;
}

export default async function GameDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const { data: game } = await supabase
    .from("game_master")
    .select(`
      id,
      name,
      slug,
      image_url,
      cover_image_url,
      background_image,
      offer_count,
      is_trending,
      is_featured,
      rating,
      metacritic,
      released,
      genres,
      platforms,
      stores
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (!game) notFound();

  const gameName = titleCase(game.name);
  const heroImage = getGameImage(game);
  const genres = safeArray(game.genres);
  const platforms = safeArray(game.platforms);
  const stores = safeArray(game.stores);

  const productsQuery = supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      price,
      image_url,
      category,
      status,
      seller_id,
      seller_name,
      created_at
    `)
    .or(`game_slug.eq.${game.slug},game.eq.${gameName},game_name.eq.${gameName}`)
    .eq("status", "active");

  const [
    { data: products },
    { data: categoryProducts },
    { data: marketplaceCategories },
  ] = await Promise.all([
    productsQuery.order("created_at", { ascending: false }).limit(8),
    supabase
      .from("products")
      .select("category")
      .or(`game_slug.eq.${game.slug},game.eq.${gameName},game_name.eq.${gameName}`)
      .eq("status", "active"),
    supabase
      .from("categories")
      .select("id,name,slug,icon")
      .order("id", { ascending: true }),
  ]);

  const categoryCounts = (categoryProducts || []).reduce<Record<string, number>>(
    (acc, item: any) => {
      const key = normalizeCategorySlug(item.category);
      if (!key) return acc;

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const totalOffers = categoryProducts?.length || game.offer_count || 0;

  const marketplaceCategoryRows =
    marketplaceCategories && marketplaceCategories.length > 0
      ? marketplaceCategories
      : Array.from(
          new Set(
            (categoryProducts || [])
              .map((item: any) => String(item.category || "").trim())
              .filter(Boolean)
          )
        ).map((name, index) => ({
          id: `product-category-${index}`,
          name,
          slug: normalizeCategorySlug(name),
          icon: null,
        }));

  const sellerIds = Array.from(
    new Set(
      (products || [])
        .map((product: any) => product.seller_id)
        .filter((sellerId): sellerId is string => Boolean(sellerId))
    )
  );

  const [{ data: sellerProfiles }, { data: sellerReviews }, { data: sellerOrders }] =
    sellerIds.length > 0
      ? await Promise.all([
          supabase
            .from("profiles")
            .select("id,username,seller_name,avatar_url,seller_rating,seller_review_count")
            .in("id", sellerIds),
          supabase.from("reviews").select("seller_id,rating").in("seller_id", sellerIds),
          supabase.from("orders").select("seller_id,status").in("seller_id", sellerIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const sellerStats = new Map<
    string,
    {
      id: string;
      name: string;
      avatarUrl?: string | null;
      ratingTotal: number;
      reviewCount: number;
      completedOrders: number;
      activeOffers: number;
    }
  >();

  for (const product of products || []) {
    if (!product.seller_id) continue;

    const current = sellerStats.get(product.seller_id) || {
      id: product.seller_id,
      name: product.seller_name || "ComePlayers Seller",
      avatarUrl: null,
      ratingTotal: 0,
      reviewCount: 0,
      completedOrders: 0,
      activeOffers: 0,
    };

    current.activeOffers += 1;
    sellerStats.set(product.seller_id, current);
  }

  for (const profile of sellerProfiles || []) {
    if (!profile.id) continue;

    const current = sellerStats.get(profile.id) || {
      id: profile.id,
      name: "ComePlayers Seller",
      avatarUrl: null,
      ratingTotal: 0,
      reviewCount: 0,
      completedOrders: 0,
      activeOffers: 0,
    };

    current.name =
      profile.seller_name || profile.username || current.name || "ComePlayers Seller";
    current.avatarUrl = profile.avatar_url || current.avatarUrl;

    if (profile.seller_rating && profile.seller_review_count) {
      current.ratingTotal = Number(profile.seller_rating) * Number(profile.seller_review_count);
      current.reviewCount = Number(profile.seller_review_count);
    }

    sellerStats.set(profile.id, current);
  }

  for (const review of sellerReviews || []) {
    if (!review.seller_id) continue;

    const current = sellerStats.get(review.seller_id);
    if (!current) continue;

    current.ratingTotal += Number(review.rating || 0);
    current.reviewCount += 1;
  }

  for (const order of sellerOrders || []) {
    if (!order.seller_id || order.status !== "completed") continue;

    const current = sellerStats.get(order.seller_id);
    if (!current) continue;

    current.completedOrders += 1;
  }

  const topSellers = Array.from(sellerStats.values())
    .map((seller) => ({
      ...seller,
      rating: seller.reviewCount
        ? Number((seller.ratingTotal / seller.reviewCount).toFixed(1))
        : null,
    }))
    .sort((a, b) => {
      const completedDiff = b.completedOrders - a.completedOrders;
      if (completedDiff !== 0) return completedDiff;

      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;

      return b.activeOffers - a.activeOffers;
    })
    .slice(0, 4);

  const faqs = buildGameFaqs(gameName);

  const categories = marketplaceCategoryRows.map((category: any) => ({
    title: category.name,
    slug: category.slug || normalizeCategorySlug(category.name),
    icon: getCategoryIcon(category.name),
    count:
      categoryCounts[normalizeCategorySlug(category.slug)] ||
      categoryCounts[normalizeCategorySlug(category.name)] ||
      0,
  }));

  const gameUrl = `/games/${game.slug}`;
  const gameStructuredData = [
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
        {
          "@type": "ListItem",
          position: 3,
          name: gameName,
          item: absoluteUrl(gameUrl),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${gameName} Marketplace`,
      description: `Buy and sell ${gameName} accounts, coins, items, boosting, top-up, and digital game services safely on ComePlayers.`,
      url: absoluteUrl(gameUrl),
      image: absoluteUrl(heroImage),
      isPartOf: {
        "@type": "WebSite",
        name: "ComePlayers",
        url: SITE_URL,
      },
      about: {
        "@type": "VideoGame",
        name: gameName,
        image: absoluteUrl(heroImage),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${gameName} Marketplace Categories`,
      itemListElement: categories.map((category, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: category.title,
        url: absoluteUrl(offersUrl(game.slug, category.title)),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <JsonLd data={gameStructuredData} />
      <section
        className="relative border-b border-cyan-400/20 bg-cover bg-center"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(2,6,23,.98), rgba(2,6,23,.82), rgba(2,6,23,.48)),
            url(${heroImage})
          `,
        }}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-20">
          <MarketplaceBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Games", href: "/games" },
              { label: gameName },
            ]}
          />

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <div className="flex flex-wrap gap-3">
                {game.is_trending && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-xs font-black text-black">
                    <FaFire /> Trending
                  </span>
                )}

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-200">
                  <FaShieldAlt /> Secure Marketplace
                </span>
              </div>

              <h1 className="mt-6 text-5xl font-black md:text-7xl">
                {gameName}
              </h1>

              <p className="mt-5 max-w-2xl text-slate-200">
                Buy and sell {gameName} accounts, coins, items, boosting, top-up,
                and digital game services safely on ComePlayers.
              </p>

              <div className="mt-8 flex gap-4">
                <Link
                  href={offersUrl(game.slug)}
                  className="rounded-xl bg-cyan-400 px-7 py-4 font-black text-black"
                >
                  View Offers
                </Link>

                <Link
                  href={sellerCreateUrl(game.slug)}
                  className="rounded-xl border border-cyan-400 px-7 py-4 font-black text-cyan-300"
                >
                  Create Offer
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/45 p-5 backdrop-blur">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs text-slate-300">Offers</p>
                  <p className="text-3xl font-black text-cyan-300">
                    {totalOffers}
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                  <p className="text-xs text-slate-300">Rating</p>
                  <p className="flex items-center gap-2 text-3xl font-black text-yellow-300">
                    <FaStar /> {game.rating ? Number(game.rating).toFixed(1) : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-slate-400">Metacritic</p>
                  <p className="text-2xl font-black">{game.metacritic || "-"}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-slate-400">Released</p>
                  <p className="text-sm font-black">{game.released || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black">
                <FaGamepad className="text-cyan-300" />
                Marketplace Categories
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map(({ title, icon: Icon, count }) => (
                  <Link
                    key={title}
                    href={offersUrl(game.slug, title)}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5 hover:border-cyan-400"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                        <Icon />
                      </div>

                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
                        {count} offers
                      </span>
                    </div>

                    <h3 className="mt-4 font-black">{title}</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Browse {title.toLowerCase()} offers.
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black">
                  Latest {gameName} Offers
                </h2>

                <Link
                  href={offersUrl(game.slug)}
                  className="text-sm font-black text-cyan-300"
                >
                  View all →
                </Link>
              </div>

              {!products || products.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
                  <p className="font-black text-white">No offers yet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Be the first seller to create an offer for {gameName}.
                  </p>
                  <Link
                    href={sellerCreateUrl(game.slug)}
                    className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-black text-black"
                  >
                    Create First Offer
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product: any) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug || product.id}`}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 hover:border-cyan-400"
                    >
                      <div
                        className="h-32 bg-cover bg-center"
                        style={{
                          backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.8)), url(${
                            product.image_url || heroImage
                          })`,
                        }}
                      />

                      <div className="p-4">
                        <p className="line-clamp-2 font-black">
                          {product.title}
                        </p>

                        <p className="mt-3 text-lg font-black text-cyan-300">
                          {formatPrice(product.price)}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          {product.category || "Game Product"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>



            {topSellers.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black">
                  <FaTrophy className="text-yellow-300" />
                  Top {gameName} Sellers
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Trusted sellers with active {gameName} offers, completed orders, and buyer reviews.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {topSellers.map((seller) => (
                    <div
                      key={seller.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 bg-cover bg-center text-cyan-300"
                          style={
                            seller.avatarUrl
                              ? { backgroundImage: `url(${seller.avatarUrl})` }
                              : undefined
                          }
                        >
                          {!seller.avatarUrl && <FaUserShield />}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-black">{seller.name}</p>
                          <p className="text-xs text-slate-400">
                            {seller.activeOffers} active offers
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3">
                          <p className="text-xs text-slate-400">Rating</p>
                          <p className="mt-1 flex items-center gap-1 font-black text-yellow-300">
                            <FaStar /> {seller.rating ? seller.rating.toFixed(1) : "New"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                          <p className="text-xs text-slate-400">Orders</p>
                          <p className="mt-1 font-black text-emerald-300">
                            {formatCount(seller.completedOrders)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <FeaturedSellers
                compact
                gameSlug={game.slug}
                limit={4}
                title={`Featured ${gameName} Sellers`}
                subtitle={`Top ${gameName} sellers ranked by orders, reviews, active offers, and conversion.`}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black">
                <FaTags className="text-cyan-300" />
                Popular {gameName} Searches
              </h2>

              <div className="mt-5 flex flex-wrap gap-3">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={offersUrl(game.slug, category.title)}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200 hover:border-cyan-300"
                  >
                    {gameName} {category.title}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-black">{gameName} Marketplace FAQ</h2>

              <div className="mt-6 space-y-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <h3 className="font-black text-white">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black">
                <FaTags className="text-cyan-300" />
                Game Information
              </h2>

              <div className="mt-6 grid gap-8 md:grid-cols-2">
                <div>
                  <p className="text-sm font-black text-slate-400">Genres</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {genres.length > 0 ? (
                      genres.map((genre) => (
                        <span
                          key={genre.slug || genre.name}
                          className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        >
                          {genre.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">No genres available</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-black text-slate-400">Platforms</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {platforms.length > 0 ? (
                      platforms.map((platform) => (
                        <span
                          key={platform.slug || platform.name}
                          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200"
                        >
                          {platform.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">No platforms available</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-xl font-black">Quick Actions</h3>

              <div className="mt-5 space-y-3">
                <Link
                  href={offersUrl(game.slug)}
                  className="block rounded-xl bg-cyan-400 px-5 py-3 text-center font-black text-black"
                >
                  Browse Offers
                </Link>

                <Link
                  href={sellerCreateUrl(game.slug)}
                  className="block rounded-xl border border-white/10 px-5 py-3 text-center font-black"
                >
                  Sell This Game
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="flex items-center gap-2 text-xl font-black">
                <FaStore className="text-cyan-300" />
                Stores
              </h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {stores.length > 0 ? (
                  stores.map((store) => (
                    <span
                      key={store.slug || store.name}
                      className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    >
                      {store.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No store data</span>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}