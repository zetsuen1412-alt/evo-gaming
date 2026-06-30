"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FaBalanceScale,
  FaBoxOpen,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaFilter,
  FaGlobe,
  FaLaptop,
  FaSearch,
  FaShieldAlt,
  FaShoppingCart,
  FaSignal,
  FaStar,
  FaStore,
  FaTimes,
  FaTrophy,
} from "react-icons/fa";
import MarketplaceBreadcrumbs from "@/components/marketplace/MarketplaceBreadcrumbs";
import { useCurrency } from "@/components/CurrencyProvider";
import { trackMarketplaceEvent } from "@/lib/marketplace-events-client";
import { formatDeliveryEta, serviceLevelLabel } from "@/lib/sellerServiceLevel";

type Game = {
  id: number;
  name: string;
  slug: string;
  background_image?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  offer_count?: number | null;
  rating?: number | null;
};

type FacetItem = {
  value: string;
  label: string;
  count: number;
};

type Product = {
  id: number;
  title: string;
  slug?: string | null;
  image_url?: string | null;
  category?: string | null;
  seller_id?: string | null;
  seller_display_name: string;
  seller_rating: number;
  seller_review_count: number;
  seller_completed_orders: number;
  seller_on_time_rate: number;
  seller_service_level: string;
  seller_presence: "online" | "away" | "offline";
  seller_verified: boolean;
  effective_price: number;
  effective_max_price: number;
  effective_stock: number;
  delivery_eta: number;
  has_variants?: boolean | null;
  variant_count?: number | null;
  regions: string[];
  platforms: string[];
  servers: string[];
  ranking_score: number;
  ranking_label: string;
  ranking_reasons: string[];
  href: string;
};

type OfferResponse = {
  products: Product[];
  facets: {
    categories: FacetItem[];
    regions: FacetItem[];
    platforms: FacetItem[];
    serviceLevels: FacetItem[];
    price: { min: number; max: number; median: number };
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  rankingVersion?: string;
  error?: string;
};

type FilterState = {
  query: string;
  category: string;
  region: string;
  platform: string;
  serviceLevel: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  maxDelivery: string;
  onlineOnly: boolean;
  inStockOnly: boolean;
  sort: string;
  page: number;
};

const SORTS = [
  { label: "Recommended", value: "recommended" },
  { label: "Lowest Price", value: "price_asc" },
  { label: "Highest Price", value: "price_desc" },
  { label: "Fastest Delivery", value: "delivery_asc" },
  { label: "Best Rating", value: "rating_desc" },
  { label: "Most Completed", value: "orders_desc" },
  { label: "Newest", value: "newest" },
  { label: "Highest Stock", value: "stock_desc" },
];

const DELIVERY_OPTIONS = [
  { label: "Any delivery time", value: "" },
  { label: "Within 30 minutes", value: "30" },
  { label: "Within 1 hour", value: "60" },
  { label: "Within 2 hours", value: "120" },
  { label: "Within 4 hours", value: "240" },
  { label: "Within 24 hours", value: "1440" },
];

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function gameImage(game: Game) {
  return (
    game.background_image ||
    game.cover_image_url ||
    game.image_url ||
    `https://placehold.co/1400x800/020617/22d3ee?text=${encodeURIComponent(game.name)}`
  );
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

function presenceClass(presence: Product["seller_presence"]) {
  if (presence === "online") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  if (presence === "away") return "border-yellow-400/40 bg-yellow-400/10 text-yellow-300";
  return "border-slate-400/30 bg-slate-400/10 text-slate-400";
}

function sellerCreateUrl(gameSlug: string, category: string) {
  const params = new URLSearchParams({ game: gameSlug });
  if (category) params.set("category", category);
  return `/seller/products/new?${params.toString()}`;
}

function initialFilters(searchParams: ReturnType<typeof useSearchParams>): FilterState {
  return {
    query: searchParams.get("q") || "",
    category: searchParams.get("category") || "",
    region: searchParams.get("region") || "",
    platform: searchParams.get("platform") || "",
    serviceLevel: searchParams.get("serviceLevel") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    minRating: searchParams.get("minRating") || "",
    maxDelivery: searchParams.get("maxDelivery") || "",
    onlineOnly: searchParams.get("onlineOnly") === "true",
    inStockOnly: searchParams.get("inStockOnly") !== "false",
    sort: searchParams.get("sort") || "recommended",
    page: Math.max(1, Number(searchParams.get("page") || 1)),
  };
}

function ComparisonModal({
  offers,
  formatPrice,
  onClose,
  onRemove,
}: {
  offers: Product[];
  formatPrice: (value: number | string | null | undefined) => string;
  onClose: () => void;
  onRemove: (id: number) => void;
}) {
  const rows = [
    {
      label: "Price",
      render: (offer: Product) => (
        <span className="font-black text-cyan-300">{formatPrice(offer.effective_price)}</span>
      ),
    },
    {
      label: "Seller",
      render: (offer: Product) => offer.seller_display_name,
    },
    {
      label: "Rating",
      render: (offer: Product) =>
        offer.seller_rating > 0
          ? `${offer.seller_rating.toFixed(1)} (${formatCount(offer.seller_review_count)})`
          : "New seller",
    },
    {
      label: "Completed",
      render: (offer: Product) => formatCount(offer.seller_completed_orders),
    },
    {
      label: "Delivery",
      render: (offer: Product) => formatDeliveryEta(offer.delivery_eta),
    },
    {
      label: "On-time rate",
      render: (offer: Product) => `${offer.seller_on_time_rate.toFixed(1)}%`,
    },
    {
      label: "Service level",
      render: (offer: Product) => serviceLevelLabel(offer.seller_service_level),
    },
    {
      label: "Stock",
      render: (offer: Product) => formatCount(offer.effective_stock),
    },
    {
      label: "Region",
      render: (offer: Product) => offer.regions.join(", ") || "Global",
    },
    {
      label: "Platform",
      render: (offer: Product) => offer.platforms.join(", ") || "Any",
    },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm md:items-center md:p-8">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#07101f] shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Offer Comparison
            </p>
            <h2 className="mt-1 text-2xl font-black">Compare {offers.length} offers</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-3 text-slate-300 hover:border-cyan-400 hover:text-white"
            aria-label="Close comparison"
          >
            <FaTimes />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="sticky left-0 z-10 w-44 bg-[#07101f] px-5 py-4 text-left text-slate-400">
                  Feature
                </th>
                {offers.map((offer) => (
                  <th key={offer.id} className="min-w-[240px] px-5 py-5 text-left align-top">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                          {offer.ranking_label}
                        </span>
                        <p className="mt-3 line-clamp-2 text-base font-black text-white">
                          {offer.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(offer.id)}
                        className="rounded-lg border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                        aria-label={`Remove ${offer.title} from comparison`}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-white/10">
                  <th className="sticky left-0 z-10 bg-[#07101f] px-5 py-4 text-left font-black text-slate-300">
                    {row.label}
                  </th>
                  {offers.map((offer) => (
                    <td key={`${row.label}-${offer.id}`} className="px-5 py-4 text-slate-200">
                      {row.render(offer)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="sticky left-0 z-10 bg-[#07101f] px-5 py-5 text-left font-black text-slate-300">
                  Action
                </th>
                {offers.map((offer) => (
                  <td key={`action-${offer.id}`} className="px-5 py-5">
                    <Link
                      href={offer.href}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-black text-black hover:bg-cyan-300"
                    >
                      <FaShoppingCart /> View Offer
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function GameOffersClient({ game }: { game: Game }) {
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => initialFilters(searchParams));
  const [response, setResponse] = useState<OfferResponse>({
    products: [],
    facets: {
      categories: [],
      regions: [],
      platforms: [],
      serviceLevels: [],
      price: { min: 0, max: 0, median: 0 },
    },
    pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [compareOffers, setCompareOffers] = useState<Product[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const gameName = titleCase(game.name);
  const heroImage = gameImage(game);

  const buildParams = useCallback(
    (state: FilterState) => {
      const params = new URLSearchParams({
        game: game.slug,
        page: String(state.page),
        pageSize: "24",
        sort: state.sort,
        inStockOnly: String(state.inStockOnly),
      });

      if (state.query.trim()) params.set("q", state.query.trim());
      if (state.category) params.set("category", state.category);
      if (state.region) params.set("region", state.region);
      if (state.platform) params.set("platform", state.platform);
      if (state.serviceLevel) params.set("serviceLevel", state.serviceLevel);
      if (state.minPrice) params.set("minPrice", state.minPrice);
      if (state.maxPrice) params.set("maxPrice", state.maxPrice);
      if (state.minRating) params.set("minRating", state.minRating);
      if (state.maxDelivery) params.set("maxDelivery", state.maxDelivery);
      if (state.onlineOnly) params.set("onlineOnly", "true");

      return params;
    },
    [game.slug]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = buildParams(filters);

      const publicParams = new URLSearchParams(params);
      publicParams.delete("game");
      if (filters.inStockOnly) publicParams.delete("inStockOnly");
      if (filters.page === 1) publicParams.delete("page");
      if (filters.sort === "recommended") publicParams.delete("sort");
      publicParams.delete("pageSize");

      const queryString = publicParams.toString();
      router.replace(
        queryString
          ? `/games/${game.slug}/offers?${queryString}`
          : `/games/${game.slug}/offers`,
        { scroll: false }
      );

      try {
        const fetchResponse = await fetch(`/api/products/by-game?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await fetchResponse.json()) as OfferResponse;
        if (!fetchResponse.ok) throw new Error(json.error || "Failed to load offers.");
        setResponse(json);
      } catch (fetchError) {
        if ((fetchError as DOMException).name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load offers.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, filters.query ? 280 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [buildParams, filters, game.slug, router]);

  useEffect(() => {
    trackMarketplaceEvent({
      event_type: "offer_view",
      game_slug: game.slug,
      game_name: game.name,
      category_slug: filters.category || null,
      category_name: filters.category || null,
    });
  }, [game.slug, game.name, filters.category]);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.query,
        filters.category,
        filters.region,
        filters.platform,
        filters.serviceLevel,
        filters.minPrice,
        filters.maxPrice,
        filters.minRating,
        filters.maxDelivery,
        filters.onlineOnly ? "online" : "",
        filters.inStockOnly ? "stock" : "",
      ].filter(Boolean).length,
    [filters]
  );

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  }

  function clearFilters() {
    setFilters({
      query: "",
      category: "",
      region: "",
      platform: "",
      serviceLevel: "",
      minPrice: "",
      maxPrice: "",
      minRating: "",
      maxDelivery: "",
      onlineOnly: false,
      inStockOnly: true,
      sort: "recommended",
      page: 1,
    });
  }

  function toggleCompare(product: Product) {
    setCompareOffers((current) => {
      if (current.some((item) => item.id === product.id)) {
        return current.filter((item) => item.id !== product.id);
      }
      if (current.length >= 4) {
        window.alert("You can compare up to 4 offers at once.");
        return current;
      }
      return [...current, product];
    });
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section
        className="relative border-b border-cyan-400/20 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(2,6,23,.98), rgba(2,6,23,.82), rgba(2,6,23,.55)), url(${heroImage})`,
        }}
      >
        <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16">
          <MarketplaceBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Games", href: "/games" },
              { label: gameName, href: `/games/${game.slug}` },
              { label: filters.category ? titleCase(filters.category) : "Offers" },
            ]}
          />

          <h1 className="mt-8 text-5xl font-black md:text-7xl">{gameName} Offers</h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Compare trusted sellers by price, delivery speed, rating, stock, region, and platform.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">
              {response.pagination.total || game.offer_count || 0} matching offers
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
              <FaStar /> {game.rating ? Number(game.rating).toFixed(1) : "-"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
              <FaShieldAlt /> Escrow Protected
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5 lg:sticky lg:top-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <FaFilter className="text-cyan-300" /> Filters
              </h2>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                {activeFilterCount}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Category</span>
                <select
                  value={filters.category}
                  onChange={(event) => updateFilter("category", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">All categories</option>
                  {response.facets.categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Price range</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filters.minPrice}
                    onChange={(event) => updateFilter("minPrice", event.target.value)}
                    placeholder="Min"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                  />
                  <input
                    type="number"
                    min="0"
                    value={filters.maxPrice}
                    onChange={(event) => updateFilter("maxPrice", event.target.value)}
                    placeholder="Max"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                  />
                </div>
                {response.facets.price.median > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Median: {formatPrice(response.facets.price.median)}
                  </p>
                ) : null}
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Region</span>
                <select
                  value={filters.region}
                  onChange={(event) => updateFilter("region", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">All regions</option>
                  {response.facets.regions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Platform</span>
                <select
                  value={filters.platform}
                  onChange={(event) => updateFilter("platform", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">All platforms</option>
                  {response.facets.platforms.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Seller level</span>
                <select
                  value={filters.serviceLevel}
                  onChange={(event) => updateFilter("serviceLevel", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">All seller levels</option>
                  {response.facets.serviceLevels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {titleCase(item.label)} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Minimum rating</span>
                <select
                  value={filters.minRating}
                  onChange={(event) => updateFilter("minRating", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">Any rating</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">Delivery speed</span>
                <select
                  value={filters.maxDelivery}
                  onChange={(event) => updateFilter("maxDelivery", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none focus:border-cyan-400"
                >
                  {DELIVERY_OPTIONS.map((item) => (
                    <option key={item.value || "any"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <span className="text-sm font-bold">Online sellers only</span>
                <input
                  type="checkbox"
                  checked={filters.onlineOnly}
                  onChange={(event) => updateFilter("onlineOnly", event.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <span className="text-sm font-bold">In stock only</span>
                <input
                  type="checkbox"
                  checked={filters.inStockOnly}
                  onChange={(event) => updateFilter("inStockOnly", event.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>

              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl border border-white/10 px-4 py-3 font-black text-slate-300 hover:border-cyan-400 hover:text-white"
              >
                Reset Filters
              </button>
            </div>
          </aside>

          <div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={filters.query}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    placeholder={`Search ${gameName} offers, seller, region, platform...`}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-11 py-4 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                  />
                </div>
                <select
                  value={filters.sort}
                  onChange={(event) => updateFilter("sort", event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 outline-none focus:border-cyan-400"
                >
                  {SORTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <p>
                  {loading ? "Ranking marketplace offers..." : `${response.pagination.total} offers found`}
                </p>
                <p className="flex items-center gap-2 text-xs">
                  <FaTrophy className="text-yellow-300" /> Recommended ranking considers price, seller trust, delivery, stock, and availability.
                </p>
              </div>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center text-slate-400">
                  Loading and ranking offers...
                </div>
              ) : response.products.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
                  <h2 className="text-2xl font-black">No offers match these filters</h2>
                  <p className="mt-2 text-slate-400">Reset filters or become the first seller for this selection.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button onClick={clearFilters} className="rounded-xl border border-cyan-400/40 px-6 py-3 font-black text-cyan-300">
                      Reset Filters
                    </button>
                    <Link
                      href={sellerCreateUrl(game.slug, filters.category)}
                      className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-black"
                    >
                      Create Offer
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-2">
                  {response.products.map((product) => {
                    const compared = compareOffers.some((item) => item.id === product.id);
                    return (
                      <article
                        key={product.id}
                        className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:border-cyan-400/60"
                      >
                        <div className="grid md:grid-cols-[210px_1fr]">
                          <Link
                            href={product.href}
                            className="relative min-h-48 bg-cover bg-center"
                            style={{
                              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.88)), url(${product.image_url || heroImage})`,
                            }}
                          >
                            <span className="absolute left-4 top-4 rounded-full bg-black/75 px-3 py-1 text-xs font-black text-cyan-300">
                              {product.category || "Game Product"}
                            </span>
                            <span className="absolute bottom-4 left-4 rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-black">
                              {product.ranking_label}
                            </span>
                          </Link>

                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <Link href={product.href} className="line-clamp-2 text-lg font-black hover:text-cyan-300">
                                  {product.title}
                                </Link>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="inline-flex items-center gap-1 text-slate-300">
                                    <FaStore className="text-cyan-300" /> {product.seller_display_name}
                                  </span>
                                  <span className={`rounded-full border px-2 py-1 font-black ${presenceClass(product.seller_presence)}`}>
                                    {product.seller_presence}
                                  </span>
                                  {product.seller_verified ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-black text-emerald-300">
                                      <FaCheck /> Verified
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleCompare(product)}
                                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition ${
                                  compared
                                    ? "border-cyan-400 bg-cyan-400 text-black"
                                    : "border-white/10 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                                }`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <FaBalanceScale /> {compared ? "Selected" : "Compare"}
                                </span>
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3">
                                <p className="flex items-center gap-1 font-black text-yellow-200">
                                  <FaStar /> {product.seller_rating > 0 ? product.seller_rating.toFixed(1) : "New"}
                                </p>
                                <p className="mt-1 text-yellow-100/60">{formatCount(product.seller_review_count)} reviews</p>
                              </div>
                              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                                <p className="font-black text-emerald-200">{formatCount(product.seller_completed_orders)}</p>
                                <p className="mt-1 text-emerald-100/60">completed</p>
                              </div>
                              <div className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-3">
                                <p className="flex items-center gap-1 font-black text-blue-200">
                                  <FaClock /> {formatDeliveryEta(product.delivery_eta)}
                                </p>
                                <p className="mt-1 text-blue-100/60">{product.seller_on_time_rate.toFixed(0)}% on time</p>
                              </div>
                              <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-3">
                                <p className="font-black text-violet-200">{serviceLevelLabel(product.seller_service_level)}</p>
                                <p className="mt-1 text-violet-100/60">service level</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                              {(product.regions.length ? product.regions : ["Global"]).slice(0, 2).map((item) => (
                                <span key={`region-${product.id}-${item}`} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                                  <FaGlobe className="text-cyan-300" /> {item}
                                </span>
                              ))}
                              {(product.platforms.length ? product.platforms : ["Any platform"]).slice(0, 2).map((item) => (
                                <span key={`platform-${product.id}-${item}`} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                                  <FaLaptop className="text-violet-300" /> {item}
                                </span>
                              ))}
                              {product.servers.slice(0, 1).map((item) => (
                                <span key={`server-${product.id}-${item}`} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                                  <FaSignal className="text-emerald-300" /> {item}
                                </span>
                              ))}
                            </div>

                            {product.ranking_reasons.length > 0 ? (
                              <p className="mt-4 text-xs text-slate-400">
                                {product.ranking_reasons.join(" · ")}
                              </p>
                            ) : null}

                            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
                              <div>
                                <p className="text-xs text-slate-500">
                                  {product.has_variants && product.variant_count
                                    ? `From · ${product.variant_count} SKUs`
                                    : "Offer price"}
                                </p>
                                <p className="mt-1 text-2xl font-black text-cyan-300">
                                  {formatPrice(product.effective_price)}
                                </p>
                                {product.effective_max_price > product.effective_price ? (
                                  <p className="text-xs text-slate-500">up to {formatPrice(product.effective_max_price)}</p>
                                ) : null}
                              </div>
                              <div className="text-right text-xs text-slate-400">
                                <p className="flex items-center justify-end gap-1">
                                  <FaBoxOpen className="text-emerald-300" /> Stock {formatCount(product.effective_stock)}
                                </p>
                                <Link
                                  href={product.href}
                                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-black hover:bg-cyan-300"
                                >
                                  <FaShoppingCart /> View Offer
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {response.pagination.totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={response.pagination.page <= 1}
                  onClick={() => updateFilter("page", response.pagination.page - 1)}
                  className="rounded-xl border border-white/10 p-3 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FaChevronLeft />
                </button>
                <span className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black">
                  Page {response.pagination.page} of {response.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={response.pagination.page >= response.pagination.totalPages}
                  onClick={() => updateFilter("page", response.pagination.page + 1)}
                  className="rounded-xl border border-white/10 p-3 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FaChevronRight />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-cyan-200">Want to sell {gameName}?</h2>
              <p className="mt-2 text-sm text-slate-300">
                Add region, platform, server, delivery SLA, and SKU variants so buyers can find your offer faster.
              </p>
            </div>
            <Link
              href={sellerCreateUrl(game.slug, filters.category)}
              className="rounded-xl bg-cyan-400 px-6 py-3 text-center font-black text-black hover:bg-cyan-300"
            >
              Create Offer
            </Link>
          </div>
        </div>
      </section>

      {compareOffers.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-[9000] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-cyan-400/40 bg-[#07101f]/95 p-4 shadow-2xl shadow-black backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-black">
                <FaBalanceScale />
              </span>
              <div>
                <p className="font-black">{compareOffers.length} offer{compareOffers.length === 1 ? "" : "s"} selected</p>
                <p className="text-xs text-slate-400">Select 2–4 offers for a side-by-side comparison.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCompareOffers([])}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={compareOffers.length < 2}
                onClick={() => setCompareOpen(true)}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Compare Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {compareOpen ? (
        <ComparisonModal
          offers={compareOffers}
          formatPrice={formatPrice}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            setCompareOffers((current) => current.filter((item) => item.id !== id));
            if (compareOffers.length <= 2) setCompareOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
