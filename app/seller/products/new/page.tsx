"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type GameCategory = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  image_url: string | null;
  status: string | null;
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function ProductUploadV2Page() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [gameCategories, setGameCategories] = useState<GameCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGameCategoryId, setSelectedGameCategoryId] = useState("");

  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId
  );

  const selectedGameCategory = gameCategories.find(
    (game) => String(game.id) === selectedGameCategoryId
  );

  const productSlug = useMemo(() => {
    const baseSlug = createSlug(title);
    const gameSlug = selectedGameCategory?.slug || "game";

    if (!baseSlug) {
      return "";
    }

    return `${gameSlug}-${baseSlug}`;
  }, [title, selectedGameCategory]);

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      loadGameCategories(Number(selectedCategoryId));
    }
  }, [selectedCategoryId]);

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
        .eq("email", currentUser.email)
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

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      if (categoryError) {
        alert(categoryError.message);
        setLoading(false);
        return;
      }

      const activeCategories = categoryData || [];
      setCategories(activeCategories);

      if (activeCategories.length > 0) {
        setSelectedCategoryId(String(activeCategories[0].id));
      }

      setLoading(false);
    } catch (error) {
      console.error("Product upload page error:", error);
      alert("Failed to load product upload page.");
      setLoading(false);
    }
  }

  async function loadGameCategories(categoryId: number) {
    const { data, error } = await supabase
      .from("game_categories")
      .select("*")
      .eq("category_id", categoryId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const activeGames = data || [];
    setGameCategories(activeGames);

    if (activeGames.length > 0) {
      setSelectedGameCategoryId(String(activeGames[0].id));
    } else {
      setSelectedGameCategoryId("");
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

    if (!selectedGameCategory) {
      alert("Please select a game.");
      return;
    }

    const parsedStock = Number(stock);

    if (!Number.isFinite(parsedStock) || parsedStock < 1) {
      alert("Stock must be at least 1.");
      return;
    }

    setSubmitting(true);

    const sellerDisplayName =
      profile.seller_name || profile.username || user.email || "Seller";

    const { error } = await supabase.from("products").insert({
      title: title.trim(),
      description: description.trim(),
      price: price.trim(),
      stock: parsedStock,

      category: selectedCategory.name,
      category_id: selectedCategory.id,

      game_name: selectedGameCategory.name,
      game_category_id: selectedGameCategory.id,

      seller: sellerDisplayName,
      seller_id: profile.id,
      seller_name: sellerDisplayName,

      image_url: imageUrl.trim() || null,
      slug: productSlug || createSlug(title),

      status: "active",
    });

    if (error) {
      alert(`Database Error: ${error.message}`);
      setSubmitting(false);
      return;
    }

    alert("Product created successfully.");
    window.location.href = "/seller/products";
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
      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <div className="hidden border-l border-white/10 pl-5 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Seller Center
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              Product Upload V2
            </p>
          </div>
        </div>

        <Link
          href="/seller"
          className="rounded-full border border-cyan-400 px-5 py-2 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
        >
          Back to Dashboard
        </Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 px-8 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_34%)]" />

        <div className="relative z-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
            Category → Game → Product
          </p>

          <h1 className="text-5xl font-black md:text-7xl">
            Create Product Listing
          </h1>

          <p className="mt-5 max-w-2xl text-gray-300">
            Add a product to the correct marketplace category and game page.
          </p>
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
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
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
                value={selectedGameCategoryId}
                onChange={(event) =>
                  setSelectedGameCategoryId(event.target.value)
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
              >
                {gameCategories.length === 0 ? (
                  <option value="">No games available</option>
                ) : (
                  gameCategories.map((game) => (
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
                placeholder="Example: AR60 Genshin Account"
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
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
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
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
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
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
                className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
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
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none focus:border-cyan-400"
            />
          </div>

          <div className="mt-7 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
            <h3 className="font-black text-yellow-300">Listing Notice</h3>

            <p className="mt-3 text-sm text-gray-300">
              Your product will appear under the selected category and game page.
              Make sure the title, price, and description are accurate.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-2xl bg-cyan-400 py-4 text-lg font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating Product..." : "Create Product"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-7 shadow-2xl shadow-black/30">
          <h2 className="text-3xl font-black">Preview</h2>

          <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <div className="flex h-56 items-center justify-center bg-black">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title || "Product preview"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="text-gray-500">No Image</p>
              )}
            </div>

            <div className="p-5">
              <p className="text-xs font-bold text-cyan-300">
                {selectedCategory?.name || "Category"} /{" "}
                {selectedGameCategory?.name || "Game"}
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
                Rp {price || "0"}
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
              /categories/{selectedCategory?.slug || "category"}/
              {selectedGameCategory?.slug || "game"}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}