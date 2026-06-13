import "dotenv/config";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

const LIMIT = Number(process.env.GAME_SEED_LIMIT || 100);
const MODE = process.env.GAME_SEED_MODE || "SEED";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RAWG_API_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RAWG_API_KEY"
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstLetter(name: string) {
  const first = name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function normalizeName(name: string) {
  return name.toLowerCase().trim();
}

function mapSimpleArray(items: any[] | undefined) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: item.id ?? null,
    name: item.name ?? "",
    slug: item.slug ?? slugify(item.name ?? ""),
  }));
}

function mapPlatforms(items: any[] | undefined) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: item.platform?.id ?? null,
    name: item.platform?.name ?? "",
    slug: item.platform?.slug ?? slugify(item.platform?.name ?? ""),
  }));
}

function mapStores(items: any[] | undefined) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: item.store?.id ?? null,
    name: item.store?.name ?? "",
    slug: item.store?.slug ?? slugify(item.store?.name ?? ""),
  }));
}

async function rawgFetch(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`https://api.rawg.io/api${path}`);
  url.searchParams.set("key", RAWG_API_KEY!);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RAWG API failed ${res.status}: ${text}`);
  }

  return res.json();
}

async function findRawgGameByName(name: string) {
  const json = await rawgFetch("/games", {
    search: name,
    page_size: 1,
  });

  return json.results?.[0] || null;
}

async function getRawgDetail(rawgId: number) {
  return rawgFetch(`/games/${rawgId}`);
}

function buildGamePayload(detail: any, oldOfferCount = 0) {
  const name = detail.name || "Unknown Game";
  const slug = slugify(name);

  return {
    name,
    slug,
    first_letter: firstLetter(name),
    status: "active",
    source: "rawg",
    source_url: detail.website || `https://rawg.io/games/${detail.slug}`,
    normalized_name: normalizeName(name),

    image_url: detail.background_image || null,
    cover_image_url: detail.background_image || null,
    background_image: detail.background_image_additional || detail.background_image || null,

    rating: Number(detail.rating || 0),
    rating_top: Number(detail.rating_top || 0),
    metacritic: detail.metacritic || null,
    released: detail.released || null,

    genres: mapSimpleArray(detail.genres),
    platforms: mapPlatforms(detail.platforms),
    stores: mapStores(detail.stores),

    is_active: true,
    is_trending: true,
    is_featured: false,
    offer_count: oldOfferCount,
    updated_at: new Date().toISOString(),
  };
}

async function seedMode() {
  console.log(`RAWG SEED mode started. Limit: ${LIMIT}`);

  let inserted = 0;
  let page = 1;

  while (inserted < LIMIT) {
    const pageSize = Math.min(40, LIMIT - inserted);

    const json = await rawgFetch("/games", {
      ordering: "-added",
      page,
      page_size: pageSize,
    });

    const games = json.results || [];
    if (games.length === 0) break;

    for (const game of games) {
      const detail = await getRawgDetail(game.id);
      const payload = buildGamePayload(detail, game.added || 0);

      const { error } = await supabase
        .from("game_master")
        .upsert(payload, { onConflict: "slug" });

      if (error) {
        console.error(`Failed: ${payload.name}`, error.message);
      } else {
        inserted++;
        console.log(`Seeded ${inserted}/${LIMIT}: ${payload.name}`);
      }

      await sleep(250);
    }

    page++;
  }

  console.log("RAWG SEED completed.");
}

async function enrichMode() {
  console.log(`RAWG ENRICH mode started. Limit: ${LIMIT}`);

  const { data: games, error } = await supabase
    .from("game_master")
    .select("id,name,slug,offer_count,rating,genres,platforms,stores,image_url,cover_image_url,background_image")
    .order("offer_count", { ascending: false })
    .limit(LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  let enriched = 0;

  for (const game of games || []) {
    const needsEnrich =
      !game.image_url ||
      !game.cover_image_url ||
      !game.background_image ||
      !game.rating ||
      !Array.isArray(game.genres) ||
      game.genres.length === 0 ||
      !Array.isArray(game.platforms) ||
      game.platforms.length === 0;

    if (!needsEnrich) {
      console.log(`Skip: ${game.name}`);
      continue;
    }

    const found = await findRawgGameByName(game.name);

    if (!found?.id) {
      console.log(`RAWG not found: ${game.name}`);
      await sleep(250);
      continue;
    }

    const detail = await getRawgDetail(found.id);
    const payload = buildGamePayload(detail, game.offer_count || 0);

    const { error: updateError } = await supabase
      .from("game_master")
      .update(payload)
      .eq("id", game.id);

    if (updateError) {
      console.error(`Failed enrich: ${game.name}`, updateError.message);
    } else {
      enriched++;
      console.log(`Enriched ${enriched}: ${game.name} -> ${payload.name}`);
    }

    await sleep(300);
  }

  console.log(`RAWG ENRICH completed. Total enriched: ${enriched}`);
}

async function main() {
  if (MODE.toUpperCase() === "ENRICH") {
    await enrichMode();
    return;
  }

  await seedMode();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});