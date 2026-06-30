"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  FaBalanceScale,
  FaBell,
  FaBullhorn,
  FaCommentDots,
  FaCog,
  FaDiscord,
  FaShoppingBag,
  FaSignOutAlt,
  FaStore,
  FaWallet,
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useCurrency } from "@/components/CurrencyProvider";
import { supabase } from "@/lib/supabase";
import MarketplaceSearch from "@/components/marketplace/MarketplaceSearch";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";


function getUsernameFromEmail(email?: string | null) {
  const localPart = (email || "").split("@")[0]?.trim();
  if (!localPart) return "player";
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "player";
}

function getSafeDisplayName(profileUsername?: string | null, email?: string | null) {
  const username = profileUsername?.trim();
  if (username && username.toLowerCase() !== "unknown user") {
    return username;
  }

  return getUsernameFromEmail(email);
}

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

type Announcement = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  type: string;
  priority: string;
  status: string;
  is_pinned: boolean;
  publish_at: string | null;
  expire_at: string | null;
  created_at: string;
};

type NotificationItem = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

type ChatToast = {
  id: string;
  room_id: string;
  sender_id: string;
  message: string | null;
  created_at: string;
  sender_name: string;
};

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  seller_status: string | null;
  avatar_url: string | null;
};

type AuthMode = "login" | "register";
type OAuthProvider = "google" | "discord";

function isVisibleAnnouncement(item: Announcement) {
  const now = Date.now();

  if (item.status !== "published") return false;
  if (item.publish_at && new Date(item.publish_at).getTime() > now) return false;
  if (item.expire_at && new Date(item.expire_at).getTime() < now) return false;

  return true;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}


function getOAuthUsername(user: User) {
  const metadata = user.user_metadata || {};
  const rawName =
    metadata.user_name ||
    metadata.preferred_username ||
    metadata.name ||
    metadata.full_name ||
    user.email?.split("@")[0] ||
    "player";

  return String(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function getInitial(name?: string | null) {
  if (!name) return "U";
  return name.trim().charAt(0).toUpperCase();
}

export default function MainHeader() {
  const { formatPrice, currency } = useCurrency();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [chatToast, setChatToast] = useState<ChatToast | null>(null);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [latestNotifications, setLatestNotifications] = useState<
    NotificationItem[]
  >([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState<
    Announcement[]
  >([]);

  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileSellingMenu, setShowProfileSellingMenu] = useState(false);
  const [showProfileSettingsMenu, setShowProfileSettingsMenu] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const totalHeaderUnread = unreadCount + announcementUnreadCount;

  const visibleLatestAnnouncements = useMemo(() => {
    return latestAnnouncements.filter(isVisibleAnnouncement).slice(0, 4);
  }, [latestAnnouncements]);

  async function createInitialWallet() {
    try {
      await authenticatedFetchJson("/api/wallet/topups", {
        method: "POST",
        body: JSON.stringify({ action: "ensure-wallet" }),
      });
      return true;
    } catch (error) {
      console.error(
        "Create initial wallet error:",
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  async function ensureOAuthProfile(currentUser: User) {
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("OAuth profile lookup error:", profileError.message);
    }

    // Profile is created automatically by Supabase trigger.
    // Never insert/upsert profile from client header.
    await createInitialWallet();

    if (!existingProfile) {
      console.warn("Profile row is not ready yet. Fallback username will use auth email.");
    }
  }

  async function loadUserProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,username,role,seller_status,avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error.message);
      setProfile(null);
      return;
    }

    setProfile(data || null);
  }

  async function loadWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Wallet load error:", error.message);
      setWalletBalance(0);
      return;
    }

    setWalletBalance(Number(data?.balance || 0));
  }

  async function loadNotifications(userId: string) {
    const [countResult, listResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("id,user_id,type,title,message,link_url,is_read,created_at")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(5),
    ]);

    if (countResult.error) {
      console.error(
        "Unread notification count error:",
        countResult.error.message
      );
      setUnreadCount(0);
    } else {
      setUnreadCount(countResult.count || 0);
    }

    if (listResult.error) {
      console.error("Latest notifications error:", listResult.error.message);
      setLatestNotifications([]);
    } else {
      setLatestNotifications(listResult.data || []);
    }
  }

  async function loadUnreadMessages() {
    try {
      const data = await authenticatedFetchJson<{ count: number }>(
        "/api/messages/unread"
      );
      setUnreadMessageCount(Number(data.count || 0));
    } catch (error) {
      console.error(
        "Unread message count error:",
        error instanceof Error ? error.message : error
      );
      setUnreadMessageCount(0);
    }
  }

  function playChatSound() {
    try {
      const audio = new Audio("/sounds/chat.mp3");
      audio.volume = 0.35;
      audio.play().catch(() => {
        // Browser may block sound until the user interacts with the page.
      });
    } catch {
      // Ignore sound errors.
    }
  }

  async function showChatToastFromMessage(messageRow: {
    id: string;
    room_id: string;
    sender_id: string;
    message: string | null;
    created_at: string;
  }) {
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("username,email")
      .eq("id", messageRow.sender_id)
      .maybeSingle();

    const senderName =
      senderProfile?.username ||
      senderProfile?.email ||
      "New message";

    setChatToast({
      id: messageRow.id,
      room_id: messageRow.room_id,
      sender_id: messageRow.sender_id,
      message: messageRow.message,
      created_at: messageRow.created_at,
      sender_name: senderName,
    });

    window.setTimeout(() => {
      setChatToast((current) =>
        current?.id === messageRow.id ? null : current
      );
    }, 7000);
  }

  async function loadAnnouncements(currentUserId?: string) {
    const { data: announcementData, error: announcementError } = await supabase
      .from("announcements")
      .select(
        "id,title,slug,summary,type,priority,status,is_pinned,publish_at,expire_at,created_at"
      )
      .eq("status", "published")
      .order("is_pinned", { ascending: false })
      .order("id", { ascending: false })
      .limit(12);

    if (announcementError) {
      console.error("Announcement load error:", announcementError.message);
      setLatestAnnouncements([]);
      setAnnouncementUnreadCount(0);
      return;
    }

    const visible = (announcementData || []).filter(isVisibleAnnouncement);
    setLatestAnnouncements(visible);

    if (!currentUserId || visible.length === 0) {
      setAnnouncementUnreadCount(0);
      return;
    }

    const announcementIds = visible.map((item) => item.id);

    const { data: readData, error: readError } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", currentUserId)
      .in("announcement_id", announcementIds);

    if (readError) {
      console.error("Announcement reads error:", readError.message);
      setAnnouncementUnreadCount(0);
      return;
    }

    const readIds = new Set(
      (readData || []).map((item) => item.announcement_id)
    );
    setAnnouncementUnreadCount(
      announcementIds.filter((id) => !readIds.has(id)).length
    );
  }

  async function loadUserHeaderData(currentUser: User) {
    await ensureOAuthProfile(currentUser);
    await createInitialWallet();

    await Promise.all([
      loadUserProfile(currentUser.id),
      loadWallet(currentUser.id),
      loadNotifications(currentUser.id),
      loadUnreadMessages(),
      loadAnnouncements(currentUser.id),
    ]);
  }

  useEffect(() => {
    async function initializeHeader() {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user || null;

      setUser(currentUser);

      if (currentUser) {
        await loadUserHeaderData(currentUser);
      } else {
        setProfile(null);
        setWalletBalance(0);
        setUnreadCount(0);
        setUnreadMessageCount(0);
        setChatToast(null);
        setAnnouncementUnreadCount(0);
        setLatestNotifications([]);
        await loadAnnouncements();
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
        loadUserHeaderData(currentUser);
      } else {
        setProfile(null);
        setWalletBalance(0);
        setUnreadCount(0);
        setUnreadMessageCount(0);
        setChatToast(null);
        setAnnouncementUnreadCount(0);
        setLatestNotifications([]);
        setShowProfileDropdown(false);
        setShowNotificationDropdown(false);
        loadAnnouncements();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const notificationChannel = supabase
      .channel(`main-header-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadNotifications(user.id)
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`main-header-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          await loadUnreadMessages();

          if (payload.eventType === "INSERT") {
            const newMessage = payload.new as {
              id: string;
              room_id: string;
              sender_id: string;
              message: string | null;
              created_at: string;
            };

            if (newMessage.sender_id !== user.id) {
              playChatSound();
              await showChatToastFromMessage(newMessage);
            }
          }
        }
      )
      .subscribe();

    const walletChannel = supabase
      .channel(`main-header-wallet-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadWallet(user.id)
      )
      .subscribe();

    const announcementReadChannel = supabase
      .channel(`main-header-announcement-reads-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcement_reads",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadAnnouncements(user.id)
      )
      .subscribe();

    const announcementChannel = supabase
      .channel("main-header-announcements")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => loadAnnouncements(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(announcementReadChannel);
      supabase.removeChannel(announcementChannel);
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

      const walletCreated = await createInitialWallet();

      if (!walletCreated) {
        alert(
          "Account created, but wallet creation failed. Please contact support."
        );
        setAuthLoading(false);
        return;
      }
    }

    alert("Account created successfully.");
    closeAuthModal();
    setAuthLoading(false);
  }

  async function handleOAuthLogin(provider: OAuthProvider) {
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
      setAuthLoading(false);
    }
  }

  async function handleSellWithUs() {
    if (!user) {
      openAuthModal("login");
      return;
    }

    const { data: currentProfile, error } = await supabase
      .from("profiles")
      .select("seller_status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (currentProfile?.seller_status === "approved") {
      router.push("/seller");
      return;
    }

    if (currentProfile?.seller_status === "pending") {
      alert("Your seller application is still under review.");
      return;
    }

    router.push("/seller/apply");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setWalletBalance(0);
    setUnreadCount(0);
    setUnreadMessageCount(0);
    setChatToast(null);
    setAnnouncementUnreadCount(0);
    setLatestNotifications([]);
    setShowProfileDropdown(false);
    setShowNotificationDropdown(false);
  }

  return (
    <>
      <nav className="sticky top-0 z-50 flex min-h-24 w-full items-center gap-6 border-b border-white/10 bg-[#020617] px-8 shadow-2xl shadow-black/40">
        <div className="flex shrink-0 items-center gap-5">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png?v=2"
              alt="ComePlayers"
              className="h-16 w-auto object-contain md:h-20"
            />
          </Link>

          <div className="hidden border-l border-slate-800 pl-5 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              Powered By
            </p>
            <p className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-lg font-black text-transparent">
              EvoGaming
            </p>
          </div>
        </div>

        <div className="flex min-w-[320px] flex-1">
          <MarketplaceSearch
            categories={categories}
            placeholder="Search games, products..."
            compact
          />
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
                href="/messages"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-[#111827] text-gray-300 transition hover:bg-[#1f2937] hover:text-white"
                title="Messages"
              >
                <FaCommentDots />

                {unreadMessageCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => {
                  setShowNotificationDropdown(!showNotificationDropdown);
                  setShowProfileDropdown(false);
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-[#111827] text-yellow-300 transition hover:bg-[#1f2937] hover:text-yellow-200"
                title="Notifications"
              >
                <FaBell />

                {totalHeaderUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    {totalHeaderUnread > 99 ? "99+" : totalHeaderUnread}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowNotificationDropdown(false);
                }}
                className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-400/50 bg-[#0b1220] transition hover:border-cyan-400"
                title="Profile"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || "Profile"}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-xs font-black text-black">
                    {getInitial(profile?.username || user?.email || "U")}
                  </div>
                )}
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

      {showNotificationDropdown && user && (
        <div
          className="fixed right-6 top-[92px] z-[99999] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
          style={{
            backgroundColor: "#111827",
            opacity: 1,
            backdropFilter: "none",
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-700 bg-[#1b2436] p-4">
            <div>
              <p className="font-black text-white">Notifications</p>
              <p className="text-xs text-gray-400">
                {totalHeaderUnread} unread updates
              </p>
            </div>

            <Link
              href="/notifications"
              onClick={() => setShowNotificationDropdown(false)}
              className="text-xs font-black text-cyan-300 hover:text-cyan-200"
            >
              View all →
            </Link>
          </div>

          <div className="max-h-[70vh] overflow-y-auto bg-[#111827]">
            {latestNotifications.length === 0 &&
            visibleLatestAnnouncements.length === 0 ? (
              <div className="p-5 text-center text-sm text-gray-400">
                No new updates.
              </div>
            ) : (
              <>
                {latestNotifications.map((notification) => (
                  <Link
                    key={`notification-${notification.id}`}
                    href={notification.link_url || "/notifications"}
                    onClick={() => setShowNotificationDropdown(false)}
                    className="flex gap-3 border-b border-slate-800 bg-[#111827] p-4 transition hover:bg-[#202b42]"
                  >
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#123142] text-cyan-300">
                      <FaBell />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 font-black text-white">
                          {notification.title}
                        </p>

                        {!notification.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                        {notification.message || notification.type}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {formatShortDate(notification.created_at)}
                      </p>
                    </div>
                  </Link>
                ))}

                {visibleLatestAnnouncements.map((announcement) => (
                  <Link
                    key={`announcement-${announcement.id}`}
                    href={`/announcements/${announcement.slug}`}
                    onClick={() => setShowNotificationDropdown(false)}
                    className="flex gap-3 border-b border-slate-800 bg-[#111827] p-4 transition hover:bg-[#202b42]"
                  >
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#332b12] text-yellow-300">
                      <FaBullhorn />
                    </div>

                    <div className="min-w-0">
                      <p className="line-clamp-1 font-black text-white">
                        {announcement.title}
                      </p>

                      <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                        {announcement.summary ||
                          `${announcement.type} announcement`}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {formatShortDate(
                          announcement.publish_at || announcement.created_at
                        )}
                      </p>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {showProfileDropdown && user && (
        <div
          className="fixed right-6 top-[92px] z-[99999] w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
          style={{
            backgroundColor: "#111827",
            opacity: 1,
            backdropFilter: "none",
          }}
        >
          <div className="border-b border-slate-700 bg-[#1b2436] p-5">
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || "User"}
                  className="h-14 w-14 rounded-full border border-cyan-400/30 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-xl font-black text-black">
                  {getInitial(profile?.username || user.email)}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate font-black text-white">
                  {profile?.username || user.email?.split("@")[0] || "User"}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {profile?.email || user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-700 bg-[#111827] p-4">
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-[#162b24] p-4">
              <div>
                <p className="text-xs font-bold text-gray-400">
                  Wallet Credit
                </p>
                <p className="mt-1 text-lg font-black text-emerald-300">
                  {formatPrice(walletBalance)}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {currency}
                </p>
              </div>
              <FaWallet className="text-2xl text-emerald-300" />
            </div>
          </div>

          <div className="grid gap-1 bg-[#111827] p-3">
            
                    <Link
                      href="/wallet"
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <FaWallet className="text-gray-300" />
                      Wallet
                    </Link>

                    <Link
                      href="/my-orders"
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <FaShoppingBag className="text-gray-300" />
                      My Orders
                    </Link>

                    <Link
                      href="/resolution-center"
                      onClick={() => setShowProfileDropdown(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <FaBalanceScale className="text-gray-300" />
                      Resolution Center
                    </Link>

                    <button
                      type="button"
                      onClick={() => setShowProfileSellingMenu((value) => !value)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                        showProfileSellingMenu
                          ? "bg-white/10 text-white"
                          : "text-gray-200 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-3 font-bold">
                        <FaStore className="text-gray-300" />
                        Selling
                      </span>
                      <span className={`text-xs transition ${showProfileSellingMenu ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>

                    {showProfileSellingMenu && (
                      <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-3">
                        <Link
                          href="/seller/apply"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Become a Seller
                        </Link>
                        <Link
                          href="/seller"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Seller Dashboard
                        </Link>
                        <Link
                          href="/seller/products"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Manage Products
                        </Link>
                        <Link
                          href="/seller/products/new"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Create Product
                        </Link>
                        <Link
                          href="/seller/orders"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Manage Orders
                        </Link>
                        <Link
                          href="/wallet"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Payment
                        </Link>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowProfileSettingsMenu((value) => !value)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                        showProfileSettingsMenu
                          ? "bg-white/10 text-white"
                          : "text-gray-200 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-3 font-bold">
                        <FaCog className="text-gray-300" />
                        Settings
                      </span>
                      <span className={`text-xs transition ${showProfileSettingsMenu ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>

                    {showProfileSettingsMenu && (
                      <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-3">
                        <Link
                          href="/account"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Account
                        </Link>
                        <Link
                          href="/account/connects"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Social Connect
                        </Link>
                        <Link
                          href="/account/security"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Privacy & Security
                        </Link>
                        <Link
                          href="/account/verification"
                          onClick={() => setShowProfileDropdown(false)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-cyan-300"
                        >
                          Verification
                        </Link>
                      </div>
                    )}

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-black text-red-300 transition hover:bg-red-500/10"
                    >
                      <FaSignOutAlt />
                      Log Out
                    </button>

          </div>
        </div>
      )}

      {chatToast && user && (
        <button
          onClick={() => {
            setChatToast(null);
            router.push(`/messages?room=${chatToast.room_id}`);
          }}
          className="fixed bottom-6 right-6 z-[10001] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-cyan-400/30 bg-[#111827] p-4 text-left shadow-[0_20px_60px_rgba(0,0,0,0.95)] transition hover:border-cyan-300 hover:bg-[#182238]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
              {getInitial(chatToast.sender_name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-black text-white">
                  {chatToast.sender_name}
                </p>
                <span className="text-xs font-bold text-cyan-300">New chat</span>
              </div>

              <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                {chatToast.message || "Sent a message."}
              </p>

              <p className="mt-2 text-xs font-bold text-cyan-300">
                Click to open conversation →
              </p>
            </div>

            <span
              onClick={(event) => {
                event.stopPropagation();
                setChatToast(null);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-sm font-black text-gray-400 hover:bg-white hover:text-black"
            >
              ×
            </span>
          </div>
        </button>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-6 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#171b3a] p-7 shadow-2xl shadow-black/80">
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

            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-slate-700 bg-[#0b1024] p-1">
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded-xl py-3 font-black transition ${
                  authMode === "login" ? "bg-cyan-400 text-black" : "text-white"
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
                  className="w-full rounded-xl border border-slate-700 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-700 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
              />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-700 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
              />

              {authMode === "register" && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm Password"
                  className="w-full rounded-xl border border-slate-700 bg-[#070b20] px-4 py-4 outline-none focus:border-cyan-400"
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
              <div className="h-px flex-1 bg-slate-700" />
              <p className="text-sm text-gray-400">OR</p>
              <div className="h-px flex-1 bg-slate-700" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={authLoading}
                onClick={() => handleOAuthLogin("google")}
                className="flex h-11 items-center justify-center rounded-xl border border-slate-700 bg-[#111827] transition hover:border-cyan-400/60 hover:bg-[#202b42] disabled:cursor-not-allowed disabled:opacity-60"
                title="Continue with Google"
              >
                <FcGoogle className="h-5 w-5" />
              </button>

              <button
                type="button"
                disabled={authLoading}
                onClick={() => handleOAuthLogin("discord")}
                className="flex h-11 items-center justify-center rounded-xl border border-slate-700 bg-[#111827] transition hover:border-[#5865F2]/70 hover:bg-[#202b42] disabled:cursor-not-allowed disabled:opacity-60"
                title="Continue with Discord"
              >
                <FaDiscord className="h-5 w-5 text-[#5865F2]" />
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