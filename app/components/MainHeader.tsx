"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type AuthMode = "login" | "register";

export default function MainHeader() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function loadUnreadNotifications(userId: string) {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Unread notification count error:", error.message);
      setUnreadCount(0);
      return;
    }

    setUnreadCount(count || 0);
  }

  useEffect(() => {
    async function initializeHeader() {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user || null;

      setUser(currentUser);

      if (currentUser) {
        await loadUnreadNotifications(currentUser.id);
      } else {
        setUnreadCount(0);
      }

      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      setCategories(categoryData || []);
    }

    initializeHeader();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;

      setUser(currentUser);

      if (currentUser) {
        loadUnreadNotifications(currentUser.id);
      } else {
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    loadUnreadNotifications(user.id);

    const channel = supabase
      .channel(`main-header-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadNotifications(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  function handleSearch() {
    const query = search.trim();

    if (selectedCategory) {
      router.push(
        query
          ? `/categories/${selectedCategory}?q=${encodeURIComponent(query)}`
          : `/categories/${selectedCategory}`
      );
      return;
    }

    router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
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
      router.push("/seller");
      return;
    }

    if (profile?.seller_status === "pending") {
      alert("Your seller application is still under review.");
      return;
    }

    router.push("/seller/apply");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setUnreadCount(0);
  }

  return (
    <>
      <nav className="sticky top-0 z-50 flex min-h-24 items-center gap-6 border-b border-white/10 bg-[#020617]/90 px-8 backdrop-blur-xl">
        <div className="flex shrink-0 items-center gap-5">
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

        <div className="flex min-w-[360px] flex-1 items-center rounded-full border border-white/10 bg-white/[0.07] shadow-xl shadow-cyan-500/5 focus-within:border-cyan-400">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="w-44 rounded-l-full border-r border-white/10 bg-[#020617] px-4 py-3 text-sm font-bold text-white outline-none"
          >
            <option value="">All Categories</option>

            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
            placeholder="Search products..."
            className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-400"
          />

          <button
            onClick={handleSearch}
            className="mr-2 shrink-0 rounded-full bg-cyan-400 px-5 py-2 font-black text-black transition hover:bg-cyan-300"
          >
            Search
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={handleSellWithUs}
            className="rounded-full border border-cyan-400 px-5 py-2 font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Sell With Us
          </button>

          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded-full border border-white/10 px-4 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black"
                title="Notifications"
              >
                🔔

                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/my-orders"
                className="rounded-full border border-white/10 px-5 py-2 font-bold text-gray-300 transition hover:bg-white hover:text-black"
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
    </>
  );
}