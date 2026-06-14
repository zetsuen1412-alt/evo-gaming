import type { Metadata } from "next";
import Link from "next/link";
import MarketplaceIntelligence from "@/components/marketplace/MarketplaceIntelligence";
import FeaturedSellers from "@/components/sellers/FeaturedSellers";

export const metadata: Metadata = {
  title: "Discover Marketplace | ComePlayers",
  description:
    "Discover trending games, hot offers, fast-growing categories, featured collections, and top sellers on ComePlayers.",
  alternates: { canonical: "/discover" },
  openGraph: {
    title: "Discover Marketplace | ComePlayers",
    description:
      "Explore live marketplace trends, hot offers, fast-growing categories, and trusted sellers on ComePlayers.",
    url: "/discover",
    siteName: "ComePlayers",
    type: "website",
  },
};

const collections = [
  {
    title: "Mobile Legends Essentials",
    description: "Find diamonds, accounts, boosting, and fast delivery offers for Mobile Legends.",
    href: "/search?q=mobile%20legends",
    icon: "💎",
  },
  {
    title: "Valorant Top Picks",
    description: "Browse Valorant accounts, points, coaching, and ranked-ready services.",
    href: "/search?q=valorant",
    icon: "🎯",
  },
  {
    title: "Free Fire Deals",
    description: "Explore Free Fire top up, accounts, bundles, and marketplace offers.",
    href: "/search?q=free%20fire",
    icon: "🔥",
  },
  {
    title: "Game Accounts Hub",
    description: "Compare active account listings across popular games and trusted sellers.",
    href: "/games?category=game-accounts",
    icon: "👤",
  },
];

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(250,204,21,.16),transparent_32%),linear-gradient(180deg,#07111f,#050816)] px-8 py-14">
        <div className="mx-auto max-w-7xl">
          <p className="inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-5 py-3 text-sm font-black text-yellow-300">
            ✨ Marketplace Discovery V2
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">
            Discover what is hot across ComePlayers.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">
            Track live buyer signals, trending games, hot offers, fast-growing categories,
            and trusted sellers from one discovery hub.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/games"
              className="rounded-full bg-cyan-400 px-6 py-4 font-black text-black transition hover:bg-cyan-300"
            >
              Browse Games
            </Link>

            <Link
              href="/search"
              className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-4 font-black text-white transition hover:border-cyan-400"
            >
              Search Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-12">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-black text-purple-300">
              ⭐ Featured Collections
            </p>
            <h2 className="mt-4 text-4xl font-black">Start With Popular Collections</h2>
            <p className="mt-2 max-w-2xl text-slate-300">
              Curated entry points for high-intent buyers who want to discover offers faster.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {collections.map((collection) => (
            <Link
              key={collection.title}
              href={collection.href}
              className="group rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-950/20"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl">
                {collection.icon}
              </div>

              <h3 className="mt-6 text-2xl font-black group-hover:text-cyan-300">
                {collection.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {collection.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <MarketplaceIntelligence />

      <FeaturedSellers
        title="Top Sellers To Watch"
        subtitle="Trusted sellers ranked by reviews, completed orders, active listings, and buyer conversion."
        limit={8}
      />
    </main>
  );
}
