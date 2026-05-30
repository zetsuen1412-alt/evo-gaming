"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
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

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }

    loadCategories();
    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
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

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);

    if (authMode === "register" && password !== confirmPassword) {
      alert("Password dan Confirm Password tidak sama.");
      setAuthLoading(false);
      return;
    }

    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        setAuthLoading(false);
        return;
      }

      setShowAuthModal(false);
    }

    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) {
        alert(error.message);
        setAuthLoading(false);
        return;
      }

      alert("Registrasi berhasil. Cek email jika Supabase meminta konfirmasi.");
      setShowAuthModal(false);
    }

    setAuthLoading(false);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
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

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                  {user.email?.charAt(0).toUpperCase()}
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/20 px-5 py-2 font-semibold transition hover:bg-white hover:text-black"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuth("login")}
                className="rounded-full bg-cyan-400 px-6 py-2 font-bold text-black transition hover:bg-cyan-300"
              >
                Login / Sign Up
              </button>
            )}
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
            {!user && (
              <button
                onClick={() => openAuth("login")}
                className="hover:text-cyan-300"
              >
                Login / Sign Up
              </button>
            )}
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

            <form onSubmit={handleEmailAuth}>
              {authMode === "register" && (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="mb-5 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
              />

              {authMode === "register" && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  required
                  className="mb-5 w-full rounded-xl border border-white/10 bg-[#090d24] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />
              )}

              <button
                disabled={authLoading}
                className="w-full rounded-xl bg-cyan-400 py-3 font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? "Loading..."
                  : authMode === "login"
                  ? "Login"
                  : "Create Account"}
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
              >
                G
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("discord")}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 py-3 transition hover:border-cyan-400 hover:bg-white/15"
              >
                🎮
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("facebook")}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/10 py-3 transition hover:border-cyan-400 hover:bg-white/15"
              >
                f
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