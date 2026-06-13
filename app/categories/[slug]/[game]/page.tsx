import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    slug: string;
    game: string;
  }>;
};

function removeCategorySuffix(gameParam: string, categorySlug: string) {
  const suffix = `-${categorySlug}`;
  if (gameParam.endsWith(suffix)) return gameParam.slice(0, -suffix.length);
  return gameParam;
}

export default async function CategoryGameShortcutPage({ params }: PageProps) {
  const { slug, game } = await params;
  const gameSlug = removeCategorySuffix(game, slug);

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();

  const categoryName = category?.name || slug;

  redirect(
    `/games/${encodeURIComponent(gameSlug)}/offers?category=${encodeURIComponent(
      categoryName
    )}`
  );
}
