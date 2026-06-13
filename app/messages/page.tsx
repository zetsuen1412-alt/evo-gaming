"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type Presence = {
  user_id: string;
  last_seen: string | null;
};

type ChatRoom = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: number | null;
  order_id: number | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  is_read: boolean | null;
  created_at: string;
};

type Product = Record<string, any>;
type Order = Record<string, any>;

type RoomView = ChatRoom & {
  buyer?: Profile | null;
  seller?: Profile | null;
  product?: Product | null;
  order?: Order | null;
};

type MessageView = ChatMessage & {
  sender?: Profile | null;
};

function displayName(profile?: Profile | null) {
  return profile?.username || profile?.email || "Unknown User";
}

function avatarLetter(profile?: Profile | null) {
  return displayName(profile).slice(0, 1).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOnline(lastSeen?: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

function formatLastSeen(lastSeen?: string | null) {
  if (!lastSeen) return "Offline";

  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 2) return "Online";
  if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Last seen ${diffDays}d ago`;
}

function formatPrice(value: unknown) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function otherProfile(room: RoomView, userId: string) {
  return room.buyer_id === userId ? room.seller : room.buyer;
}

function otherUserId(room: RoomView, userId: string) {
  return room.buyer_id === userId ? room.seller_id : room.buyer_id;
}

function productTitle(product?: Product | null) {
  return (
    product?.title ||
    product?.name ||
    product?.product ||
    product?.product_name ||
    "Product"
  );
}

function productPrice(product?: Product | null) {
  return product?.price || product?.total_price || 0;
}

function productImage(product?: Product | null) {
  return (
    product?.image_url ||
    product?.thumbnail_url ||
    product?.image ||
    product?.product_image ||
    null
  );
}

function looksLikeImageUrl(value?: string | null) {
  if (!value) return false;
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(value.trim());
}

export default function MessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [roomUnreadMap, setRoomUnreadMap] = useState<Record<string, number>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, Presence>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rooms.filter((room) => {
      if (!q) return true;

      const other = user ? otherProfile(room, user.id) : null;

      return (
        room.id.toLowerCase().includes(q) ||
        String(room.order_id || "").includes(q) ||
        String(room.product_id || "").includes(q) ||
        (room.last_message || "").toLowerCase().includes(q) ||
        displayName(other).toLowerCase().includes(q) ||
        productTitle(room.product).toLowerCase().includes(q)
      );
    });
  }, [rooms, search, user]);

  async function updateMyPresence(currentUserId: string) {
    const { error } = await supabase.from("user_presence").upsert(
      {
        user_id: currentUserId,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("Update presence error:", error.message);
    }
  }

  async function loadPresenceForUserIds(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    if (!uniqueIds.length) {
      setPresenceMap({});
      return;
    }

    const { data, error } = await supabase
      .from("user_presence")
      .select("user_id,last_seen")
      .in("user_id", uniqueIds);

    if (error) {
      console.error("Load presence error:", error.message);
      return;
    }

    setPresenceMap((current) => {
      const next = { ...current };

      ((data || []) as Presence[]).forEach((item) => {
        next[item.user_id] = item;
      });

      return next;
    });
  }

  async function loadPresenceForRooms(roomList: RoomView[] | ChatRoom[]) {
    const userIds = roomList.flatMap((room) => [room.buyer_id, room.seller_id]);
    await loadPresenceForUserIds(userIds);
  }

  function getPresence(userId?: string | null) {
    if (!userId) return null;
    return presenceMap[userId] || null;
  }

  function getPresenceText(userId?: string | null) {
    const presence = getPresence(userId);
    return formatLastSeen(presence?.last_seen);
  }

  function getPresenceOnline(userId?: string | null) {
    const presence = getPresence(userId);
    return isOnline(presence?.last_seen);
  }

  async function hydrateRooms(baseRooms: ChatRoom[]) {
    const profileIds = Array.from(
      new Set(
        baseRooms
          .flatMap((room) => [room.buyer_id, room.seller_id])
          .filter(Boolean)
      )
    );

    const productIds = Array.from(
      new Set(
        baseRooms
          .map((room) => room.product_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    const orderIds = Array.from(
      new Set(
        baseRooms
          .map((room) => room.order_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    const [profilesResult, productsResult, ordersResult] = await Promise.all([
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id,email,username,avatar_url,role")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? supabase.from("products").select("*").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase.from("orders").select("*").in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
      alert(profilesResult.error.message);
    }

    if (productsResult.error) {
      console.warn(productsResult.error.message);
    }

    if (ordersResult.error) {
      console.warn(ordersResult.error.message);
    }

    const profileMap = new Map(
      ((profilesResult.data || []) as Profile[]).map((item) => [item.id, item])
    );

    const productMap = new Map(
      ((productsResult.data || []) as Product[]).map((item) => [Number(item.id), item])
    );

    const orderMap = new Map(
      ((ordersResult.data || []) as Order[]).map((item) => [Number(item.id), item])
    );

    return baseRooms.map((room) => ({
      ...room,
      buyer: profileMap.get(room.buyer_id) || null,
      seller: profileMap.get(room.seller_id) || null,
      product: room.product_id ? productMap.get(room.product_id) || null : null,
      order: room.order_id ? orderMap.get(room.order_id) || null : null,
    }));
  }

  async function loadRooms(currentUser: User, preferredRoomId?: string | null) {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const hydrated = await hydrateRooms((data || []) as ChatRoom[]);
    setRooms(hydrated);
    await loadPresenceForRooms(hydrated);

    const roomFromUrl = preferredRoomId
      ? hydrated.find((room) => room.id === preferredRoomId)
      : null;

    const nextSelected =
      roomFromUrl ||
      (selectedRoom
        ? hydrated.find((room) => room.id === selectedRoom.id) || null
        : null) ||
      hydrated[0] ||
      null;

    setSelectedRoom(nextSelected);

    if (nextSelected) {
      await loadMessages(nextSelected, currentUser.id);
    } else {
      setMessages([]);
    }
  }

  async function hydrateMessages(baseMessages: ChatMessage[]) {
    const senderIds = Array.from(
      new Set(baseMessages.map((message) => message.sender_id).filter(Boolean))
    );

    if (!senderIds.length) return baseMessages as MessageView[];

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,username,avatar_url,role")
      .in("id", senderIds);

    if (error) {
      alert(error.message);
      return baseMessages as MessageView[];
    }

    const profileMap = new Map(
      ((data || []) as Profile[]).map((item) => [item.id, item])
    );

    return baseMessages.map((message) => ({
      ...message,
      sender: profileMap.get(message.sender_id) || null,
    }));
  }

  async function loadMessages(room: RoomView, currentUserId = user?.id) {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      setLoadingMessages(false);
      return;
    }

    const hydrated = await hydrateMessages((data || []) as ChatMessage[]);
    setMessages(hydrated);

    if (currentUserId) {
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("room_id", room.id)
        .eq("receiver_id", currentUserId)
        .eq("is_read", false);

      await loadUnreadCounts(currentUserId);
    }

    setLoadingMessages(false);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function loadUnreadCounts(currentUserId: string) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("room_id")
      .eq("receiver_id", currentUserId)
      .eq("is_read", false);

    if (error) {
      console.error("Load unread counts error:", error.message);
      setRoomUnreadMap({});
      return;
    }

    const map: Record<string, number> = {};

    ((data || []) as { room_id: string }[]).forEach((item) => {
      if (!item.room_id) return;
      map[item.room_id] = (map[item.room_id] || 0) + 1;
    });

    setRoomUnreadMap(map);
  }

  async function setTypingStatus(isTyping: boolean) {
    if (!user || !selectedRoom) return;

    const { error } = await supabase.from("chat_typing").upsert(
      {
        room_id: selectedRoom.id,
        user_id: user.id,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "room_id",
      }
    );

    if (error) {
      console.error("Typing status error:", error.message);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    if (!user || !selectedRoom) return;

    setTypingStatus(value.trim().length > 0);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 1800);
  }

  async function stopTypingNow() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await setTypingStatus(false);
  }

  async function selectRoom(room: RoomView) {
    await stopTypingNow();
    setTypingUserId(null);
    setSelectedRoom(room);
    await loadMessages(room);
    if (user?.id) {
      await loadUnreadCounts(user.id);
    }
  }

  async function insertChatMessage(text: string, lastMessageText?: string) {
    if (!user || !selectedRoom) return false;

    const receiverId = otherUserId(selectedRoom, user.id);

    const { error: insertError } = await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      sender_id: user.id,
      receiver_id: receiverId,
      message: text,
      is_read: false,
    });

    if (insertError) {
      alert(insertError.message);
      return false;
    }

    const { error: updateError } = await supabase
      .from("chat_rooms")
      .update({
        last_message: lastMessageText || text,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selectedRoom.id);

    if (updateError) {
      alert(updateError.message);
      return false;
    }

    await loadMessages(selectedRoom, user.id);
    await loadRooms(user, selectedRoom.id);
    await loadUnreadCounts(user.id);

    return true;
  }

  async function uploadImageMessage(file: File) {
    if (!user || !selectedRoom) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`Image is too large. Maximum size is ${maxSizeMb}MB.`);
      return;
    }

    setUploadingImage(true);
    await stopTypingNow();

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeFileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filePath = `${selectedRoom.id}/${user.id}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploadingImage(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    if (!publicUrl) {
      alert("Failed to get uploaded image URL.");
      setUploadingImage(false);
      return;
    }

    await insertChatMessage(publicUrl, "📷 Image");
    setUploadingImage(false);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function handleImageInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    await uploadImageMessage(file);
  }

  async function sendMessage() {
    if (!user || !selectedRoom) return;

    const text = draft.trim();
    if (!text) return;

    setSending(true);
    await stopTypingNow();

    const ok = await insertChatMessage(text);

    if (ok) {
      setDraft("");
    }

    setSending(false);
  }

  function setQuickMessage(text: string) {
    handleDraftChange(text);
  }

  useEffect(() => {
    let mounted = true;

    async function redirectHome() {
      setUser(null);
      setProfile(null);
      setRooms([]);
      setSelectedRoom(null);
      setMessages([]);
      setRoomUnreadMap({});
      setPresenceMap({});
      window.location.replace("/");
    }

    async function initialize() {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError || !authData.user) {
        await redirectHome();
        return;
      }

      setUser(authData.user);
      await updateMyPresence(authData.user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,username,avatar_url,role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!mounted) return;

      setProfile((profileData || null) as Profile | null);

      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");

      await Promise.all([
        loadRooms(authData.user, roomId),
        loadUnreadCounts(authData.user.id),
      ]);

      if (mounted) {
        setLoading(false);
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        redirectHome();
      }
    });

    return () => {
      mounted = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    updateMyPresence(user.id);

    const interval = window.setInterval(() => {
      updateMyPresence(user.id);
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateMyPresence(user.id);
      }
    };

    const handleFocus = () => {
      updateMyPresence(user.id);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`chat_messages_room_${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        async () => {
          await loadMessages(selectedRoom);

          if (user) {
            await loadRooms(user, selectedRoom.id);
            await loadUnreadCounts(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, user?.id]);

  useEffect(() => {
    if (!selectedRoom || !user) return;

    const channel = supabase
      .channel(`chat_typing_room_${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_typing",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        (payload) => {
          const row = payload.new as {
            room_id: string;
            user_id: string;
            is_typing: boolean;
            updated_at: string;
          } | null;

          if (!row || row.user_id === user.id || !row.is_typing) {
            setTypingUserId(null);
            return;
          }

          const isFresh =
            Date.now() - new Date(row.updated_at).getTime() < 5000;

          setTypingUserId(isFresh ? row.user_id : null);

          if (isFresh) {
            setTimeout(() => {
              setTypingUserId((current) =>
                current === row.user_id ? null : current
              );
            }, 2500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat_messages_global_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const row = payload.new as ChatMessage | null;

          if (
            row &&
            (row.sender_id === user.id || row.receiver_id === user.id)
          ) {
            await loadRooms(user, selectedRoom?.id || null);
            await loadUnreadCounts(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedRoom?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user_presence_messages_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        (payload) => {
          const row = payload.new as Presence | null;
          if (!row?.user_id) return;

          setPresenceMap((current) => ({
            ...current,
            [row.user_id]: row,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading messages...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Redirecting...</p>
      </main>
    );
  }

  const selectedOther = selectedRoom ? otherProfile(selectedRoom, user.id) : null;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Message Center
            </p>

            <h1 className="mt-4 text-5xl font-black">Messages</h1>

            <p className="mt-3 text-gray-400">
              Chat with buyers and sellers in real time.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
          >
            Browse Marketplace
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 px-6 py-8 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1020] lg:rounded-l-3xl lg:rounded-tr-none">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                {avatarLetter(profile)}
              </div>

              <div>
                <p className="font-black">{displayName(profile)}</p>
                <p className="text-xs font-bold text-green-300">● Online</p>
              </div>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or order no."
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-black">Direct Messages</h2>
            <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-black">
              {filteredRooms.length}
            </span>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No conversations yet.
              </div>
            ) : (
              filteredRooms.map((room) => {
                const other = otherProfile(room, user.id);
                const active = selectedRoom?.id === room.id;
                const unread = roomUnreadMap[room.id] || 0;

                return (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`flex w-full gap-3 border-b border-white/10 p-4 text-left transition hover:bg-white/5 ${
                      active ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 font-black text-cyan-300">
                        {avatarLetter(other)}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1020] ${
                          getPresenceOnline(other?.id) ? "bg-green-400" : "bg-gray-500"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-black">{displayName(other)}</p>
                        <p className="shrink-0 text-xs text-gray-500">
                          {formatDate(room.last_message_at || room.created_at)}
                        </p>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-400">
                        {room.last_message || "No messages yet."}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          getPresenceOnline(other?.id)
                            ? "text-green-300"
                            : "text-gray-500"
                        }`}
                      >
                        {getPresenceText(other?.id)}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        {room.order_id && (
                          <span className="text-xs font-bold text-yellow-300">
                            Order #{room.order_id}
                          </span>
                        )}

                        {unread > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[760px] flex-col overflow-hidden rounded-b-3xl border border-t-0 border-white/10 bg-[#070b16] lg:rounded-r-3xl lg:rounded-bl-none lg:border-l-0 lg:border-t">
          {!selectedRoom ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <h2 className="text-3xl font-black">No conversation selected</h2>
                <p className="mt-3 text-gray-400">Select a conversation from inbox.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 bg-[#0b1020] p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                      {avatarLetter(selectedOther)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1020] ${
                        getPresenceOnline(selectedOther?.id) ? "bg-green-400" : "bg-gray-500"
                      }`}
                    />
                  </div>

                  <div>
                    <h2 className="font-black">{displayName(selectedOther)}</h2>
                    <p
                      className={`text-xs ${
                        getPresenceOnline(selectedOther?.id)
                          ? "text-green-300"
                          : "text-gray-400"
                      }`}
                    >
                      {getPresenceText(selectedOther?.id)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedRoom.order_id && (
                    <Link
                      href={`/order/${selectedRoom.order_id}`}
                      className="rounded-full border border-yellow-400 px-4 py-2 text-sm font-black text-yellow-300 hover:bg-yellow-400 hover:text-black"
                    >
                      Order #{selectedRoom.order_id}
                    </Link>
                  )}

                  <Link
                    href="/"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-gray-300 hover:bg-white hover:text-black"
                  >
                    Marketplace
                  </Link>
                </div>
              </div>

              {selectedRoom.product && (
                <div className="border-b border-white/10 bg-cyan-400/5 p-4">
                  <div className="flex flex-col gap-4 rounded-2xl border border-cyan-400/20 bg-black/30 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      {productImage(selectedRoom.product) ? (
                        <img
                          src={productImage(selectedRoom.product)}
                          alt=""
                          className="h-16 w-16 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">
                          🎮
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
                          Product Context
                        </p>
                        <h3 className="font-black">{productTitle(selectedRoom.product)}</h3>
                        <p className="text-sm text-green-300">
                          {formatPrice(productPrice(selectedRoom.product))}
                        </p>
                      </div>
                    </div>

                    {selectedRoom.product_id && (
                      <Link
                        href={`/product/${selectedRoom.product_id}`}
                        className="rounded-full bg-cyan-400 px-5 py-3 text-center font-black text-black hover:bg-cyan-300"
                      >
                        View Product
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    Loading chat...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <h2 className="text-2xl font-black">Start the conversation</h2>
                      <p className="mt-2 text-gray-400">Send a message now.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((message) => {
                      const mine = message.sender_id === user.id;
                      const image = looksLikeImageUrl(message.message);

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-3xl px-5 py-4 shadow-xl ${
                              mine
                                ? "bg-cyan-400 text-black"
                                : "bg-white/10 text-white"
                            }`}
                          >
                            {image ? (
                              <a
                                href={message.message || ""}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-2xl border border-white/20 bg-black/20"
                              >
                                <img
                                  src={message.message || ""}
                                  alt="attachment"
                                  className="max-h-72 w-full object-cover"
                                />
                              </a>
                            ) : (
                              <p className="whitespace-pre-wrap text-sm leading-6">
                                {message.message}
                              </p>
                            )}

                            <p
                              className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${
                                mine ? "text-black/60" : "text-gray-500"
                              }`}
                            >
                              <span>{formatTime(message.created_at)}</span>
                              {mine && (
                                <span
                                  title={message.is_read ? "Read" : "Sent"}
                                  className="font-black"
                                >
                                  {message.is_read ? "✓✓" : "✓"}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#0b1020] p-5">
                {typingUserId && selectedOther && (
                  <div className="mb-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-300">
                    {displayName(selectedOther)} sedang mengetik...
                  </div>
                )}

                {uploadingImage && (
                  <div className="mb-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-300">
                    Uploading image...
                  </div>
                )}

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setQuickMessage("Halo kak, produk masih tersedia?")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Produk tersedia?
                  </button>

                  <button
                    onClick={() =>
                      setQuickMessage("Terima kasih, pesanan akan segera diproses.")
                    }
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Auto reply seller
                  </button>

                  <button
                    onClick={() => setQuickMessage("Saya sudah menyelesaikan pembayaran.")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Payment done
                  </button>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageInput}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage || sending}
                    className="flex w-14 items-center justify-center rounded-2xl border border-white/10 bg-black text-xl font-black text-cyan-300 hover:border-cyan-400 hover:bg-cyan-400 hover:text-black disabled:opacity-50"
                    title="Send image"
                  >
                    {uploadingImage ? "..." : "📎"}
                  </button>

                  <textarea
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type message here..."
                    rows={2}
                    className="min-h-[56px] flex-1 resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
                  />

                  <button
                    onClick={sendMessage}
                    disabled={sending || uploadingImage || !draft.trim()}
                    className="w-24 rounded-2xl bg-cyan-400 font-black text-black hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
