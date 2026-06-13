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
  FaWallet,
} from "react-icons/fa";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ slug: string }>;
};

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


const FALLBACK_MARKETPLACE_CATEGORIES = [
  { id: 1, name: "Game Accounts", slug: "game-accounts", icon: null },
  { id: 2, name: "Game Coins", slug: "game-coins", icon: null },
  { id: 3, name: "Game Items", slug: "game-items", icon: null },
  { id: 4, name: "Boosting", slug: "boosting", icon: null },
  { id: 5, name: "Top Up", slug: "top-up", icon: null },
  { id: 6, name: "Gift Cards", slug: "gift-cards", icon: null },
];

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
      : FALLBACK_MARKETPLACE_CATEGORIES;

  const categories = marketplaceCategoryRows.map((category: any) => ({
    title: category.name,
    slug: category.slug,
    icon: getCategoryIcon(category.name),
    count: categoryCounts[normalizeCategorySlug(category.slug)] ||
      categoryCounts[normalizeCategorySlug(category.name)] ||
      0,
  }));

  return (
    <main className="min-h-screen bg-[#050816] text-white">
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
          <Link href="/games" className="text-sm font-black text-cyan-300">
            ← Back to Browse Games
          </Link>

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