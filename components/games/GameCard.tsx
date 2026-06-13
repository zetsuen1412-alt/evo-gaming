import Link from "next/link";

type GameCardProps = {
  game: {
    id: number;
    name: string;
    slug: string;
    image_url?: string | null;
    cover_image_url?: string | null;
    background_image?: string | null;
    offer_count?: number | null;
    is_trending?: boolean | null;
    rating?: number | null;
  };
  href?: string;
};

function getGameImage(game: GameCardProps["game"]) {
  return (
    game.cover_image_url ||
    game.image_url ||
    game.background_image ||
    `https://placehold.co/800x450/020617/22d3ee?text=${encodeURIComponent(game.name)}`
  );
}

export default function GameCard({ game, href }: GameCardProps) {
  return (
    <Link
      href={href || `/games/${game.slug}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-xl shadow-black/30 transition hover:-translate-y-1 hover:border-cyan-400/70"
    >
      <div
        className="h-36 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(120deg, rgba(2,6,23,.15), rgba(2,6,23,.9)), url(${getGameImage(game)})`,
        }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-black text-white group-hover:text-cyan-300">
            {game.name}
          </h3>

          {game.is_trending ? (
            <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">
              HOT
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="rounded-lg bg-cyan-400/10 px-3 py-1 font-bold text-cyan-200">
            {game.offer_count || 0} offers
          </span>

          {game.rating ? (
            <span className="text-slate-400">
              ★ {Number(game.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}