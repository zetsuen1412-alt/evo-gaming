"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function initializePage() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);

      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      setCategories(categoryData || []);
    }

    initializePage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  function openAuthModal(mode: AuthMode) {
    setAuthMode(mode);
    setShowAuthModal(true);
  }

  function closeAuthModal() {
    setShowAuthModal(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleEmailAuth(event: React.FormEvent) {
    event.preventDefault();

    if (!email || !password) {
      alert("Please fill in your email and password.");
      return;
    }

    setAuthLoading(true);

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

      closeAuthModal();
      setAuthLoading(false);
      return;
    }

    if (!username) {
      alert("Please enter your username.");
      setAuthLoading(false);
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      setAuthLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      setAuthLoading(false);
      return;
    }

    const { data: existingUsername, error: usernameCheckError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (usernameCheckError) {
      alert(usernameCheckError.message);
      setAuthLoading(false);
      return;
    }

    if (existingUsername) {
      alert("Username is already taken.");
      setAuthLoading(false);
      return;
    }

    const { data: existingEmail, error: emailCheckError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (emailCheckError) {
      alert(emailCheckError.message);
      setAuthLoading(false);
      return;
    }

    if (existingEmail) {
      alert("Email is already registered.");
      setAuthLoading(false);
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (signUpError) {
      alert(signUpError.message);
      setAuthLoading(false);
      return;
    }

    const userId = authData.user?.id;

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        username,
        role: "user",
        seller_status: "not_applied",
        avatar_url: null,
        bio: "ComePlayers user.",
        discord: null,
      });

      if (profileError) {
        alert(profileError.message);
        setAuthLoading(false);
        return;
      }
    }

    alert("Account created successfully.");
    closeAuthModal();
    setAuthLoading(false);
  }

  async function handleOAuthLogin(provider: "google" | "discord" | "facebook") {
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

  async function handleSellWithUs() {
    if (!user) {
      openAuthModal("login");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("seller_status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (profile?.seller_status === "approved") {
      window.location.href = "/seller";
      return;
    }

    if (profile?.seller_status === "pending") {
      alert("Your seller application is still under review.");
      return;
    }

    window.location.href = "/seller/apply";
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <main
      className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(2,6,23,.72), rgba(2,6,23,.9)), url('/hero-bg.webp')",
      }}
    >
      <nav className="sticky top-0 z-50 flex h-24 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
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

        <div className="hidden w-full max-w-md rounded-full border border-white/10 bg-white/[0.07] px-5 py-3 shadow-xl shadow-cyan-500/5 focus-within:border-cyan-400 md:block">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSellWithUs}
            className="hidden rounded-full border border-cyan-400 px-5 py-2 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black sm:block"
          >
            Sell With Us
          </button>

          {user ? (
            <>
              <Link
                href="/my-orders"
                className="hidden rounded-full border border-white/10 px-5 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black md:block"
              >
                My Orders
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => openAuthModal("login")}
              className="rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
            >
              Login / Signup
            </button>
          )}
        </div>
      </nav>

      <section className="px-8 pb-12 pt-16">
        <div className="max-w-4xl">
          <p className="mb-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-300">
            🚀 Trusted Marketplace For Gamers
          </p>

          <h1 className="text-5xl font-black leading-tight md:text-7xl">
            All Your Gaming Needs
            <br />
            in One Secure
            <br />
            <span className="text-yellow-400">Marketplace</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-gray-200">
            Buy and sell game accounts, top-ups, gift cards, coins, boosting,
            skins, software, and digital items safely with trusted transaction
            protection.
          </p>

          <div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">500+</p>
              <p className="text-sm text-gray-300">Products</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">100+</p>
              <p className="text-sm text-gray-300">Sellers</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-3xl font-black text-cyan-300">24/7</p>
              <p className="text-sm text-gray-300">Support</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold">
            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              🔒 Secure Transactions
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              ⚡ Fast Delivery
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
              🎧 24/7 Support
            </span>
          </div>
        </div>
      </section>

      <section className="px-8 pb-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black">Select Categories</h2>
            <p className="mt-2 text-gray-300">
              Explore trusted gaming products by category.
            </p>
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <h3 className="text-2xl font-black">No categories found.</h3>
            <p className="mt-3 text-gray-400">
              Try searching with another keyword.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-950/20"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-2xl">
                  {category.icon || "🎮"}
                </div>

                <h3 className="mt-6 text-2xl font-black group-hover:text-cyan-300">
                  {category.name}
                </h3>

                <p className="mt-2 text-gray-400">Explore products</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#171b3a] p-7 shadow-2xl shadow-black/50">
            <button
              onClick={closeAuthModal}
              className="absolute right-6 top-5 text-2xl font-black text-gray-400 hover:text-white"
            >
              ×
            </button>

            <div className="text-center">
              <h2 className="text-3xl font-black">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </h2>

              <p className="mt-2 text-sm text-gray-400">
                {authMode === "login"
                  ? "Login to continue your ComePlayers journey."
                  : "Register and start buying safely."}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded-xl py-3 font-black transition ${
                  authMode === "login"
                    ? "bg-cyan-400 text-black"
                    : "text-white"
                }`}
              >
                Login
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={`rounded-xl py-3 font-black transition ${
                  authMode === "register"
                    ? "bg-cyan-400 text-black"
                    : "text-white"
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="mt-6 grid gap-4">
              {authMode === "register" && (
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  className="w-full rounded-xl border border-white/10 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-white/10 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
              />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/10 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
              />

              {authMode === "register" && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm Password"
                  className="w-full rounded-xl border border-white/10 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
                />
              )}

              <button
                disabled={authLoading}
                className="rounded-xl bg-cyan-400 py-4 font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <p className="text-sm text-gray-400">OR</p>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleOAuthLogin("google")}
                className="rounded-xl border border-white/10 bg-white/10 py-3 font-black hover:bg-white/20"
              >
                G
              </button>

              <button
                onClick={() => handleOAuthLogin("discord")}
                className="rounded-xl border border-white/10 bg-white/10 py-3 font-black hover:bg-white/20"
              >
                🎮
              </button>

              <button
                onClick={() => handleOAuthLogin("facebook")}
                className="rounded-xl border border-white/10 bg-white/10 py-3 font-black hover:bg-white/20"
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