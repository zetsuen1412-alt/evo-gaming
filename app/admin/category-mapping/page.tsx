"use client";

import Link from "next/link";

const categoryShortcuts = [
  { name: "Game Accounts", slug: "game-accounts", icon: "👤" },
  { name: "Game Coins", slug: "game-coins", icon: "🪙" },
  { name: "Game Items", slug: "game-items", icon: "⚔️" },
  { name: "Boosting", slug: "boosting", icon: "🚀" },
  { name: "Top Up", slug: "top-up", icon: "💳" },
  { name: "Gift Cards", slug: "gift-cards", icon: "🎁" },
];

export default function AdminCategoryMappingUnifiedPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Unified Marketplace Catalog
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Category Mapping Retired
            </h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              ComePlayers now uses one unified Game Master catalog. Category
              pages are filters on top of all active games, so admins no longer
              need to manually map games into each category.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/games"
              className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black transition hover:bg-cyan-300"
            >
              Manage Game Master
            </Link>

            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black text-cyan-300">
              New catalog rule
            </h2>

            <div className="mt-6 space-y-4 text-gray-300">
              <p>
                Public category URLs now redirect into the unified games page:
              </p>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm text-gray-200">
                /categories/game-coins → /games?category=game-coins
              </div>

              <p>
                When a buyer selects a game from a filtered category, the buyer
                goes directly to that game&apos;s filtered offers page:
              </p>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm text-gray-200">
                /games/mobile-legends/offers?category=Game%20Coins
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">Admin action</h2>

            <p className="mt-4 text-gray-300">
              To control what appears in the marketplace, manage active games in
              Game Master and manage listings through seller/admin products.
            </p>

            <div className="mt-6 grid gap-3">
              <Link
                href="/admin/games"
                className="rounded-2xl border border-cyan-400/40 px-5 py-4 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
              >
                Open Game Master
              </Link>

              <Link
                href="/admin/products"
                className="rounded-2xl border border-purple-400/40 px-5 py-4 text-center font-black text-purple-300 transition hover:bg-purple-400 hover:text-black"
              >
                Open Product Management
              </Link>

              <Link
                href="/games"
                className="rounded-2xl border border-white/10 px-5 py-4 text-center font-black text-gray-300 transition hover:bg-white hover:text-black"
              >
                Preview Public Games Catalog
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Category shortcuts</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryShortcuts.map((category) => (
              <Link
                key={category.slug}
                href={`/games?category=${category.slug}`}
                className="group rounded-3xl border border-white/10 bg-black/30 p-6 transition hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-400/10"
              >
                <div className="text-4xl">{category.icon}</div>
                <h3 className="mt-4 text-xl font-black group-hover:text-cyan-300">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Preview unified catalog filter
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
