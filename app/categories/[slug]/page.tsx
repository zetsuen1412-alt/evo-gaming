import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    q?: string;
    letter?: string;
  }>;
};

export default async function CategoryShortcutPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const nextParams = new URLSearchParams({
    category: slug,
  });

  if (resolvedSearchParams?.q) nextParams.set("q", resolvedSearchParams.q);
  if (resolvedSearchParams?.letter) nextParams.set("letter", resolvedSearchParams.letter);

  redirect(`/games?${nextParams.toString()}`);
}
