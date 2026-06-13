import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fallbackGameCover } from "@/lib/gameMaster";

type GameDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { slug } = await params;

  const { data: game } = await supabase
    .from("game_master")
    .select("id,name,slug,cover_image_url,banner_image_url,offer_count,is_trending,source_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!game) notFound();

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="border-b border-white/10 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,8,22,.95), rgba(5,8,22,.7)), url(${game.banner_image_url || game.cover_image_url || fallbackGameCover(game.name)})` }}>
        <div className="mx-auto max-w-7xl px-4 py-20">
          <Link href="/games" className="text-cyan-300 hover:underline">← Back to games</Link>
          <h1 className="mt-6 text-5xl font-black">{game.name}</h1>
          <p className="mt-3 text-slate-300">{game.offer_count} offers available</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/products?game=${game.slug}`} className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-black">View Offers</Link>
            <Link href={`/seller/products/new?game=${game.slug}`} className="rounded-xl border border-cyan-400 px-6 py-3 font-black text-cyan-300">Create Offer</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Marketplace Categories</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["Game Accounts", "Game Coins", "Game Items", "Boosting"].map((item) => (
              <Link key={item} href={`/products?game=${game.slug}&type=${encodeURIComponent(item)}`} className="rounded-xl border border-white/10 bg-black/30 p-5 transition hover:border-cyan-400">
                <h3 className="font-black">{item}</h3>
                <p className="mt-2 text-sm text-slate-400">Browse {item.toLowerCase()} offers.</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
