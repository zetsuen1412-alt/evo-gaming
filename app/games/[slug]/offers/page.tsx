import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GameOffersClient from "./GameOffersClient";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ category?: string }>;
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
function titleCaseFromSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCategorySlug(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const rawCategory = query.category?.trim() || "";
  const category = rawCategory ? titleCaseFromSlug(rawCategory) : "Offers";

  const { data: game } = await supabase
    .from("game_master")
    .select("name,slug,background_image,cover_image_url,image_url")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    return {
      title: "Offers Not Found | ComePlayers",
      robots: { index: false, follow: false },
    };
  }

  const title = rawCategory
    ? `${game.name} ${category} Offers | ComePlayers`
    : `${game.name} Offers | ComePlayers`;
  const description = rawCategory
    ? `Browse ${game.name} ${category} marketplace offers on ComePlayers.`
    : `Browse active ${game.name} accounts, coins, items, boosting, top up, and gift card offers on ComePlayers.`;
  const canonical = `/games/${game.slug}/offers${
    rawCategory ? `?category=${encodeURIComponent(rawCategory)}` : ""
  }`;
  const image = getGameImage(game);

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
      images: [{ url: image, alt: `${game.name} offers` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function GameOffersPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const rawCategory = query.category?.trim() || "";
  const categoryName = rawCategory ? titleCaseFromSlug(rawCategory) : "All Offers";
  const categorySlug = normalizeCategorySlug(rawCategory);

  const { data: game } = await supabase
    .from("game_master")
    .select(`
      id,
      name,
      slug,
      background_image,
      cover_image_url,
      image_url,
      offer_count,
      rating,
      platforms,
      stores
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (!game) notFound();

  const offersPath = `/games/${game.slug}/offers${
    categorySlug ? `?category=${categorySlug}` : ""
  }`;
  const offersStructuredData = [
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
          name: game.name,
          item: absoluteUrl(`/games/${game.slug}`),
        },
        {
          "@type": "ListItem",
          position: 4,
          name: categorySlug ? categoryName : "Offers",
          item: absoluteUrl(offersPath),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: categorySlug
        ? `${game.name} ${categoryName} Offers`
        : `${game.name} Offers`,
      description: categorySlug
        ? `Browse ${game.name} ${categoryName} marketplace offers on ComePlayers.`
        : `Browse active ${game.name} marketplace offers on ComePlayers.`,
      url: absoluteUrl(offersPath),
      image: absoluteUrl(getGameImage(game)),
      isPartOf: {
        "@type": "WebSite",
        name: "ComePlayers",
        url: SITE_URL,
      },
      about: {
        "@type": "VideoGame",
        name: game.name,
        image: absoluteUrl(getGameImage(game)),
      },
    },
  ];

  return (
    <>
      <JsonLd data={offersStructuredData} />
      <Suspense fallback={null}>
        <GameOffersClient game={game} />
      </Suspense>
    </>
  );
}
