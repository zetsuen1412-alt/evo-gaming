"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type AuthMode = "login" | "register";
type OAuthProvider = "google" | "discord" | "facebook";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error(error.message);
        return;
      }

      setCategories(data || []);
    }

    loadCategories();
  }, []);

  const filteredCategories = categories.filter((category) => {
    const matchSearch = category.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchCategory =
      selectedCategory === "all" || category.slug === selectedCategory;

    return matchSearch && matchCategory;
  });

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setShowAuthModal(true);
  }

  async function handleOAuth(provider: OAuthProvider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section
        className="relative min-h-screen bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(2,6,23,.95) 0%, rgba(2,6,23,.70) 45%, rgba(2,6,23,.90) 100%), url('/hero-bg.webp')",
        }}
      >
        <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#020617]/85 px-8 backdrop-blur-xl">
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
                Powered By
              </p>
              <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
                EvoGaming
              </p>
            </div>
          </div>

          <div className="hidden w-[560px] items-center rounded-full border border-cyan-400/20 bg-gradient-to-r from-white/10 to-cyan-500/5 shadow-lg shadow-cyan-500/10 backdrop-blur-xl transition-all duration-300 focus-within:border-cyan-300 focus-within:shadow-cyan-400/30 xl:flex">
            <div className="flex h-11 w-12 items-center justify-center rounded-l-full text-cyan-300">
              🔍
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts, coins, skins..."
              className="h-11 w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-gray-400"
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-11 cursor-pointer border-l border-white/10 bg-white/10 px-4 text-sm font-bold text-white outline-none"
            >
              <option className="bg-[#020617]" value="all">
                All services
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  className="bg-[#020617]"
                  value={category.slug}
                >
                  {category.name}
                </option>
              ))}
            </select>

            <button className="mr-1 rounded-full bg-cyan-400 px-4 py-2 text-xs font-black text-black transition hover:bg-cyan-300">
              Search
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/seller"
              className="hidden rounded-full border border-cyan-400 px-5 py-2 font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-black sm:block"
            >
              Sell With Us
            </Link>

            <button
              onClick={() => openAuth("login")}
              className="rounded-full bg-cyan-400 px-6 py-2 font-bold text-black transition hover:bg-cyan-300"
            >
              Login / Sign Up
            </button>
          </div>
        </nav>

        <div className="relative z-10 px-8 pt-20 pb-12">
          <div className="max-w-5xl">
            <div className="mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 backdrop-blur">
              🚀 Trusted Marketplace For Gamers
            </div>

            <h1 className="max-w-5xl text-4xl font-black leading-tight tracking-tight md:text-6xl xl:text-7xl">
              All Your Gaming Needs
              <br />
              in One Secure{" "}
              <span className="text-yellow-400">Marketplace</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-200 md:text-lg">
              Buy and sell game accounts, top-ups, gift cards, coins, boosting,
              skins, software, and digital items safely with trusted transaction
              protection.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
                <p className="text-2xl font-black text-cyan-300">500+</p>
                <p className="text-sm text-gray-300">Products</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
                <p className="text-2xl font-black text-cyan-300">100+</p>
                <p className="text-sm text-gray-300">Sellers</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
                <p className="text-2xl font-black text-cyan-300">24/7</p>
                <p className="text-sm text-gray-300">Support</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-gray-100">
              <span className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur">
                🔒 Secure Transactions
              </span>

              <span className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur">
                ⚡ Fast Delivery
              </span>

              <span className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur">
                🎧 24/7 Support
              </span>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="mb-6 text-3xl font-black">Select Categories</h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filteredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl shadow-black/30 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-950/30"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl">
                    {category.icon}
                  </div>

                  <h3 className="mt-5 text-2xl font-black group-hover:text-cyan-300">
                    {category.name}
                  </h3>

                  <p className="mt-2 text-sm text-gray-300">
                    Explore products
                  </p>

                  <div className="mt-5 text-sm font-bold text-cyan-300 opacity-0 transition group-hover:opacity-100">
                    Browse category →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black px-8 py-8 text-sm text-gray-400">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>© 2026 ComePlayers. All rights reserved.</p>

          <div className="flex gap-5">
            <Link href="/seller" className="hover:text-cyan-300">
              Sell With Us
            </Link>
            <button
              onClick={() => openAuth("login")}
              className="hover:text-cyan-300"
            >
              Login / Sign Up
            </button>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#171b3a] p-7 shadow-2xl shadow-black/60">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-5 top-5 text-2xl text-gray-400 transition hover:text-white"
            >
              ×
            </button>

            <div className="mb-6 text-center">
              <h2 className="text-3xl font-black">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {authMode === "login"
                  ? "Login to continue your ComePlayers journey."
                  : "Register and start buying or selling safely."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded-xl py-3 text-sm font-bold transition ${
                  authMode === "login"
                    ? "bg-cyan-400 text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Login
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={`rounded-xl py-3 text-sm font-bold transition ${
                  authMode === "register"
                    ? "bg-cyan-400 text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert(
                  authMode === "login"
                    ? "Login system akan kita hubungkan ke Supabase setelah ini."
                    : "Register system akan kita hubungkan ke Supabase setelah ini."
                );
              }}
            >
              {authMode === "register" && (
                <input
                  type="text"
                  placeholder="Username"
                  className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />
              )}

              <input
                type="email"
                placeholder="Email"
                className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />

              <input
                type="password"
                placeholder="Password"
                className="mb-5 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />

              {authMode === "register" && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="mb-5 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />
              )}

              <button className="w-full rounded-xl bg-cyan-400 py-3 font-black text-black transition hover:bg-cyan-300">
                {authMode === "login" ? "Login" : "Create Account"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-sm text-gray-500">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 py-3 transition hover:border-cyan-400 hover:bg-white/15"
                aria-label="Continue with Google"
              >
                <svg width="22" height="22" viewBox="0 0 48 48">
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.4 39.5 16.1 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 39.3 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("discord")}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 py-3 transition hover:border-cyan-400 hover:bg-white/15"
                aria-label="Continue with Discord"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2">
                  <path d="M20.3 4.4A16.4 16.4 0 0 0 16.2 3c-.2.4-.5.9-.6 1.3a15.2 15.2 0 0 0-7.2 0C8.2 3.9 8 3.4 7.8 3a16.2 16.2 0 0 0-4.1 1.4C1.1 8.3.4 12.1.7 15.9A16.5 16.5 0 0 0 5.8 18.5c.4-.6.8-1.2 1.1-1.8-.6-.2-1.1-.5-1.6-.8l.4-.3c3.1 1.4 6.5 1.4 9.6 0l.4.3c-.5.3-1 .6-1.6.8.3.6.7 1.2 1.1 1.8a16.5 16.5 0 0 0 5.1-2.6c.4-4.4-.6-8.1-3-11.5zM8.7 13.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("facebook")}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 py-3 transition hover:border-cyan-400 hover:bg-white/15"
                aria-label="Continue with Facebook"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23 10.1 24v-8.4h-3v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.4l-.5 3.5h-2.9V24C19.6 23 24 18.1 24 12.1z" />
                </svg>
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              By continuing, you agree to ComePlayers Terms and Privacy Policy.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}