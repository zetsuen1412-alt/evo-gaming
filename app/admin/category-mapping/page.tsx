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

type MappingRow = {
  id: number;
  category_id: number;
  game_master_id: number;
  status: string | null;
  sort_order: number | null;
  created_at: string;
  game_master: GameMaster | null;
};

const mappingStatusOptions = ["active", "inactive"];

export default function AdminCategoryMappingV1Page() {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<GameMaster[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [search, setSearch] = useState("");

  const [updatingMappingId, setUpdatingMappingId] = useState<number | null>(
    null
  );
  const [adding, setAdding] = useState(false);

  const isAdmin = adminProfile?.role?.trim().toLowerCase() === "admin";

  const selectedCategory = categories.find(
    (category) => String(category.id) === selectedCategoryId
  );

  const mappedGameIds = useMemo(() => {
    return new Set(mappings.map((mapping) => mapping.game_master_id));
  }, [mappings]);

  const availableGames = useMemo(() => {
    return games
      .filter((game) => game.status === "active")
      .filter((game) => !mappedGameIds.has(game.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [games, mappedGameIds]);

  const filteredMappings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mappings.filter((mapping) => {
      const game = mapping.game_master;

      return (
        !query ||
        String(mapping.id).includes(query) ||
        (game?.name || "").toLowerCase().includes(query) ||
        (game?.slug || "").toLowerCase().includes(query)
      );
    });
  }, [mappings, search]);

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCategories(data || []);

    if ((data || []).length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(String(data?.[0].id));
    }
  }

  async function loadGames() {
    const { data, error } = await supabase
      .from("game_master")
      .select("id,name,slug,first_letter,status,image_url")
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setGames(data || []);
  }

  async function loadMappings(categoryId: string) {
    if (!categoryId) {
      setMappings([]);
      return;
    }

    const { data, error } = await supabase
      .from("category_game_master")
      .select(
        `
        id,
        category_id,
        game_master_id,
        status,
        sort_order,
        created_at,
        game_master:game_master_id (
          id,
          name,
          slug,
          first_letter,
          status,
          image_url
        )
      `
      )
      .eq("category_id", Number(categoryId))
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setMappings((data || []) as unknown as MappingRow[]);
  }

  useEffect(() => {
    async function initializePage() {
      setLoading(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        alert(userError.message);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,username,role")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        setLoading(false);
        return;
      }

      setAdminProfile(profileData || null);

      if (profileData?.role?.trim().toLowerCase() === "admin") {
        await loadCategories();
        await loadGames();
      }

      setLoading(false);
    }

    initializePage();
  }, []);

  useEffect(() => {
    if (isAdmin && selectedCategoryId) {
      loadMappings(selectedCategoryId);
    }
  }, [isAdmin, selectedCategoryId]);

  useEffect(() => {
    if (availableGames.length > 0) {
      setSelectedGameId(String(availableGames[0].id));
    } else {
      setSelectedGameId("");
    }
  }, [availableGames]);

  async function addMapping(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedCategoryId || !selectedGameId) {
      alert("Please select category and game.");
      return;
    }

    setAdding(true);

    const nextSortOrder =
      mappings.length > 0
        ? Math.max(...mappings.map((mapping) => Number(mapping.sort_order || 0))) +
          10
        : 10;

    const { error } = await supabase.from("category_game_master").insert({
      category_id: Number(selectedCategoryId),
      game_master_id: Number(selectedGameId),
      status: "active",
      sort_order: nextSortOrder,
    });

    if (error) {
      alert(error.message);
      setAdding(false);
      return;
    }

    await loadMappings(selectedCategoryId);
    setAdding(false);
  }

  async function updateMapping(
    mappingId: number,
    payload: Partial<Pick<MappingRow, "status" | "sort_order">>
  ) {
    setUpdatingMappingId(mappingId);

    const { error } = await supabase
      .from("category_game_master")
      .update(payload)
      .eq("id", mappingId);

    if (error) {
      alert(error.message);
      setUpdatingMappingId(null);
      return;
    }

    await loadMappings(selectedCategoryId);
    setUpdatingMappingId(null);
  }

  async function removeMapping(mapping: MappingRow) {
    if (
      !confirm(
        `Remove ${mapping.game_master?.name || "this game"} from ${
          selectedCategory?.name || "category"
        }?`
      )
    ) {
      return;
    }

    setUpdatingMappingId(mapping.id);

    const { error } = await supabase
      .from("category_game_master")
      .delete()
      .eq("id", mapping.id);

    if (error) {
      alert(error.message);
      setUpdatingMappingId(null);
      return;
    }

    await loadMappings(selectedCategoryId);
    setUpdatingMappingId(null);
  }

  async function moveMapping(mapping: MappingRow, direction: "up" | "down") {
    const currentSort = Number(mapping.sort_order || 0);
    const nextSort =
      direction === "up" ? Math.max(currentSort - 10, 0) : currentSort + 10;

    await updateMapping(mapping.id, { sort_order: nextSort });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading category mapping...
        </p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-red-300">Access Denied</h1>

          <p className="mt-4 text-gray-300">
            Only admin accounts can access category mapping.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Back to Home
          </Link>
        </div>
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
              Admin Category Mapping
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Category Mapping
            </h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Control which games appear inside each marketplace category.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/games"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-6 font-bold text-gray-300 transition hover:bg-white hover:text-black"
            >
              Game Master
            </Link>

            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Selected Category</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">
              {selectedCategory?.name || "-"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Mapped Games</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {mappings.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Available Games</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {availableGames.length}
            </p>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30">
          <h2 className="text-2xl font-black">Select Category</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
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

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search mapped games..."
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />
          </div>
        </div>

        <form
          onSubmit={addMapping}
          className="mb-8 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-2xl shadow-black/30"
        >
          <h2 className="text-2xl font-black text-cyan-300">
            Add Game to Category
          </h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_180px]">
            <select
              value={selectedGameId}
              onChange={(event) => setSelectedGameId(event.target.value)}
              disabled={availableGames.length === 0}
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none focus:border-cyan-400 disabled:opacity-60"
            >
              {availableGames.length === 0 ? (
                <option value="">No available games</option>
              ) : (
                availableGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))
              )}
            </select>

            <button
              type="submit"
              disabled={adding || !selectedGameId}
              className="rounded-2xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add Game"}
            </button>
          </div>
        </form>

        {filteredMappings.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
            <h2 className="text-3xl font-black">No mapped games found.</h2>

            <p className="mt-3 text-gray-400">
              Add games to this category using the form above.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredMappings.map((mapping) => {
              const game = mapping.game_master;

              return (
                <div
                  key={mapping.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30"
                >
                  <div className="grid gap-6 xl:grid-cols-[140px_1fr_280px]">
                    <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-black">
                      {game?.image_url ? (
                        <img
                          src={game.image_url}
                          alt={game.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">🎮</span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black">
                          {game?.name || "Unknown Game"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            mapping.status === "active"
                              ? "border-green-400/20 bg-green-400/10 text-green-300"
                              : "border-red-400/20 bg-red-400/10 text-red-300"
                          }`}
                        >
                          {mapping.status || "inactive"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-400">
                        slug: {game?.slug || "-"}
                      </p>

                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Mapping ID</p>
                          <p className="mt-1 font-bold">#{mapping.id}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Game ID</p>
                          <p className="mt-1 font-bold">
                            #{mapping.game_master_id}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Sort Order</p>
                          <p className="mt-1 font-bold">
                            {mapping.sort_order || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-bold text-gray-400">
                        Status
                      </label>

                      <select
                        value={mapping.status || "active"}
                        onChange={(event) =>
                          updateMapping(mapping.id, {
                            status: event.target.value,
                          })
                        }
                        disabled={updatingMappingId === mapping.id}
                        className="rounded-2xl border border-white/10 bg-black px-4 py-3 font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                      >
                        {mappingStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => moveMapping(mapping, "up")}
                          disabled={updatingMappingId === mapping.id}
                          className="rounded-2xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black disabled:opacity-60"
                          type="button"
                        >
                          Up
                        </button>

                        <button
                          onClick={() => moveMapping(mapping, "down")}
                          disabled={updatingMappingId === mapping.id}
                          className="rounded-2xl border border-white/10 px-5 py-3 font-black text-gray-300 hover:bg-white hover:text-black disabled:opacity-60"
                          type="button"
                        >
                          Down
                        </button>
                      </div>

                      {selectedCategory && game && (
                        <Link
                          href={`/categories/${selectedCategory.slug}/${game.slug}-${selectedCategory.slug}`}
                          className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                        >
                          Open Page
                        </Link>
                      )}

                      <button
                        onClick={() => removeMapping(mapping)}
                        disabled={updatingMappingId === mapping.id}
                        className="rounded-2xl border border-red-400/40 px-5 py-3 font-black text-red-300 hover:bg-red-500 hover:text-white disabled:opacity-60"
                        type="button"
                      >
                        Remove Mapping
                      </button>

                      {updatingMappingId === mapping.id && (
                        <p className="text-center text-sm text-gray-400">
                          Updating mapping...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}