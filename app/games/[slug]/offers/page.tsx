import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GameOffersClient from "./GameOffersClient";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GameOffersPage({ params }: PageProps) {
  const { slug } = await params;

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

  return <GameOffersClient game={game} />;
}