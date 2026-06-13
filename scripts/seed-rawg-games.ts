import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released?: string | null;
  background_image?: string | null;
  rating?: number | null;
  rating_top?: number | null;
  metacritic?: number | null;
  playtime?: number | null;
  genres?: Array<{ id: number; name: string; slug: string }>;
  platforms?: Array<{ platform?: { id: number; name: string; slug: string } }>;
  stores?: Array<{ store?: { id: number; name: string; slug: string } }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
};

type RawgResponse = { count: number; next: string | null; previous: string | null; results: RawgGame[] };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
if (!RAWG_API_KEY) throw new Error("Missing RAWG_API_KEY. Add RAWG_API_KEY=xxxxx to .env.local");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function normalizeName(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function firstLetter(value: string) {
  const first = value.trim().charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(first) ? first : "#";
}

function cleanArray<T>(value: T[] | undefined | null, limit = 8) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function mapGame(game: RawgGame, rank: number) {
  const name = game.name.trim();
  const slug = game.slug || slugify(name);
  const rating = Number(game.rating || 0);
  const metacritic = game.metacritic || 0;
  const playtime = game.playtime || 0;
  const trendingScore = rating * 100 + metacritic + playtime * 5 + Math.max(0, 5000 - rank);
  const isTrending = rank <= Number(process.env.RAWG_TRENDING_LIMIT || 60);

  return {
    name,
    slug,
    first_letter: firstLetter(name),
    status: "active",
    image_url: game.background_image || null,
    icon_url: game.background_image || null,
    logo_url: game.background_image || null,
    normalized_name: normalizeName(name),
    rawg_id: game.id,
    rawg_slug: game.slug,
    cover_image_url: game.background_image || null,
    banner_image_url: game.background_image || null,
    background_image: game.background_image || null,
    released: game.released || null,
    rating,
    rating_top: game.rating_top || 0,
    metacritic: game.metacritic || null,
    playtime,
    genres: cleanArray(game.genres, 12),
    platforms: cleanArray(game.platforms?.map((item) => item.platform).filter(Boolean), 16),
    stores: cleanArray(game.stores?.map((item) => item.store).filter(Boolean), 12),
    tags: cleanArray(game.tags, 12),
    source: "rawg",
    source_url: `https://rawg.io/games/${game.slug}`,
    offer_count: isTrending ? Math.floor(trendingScore / 10) : 0,
    search_count: 0,
    is_trending: isTrending,
    is_featured: rank <= 24,
    is_active: true,
    metadata: { rawg_id: game.id, rawg_slug: game.slug, imported_from: "rawg", trending_score: trendingScore },
    updated_at: new Date().toISOString(),
  };
}

async function fetchRawgPage(page: number, pageSize: number) {
  const params = new URLSearchParams({ key: RAWG_API_KEY!, page: String(page), page_size: String(pageSize), ordering: "-added" });
  const response = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
  if (!response.ok) throw new Error(`RAWG API failed ${response.status}: ${(await response.text()).slice(0, 250)}`);
  return (await response.json()) as RawgResponse;
}

async function main() {
  const limit = Number(process.env.GAME_SEED_LIMIT || 5000);
  const pageSize = Math.min(Number(process.env.RAWG_PAGE_SIZE || 40), 40);
  const delayMs = Number(process.env.RAWG_DELAY_MS || 1200);
  const maxPages = Math.ceil(limit / pageSize);

  console.log(`Starting RAWG import. limit=${limit}, pageSize=${pageSize}, pages=${maxPages}`);

  let imported = 0;
  let rank = 1;

  for (let page = 1; page <= maxPages; page++) {
    const payload = await fetchRawgPage(page, pageSize);
    const rows = (payload.results || [])
      .filter((game) => game.name && game.slug)
      .map((game) => mapGame(game, rank++));

    if (rows.length === 0) break;

    const { error } = await supabase.from("game_master").upsert(rows, { onConflict: "slug" });
    if (error) throw error;

    imported += rows.length;
    console.log(`Imported ${imported}/${limit} games. RAWG page ${page}/${maxPages}`);

    if (imported >= limit) break;
    await sleep(delayMs);
  }

  console.log("RAWG import complete.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
