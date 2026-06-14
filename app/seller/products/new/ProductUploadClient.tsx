"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  seller_status: string | null;
  seller_name: string | null;
};

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type GameMaster = {
  id: number;
  name: string;
  slug: string;
  first_letter: string | null;
  status: string | null;
  image_url: string | null;
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function ProductUploadClient() {
  const searchParams = useSearchParams();
  const requestedGameSlug = searchParams.get("game") || "";
  const requestedCategoryValue = searchParams.get("category") || "";
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<GameMaster[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");

  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId
  );

  const selectedGame = games.find((game) => String(game.id) === selectedGameId);

  const productSlug = useMemo(() => {
    const baseSlug = createSlug(title);
    const gameSlug = selectedGame?.slug || "game";

    if (!baseSlug) return "";

    return `${gameSlug}-${baseSlug}`;
  }, [title, selectedGame]);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        alert(sessionError.message);
        window.location.href = "/";
        return;
      }

      if (!sessionData.session?.user) {
        window.location.href = "/";
        return;
      }

      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        window.location.href = "/";
        return;
      }

      if (!profileData) {
        alert("Profile not found. Please login again.");
        window.location.href = "/";
        return;
      }

      if (profileData.seller_status !== "approved") {
        alert("Seller approval is required to create products.");
        window.location.href = "/seller/apply";
        return;
      }

      setProfile(profileData);

      const [categoryResult, gameResult] = await Promise.all([
        supabase.from("categories").select("*").order("id", { ascending: true }),
        supabase
          .from("game_master")
          .select("id,name,slug,first_letter,status,image_url")
          .eq("status", "active")
          .order("name", { ascending: true }),
      ]);

      if (categoryResult.error) {
        alert(categoryResult.error.message);
        setLoading(false);
        return;
      }

      if (gameResult.error) {
        alert(gameResult.error.message);
        setLoading(false);
        return;
      }

      const activeCategories = categoryResult.data || [];
      const activeGames = gameResult.data || [];

      setCategories(activeCategories);
      setGames(activeGames);

      if (activeCategories.length > 0) {
        const normalizedRequest = requestedCategoryValue.toLowerCase();
        const requestedCategory = activeCategories.find((category) => {
          return (
            category.slug.toLowerCase() === normalizedRequest ||
            category.name.toLowerCase() === normalizedRequest
          );
        });

        setSelectedCategoryId(String((requestedCategory || activeCategories[0]).id));
      }

      if (activeGames.length > 0) {
        const requestedGame = activeGames.find(
          (game) => game.slug.toLowerCase() === requestedGameSlug.toLowerCase()
        );

        setSelectedGameId(String((requestedGame || activeGames[0]).id));
      }

      setLoading(false);
    } catch (error) {
      console.error("Product upload page error:", error);
      alert("Failed to load product upload page.");
      setLoading(false);
    }
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !profile) {
      alert("Seller profile not found.");
      return;
    }

    if (!title.trim()) {
      alert("Product title is required.");
      return;
    }

    if (!price.trim()) {
      alert("Product price is required.");
      return;
    }

    if (!description.trim()) {
      alert("Product description is required.");
      return;
    }

    if (!selectedCategory) {
      alert("Please select a category.");
      return;
    }

    if (!selectedGame) {
      alert("Please select a game.");
      return;
    }

    const parsedStock = Number(stock);

    if (!Number.isFinite(parsedStock) || parsedStock < 1) {
      alert("Stock must be at least 1.");
      return;
    }

    const parsedPrice = Number(price);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      alert("Price must be greater than 0.");
      return;
    }

    setSubmitting(true);

    const sellerDisplayName =
      profile.seller_name || profile.username || user.email || "Seller";

    const { error } = await supabase.from("products").insert({
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      stock: parsedStock,

      category: selectedCategory.name,
      category_id: selectedCategory.id,

      game_name: selectedGame.name,
      game_category_id: selectedGame.id,

      seller: sellerDisplayName,
      seller_id: profile.id,
      seller_name: sellerDisplayName,

      image_url: imageUrl.trim() || selectedGame.image_url || null,
      slug: productSlug || createSlug(title),

      status: "active",
    });

    if (error) {
      alert(`Database Error: ${error.message}`);
      setSubmitting(false);
      return;
    }

    alert("Product created successfully.");
    window.location.href = `/games/${selectedGame.slug}/offers?category=${encodeURIComponent(selectedCategory.name)}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading product creator...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Product Upload V3
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Create Product Listing
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Select a marketplace category and any active game from the unified ComePlayers Game Master catalog.
            </p>
          </div>

          <Link
            href="/seller/products"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Back to Products
          </Link>
        </div>
      </section>

      <section className="grid gap-8 px-8 py-10 lg:grid-cols-[1fr_420px]">
        <form
          onSubmit={submitProduct}
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30"
        >
          <h2 className="text-3xl font-black">Product Information</h2>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Category
              </label>

              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Game
              </label>

              <select
                value={selectedGameId}
                onChange={(event) => setSelectedGameId(event.target.value)}
                disabled={games.length === 0}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400 disabled:opacity-60"
              >
                {games.length === 0 ? (
                  <option value="">No active games found</option>
                ) : (
                  games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Product Title
              </label>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: 1000 Gold / Premium Account / Top Up"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Price
              </label>

              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Example: 50000"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Stock
              </label>

              <input
                type="number"
                min="1"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Product Image URL
              </label>

              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/product-image.jpg"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe product details, delivery process, requirements, and important notes."
              rows={8}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />
          </div>

          <div className="mt-7 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
            <h3 className="font-black text-yellow-300">Listing Notice</h3>

            <p className="mt-3 text-sm text-gray-300">
              This product will be listed under{" "}
              <span className="font-black text-cyan-300">
                {selectedCategory?.name || "Category"}
              </span>{" "}
              and{" "}
              <span className="font-black text-cyan-300">
                {selectedGame?.name || "Game"}
              </span>
              .
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || games.length === 0}
            className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating Product..." : "Create Product"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Preview</h2>

          <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <div className="flex h-56 items-center justify-center bg-black">
              {imageUrl || selectedGame?.image_url ? (
                <img
                  src={imageUrl || selectedGame?.image_url || ""}
                  alt={title || "Product preview"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="text-6xl">🎮</p>
              )}
            </div>

            <div className="p-5">
              <p className="text-xs font-bold text-cyan-300">
                {selectedCategory?.name || "Category"} /{" "}
                {selectedGame?.name || "Game"}
              </p>

              <h3 className="mt-2 text-2xl font-black">
                {title || "Product Title"}
              </h3>

              <p className="mt-2 text-sm text-gray-400">
                Seller:{" "}
                {profile?.seller_name ||
                  profile?.username ||
                  user?.email ||
                  "Seller"}
              </p>

              <p className="mt-5 text-3xl font-black text-cyan-300">
                Rp {Number(price || 0).toLocaleString("id-ID")}
              </p>

              <p className="mt-2 text-sm text-gray-400">
                Stock: {stock || "1"}
              </p>

              <p className="mt-4 line-clamp-4 text-sm text-gray-300">
                {description ||
                  "Product description will appear here as a preview."}
              </p>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
            <h3 className="font-black text-cyan-300">Product URL Slug</h3>

            <p className="mt-2 break-words text-sm text-gray-300">
              {productSlug || "product-slug-preview"}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
            <h3 className="font-black">Listing Path</h3>

            <p className="mt-2 break-words text-sm text-gray-400">
              /games/{selectedGame?.slug || "game"}/offers?category={encodeURIComponent(
                selectedCategory?.name || "category",
              )}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}