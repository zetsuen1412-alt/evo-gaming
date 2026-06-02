"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

const typeFilters = [
  "all",
  "order",
  "payment",
  "review",
  "follower",
  "dispute",
  "seller",
  "system",
];

function getTypeClass(type: string) {
  if (type === "order") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
  if (type === "payment") return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  if (type === "review") return "border-purple-400/20 bg-purple-400/10 text-purple-300";
  if (type === "follower") return "border-green-400/20 bg-green-400/10 text-green-300";
  if (type === "dispute") return "border-orange-400/20 bg-orange-400/10 text-orange-300";
  if (type === "seller") return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  return "border-white/10 bg-white/[0.04] text-gray-300";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPageV1() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesType =
        activeType === "all" || notification.type === activeType;

      const matchesSearch =
        !query ||
        notification.title.toLowerCase().includes(query) ||
        (notification.message || "").toLowerCase().includes(query) ||
        notification.type.toLowerCase().includes(query) ||
        String(notification.id).includes(query);

      return matchesType && matchesSearch;
    });
  }, [notifications, activeType, search]);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const readCount = notifications.filter(
    (notification) => notification.is_read
  ).length;

  async function loadNotifications(currentUser: User) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setNotifications(data || []);
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
      await loadNotifications(userData.user);
      setLoading(false);
    }

    initializePage();
  }, []);

  async function markAsRead(notificationId: number) {
    if (!user) return;

    setUpdatingId(notificationId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    await loadNotifications(user);
    setUpdatingId(null);
  }

  async function markAsUnread(notificationId: number) {
    if (!user) return;

    setUpdatingId(notificationId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: false })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    await loadNotifications(user);
    setUpdatingId(null);
  }

  async function markAllAsRead() {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadNotifications(user);
  }

  async function deleteNotification(notificationId: number) {
    if (!user) return;

    if (!confirm("Delete this notification?")) return;

    setUpdatingId(notificationId);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    await loadNotifications(user);
    setUpdatingId(null);
  }

  async function clearReadNotifications() {
    if (!user) return;

    if (!confirm("Delete all read notifications?")) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("is_read", true);

    if (error) {
      alert(error.message);
      return;
    }

    await loadNotifications(user);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">
          Loading notifications...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">
            Login Required
          </h1>

          <p className="mt-4 text-gray-400">
            Please login first to view notifications.
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
      <section className="relative overflow-hidden border-b border-white/10 px-8 py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.20),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-300">
              Notification Center
            </p>

            <h1 className="text-5xl font-black md:text-7xl">
              Notifications
            </h1>

            <p className="mt-5 max-w-3xl text-gray-300">
              Track orders, payments, seller updates, followers, reviews, and
              marketplace activity.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              Logged in as {user.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              Mark All Read
            </button>

            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
            >
              Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Total</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {notifications.length}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Unread</p>
            <p className="mt-2 text-3xl font-black text-yellow-300">
              {unreadCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-gray-400">Read</p>
            <p className="mt-2 text-3xl font-black text-green-300">
              {readCount}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notifications..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-3">
            {typeFilters.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`rounded-full px-5 py-3 text-sm font-bold transition ${
                  activeType === type
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-white/[0.04] text-gray-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {type === "all" ? "All" : type}
              </button>
            ))}
          </div>
        </div>

        {readCount > 0 && (
          <div className="mb-8">
            <button
              onClick={clearReadNotifications}
              className="rounded-full border border-red-400/40 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500 hover:text-white"
            >
              Clear Read Notifications
            </button>
          </div>
        )}

        {filteredNotifications.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-12 text-center shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black">No notifications found.</h2>

            <p className="mt-3 text-gray-400">
              Marketplace updates will appear here.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
            >
              Back to Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-3xl border p-6 shadow-2xl shadow-black/20 ${
                  notification.is_read
                    ? "border-white/10 bg-white/[0.035]"
                    : "border-cyan-400/30 bg-cyan-400/10"
                }`}
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${getTypeClass(
                          notification.type
                        )}`}
                      >
                        {notification.type}
                      </span>

                      {!notification.is_read && (
                        <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-300">
                          Unread
                        </span>
                      )}

                      <span className="text-sm text-gray-500">
                        {formatDate(notification.created_at)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-black">
                      {notification.title}
                    </h2>

                    <p className="mt-3 leading-7 text-gray-300">
                      {notification.message || "No message."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {notification.link_url && (
                      <Link
                        href={notification.link_url}
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-black transition hover:bg-cyan-300"
                      >
                        Open
                      </Link>
                    )}

                    {notification.is_read ? (
                      <button
                        onClick={() => markAsUnread(notification.id)}
                        disabled={updatingId === notification.id}
                        className="rounded-2xl border border-yellow-400/40 px-5 py-3 font-black text-yellow-300 transition hover:bg-yellow-400 hover:text-black disabled:opacity-60"
                      >
                        Mark Unread
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        disabled={updatingId === notification.id}
                        className="rounded-2xl border border-green-400/40 px-5 py-3 font-black text-green-300 transition hover:bg-green-400 hover:text-black disabled:opacity-60"
                      >
                        Mark Read
                      </button>
                    )}

                    <button
                      onClick={() => deleteNotification(notification.id)}
                      disabled={updatingId === notification.id}
                      className="rounded-2xl border border-red-400/40 px-5 py-3 font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                    >
                      Delete
                    </button>

                    {updatingId === notification.id && (
                      <p className="text-center text-sm text-gray-400">
                        Updating...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}