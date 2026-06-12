"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
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

type ChatRoomView = ChatRoom & {
  buyer?: Profile | null;
  seller?: Profile | null;
  product?: Product | null;
  order?: Order | null;
};

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  is_read: boolean | null;
  created_at: string;
  sender?: Profile | null;
};

type Product = {
  id: number;
  title?: string | null;
  name?: string | null;
  price?: string | number | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  status?: string | null;
};

type Order = {
  id: number;
  status: string | null;
  total_price: string | number | null;
  escrow_status?: string | null;
};

function formatPrice(value: string | number | null | undefined) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return "Rp 0";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

function getAvatarLabel(profile?: Profile | null) {
  const source = profile?.username || profile?.email || "?";
  return source.slice(0, 1).toUpperCase();
}

function getDisplayName(profile?: Profile | null) {
  return profile?.username || profile?.email || "Unknown User";
}

function getOtherProfile(room: ChatRoomView, userId: string) {
  return room.buyer_id === userId ? room.seller : room.buyer;
}

function getOtherUserId(room: ChatRoomView, userId: string) {
  return room.buyer_id === userId ? room.seller_id : room.buyer_id;
}

function getProductTitle(product?: Product | null) {
  return product?.title || product?.name || "Product";
}

function getProductImage(product?: Product | null) {
  return product?.image_url || product?.thumbnail_url || null;
}

function isImageUrl(text: string | null | undefined) {
  if (!text) return false;
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(text.trim());
}

export default function MessagesG2GStylePage() {
  const [user, setUser] = useState<User | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<ChatRoomView[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rooms.filter((room) => {
      if (!query) return true;

      const other = user ? getOtherProfile(room, user.id) : null;

      return (
        String(room.id).toLowerCase().includes(query) ||
        String(room.order_id || "").includes(query) ||
        String(room.product_id || "").includes(query) ||
        (room.last_message || "").toLowerCase().includes(query) ||
        getProductTitle(room.product).toLowerCase().includes(query) ||
        (other?.username || "").toLowerCase().includes(query) ||
        (other?.email || "").toLowerCase().includes(query)
      );
    });
  }, [rooms, search, user]);

  async function hydrateRooms(rawRooms: ChatRoom[]) {
    const profileIds = Array.from(
      new Set(rawRooms.flatMap((room) => [room.buyer_id, room.seller_id]).filter(Boolean))
    );

    const productIds = Array.from(
      new Set(rawRooms.map((room) => room.product_id).filter((id): id is number => Boolean(id)))
    );

    const orderIds = Array.from(
      new Set(rawRooms.map((room) => room.order_id).filter((id): id is number => Boolean(id)))
    );

    const [profilesResult, productsResult, ordersResult] = await Promise.all([
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id,email,username,avatar_url,role")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? supabase
            .from("products")
            .select("id,title,name,price,image_url,thumbnail_url,status")
            .in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from("orders")
            .select("id,status,total_price,escrow_status")
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
      alert(profilesResult.error.message);
      return rawRooms;
    }

    if (productsResult.error) alert(productsResult.error.message);
    if (ordersResult.error) alert(ordersResult.error.message);

    const profiles = new Map(
      ((profilesResult.data || []) as Profile[]).map((profile) => [profile.id, profile])
    );

    const products = new Map(
      ((productsResult.data || []) as Product[]).map((product) => [product.id, product])
    );

    const orders = new Map(
      ((ordersResult.data || []) as Order[]).map((order) => [order.id, order])
    );

    return rawRooms.map((room) => ({
      ...room,
      buyer: profiles.get(room.buyer_id) || null,
      seller: profiles.get(room.seller_id) || null,
      product: room.product_id ? products.get(room.product_id) || null : null,
      order: room.order_id ? orders.get(room.order_id) || null : null,
    }));
  }

  async function loadRooms(currentUser: User) {
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

    const hydrated = (await hydrateRooms((data || []) as ChatRoom[])) as ChatRoomView[];
    setRooms(hydrated);

    if (!selectedRoom && hydrated.length > 0) {
      setSelectedRoom(hydrated[0]);
      await loadMessages(hydrated[0]);
    }
  }

  async function hydrateMessages(rawMessages: ChatMessage[]) {
    const profileIds = Array.from(
      new Set(rawMessages.map((message) => message.sender_id).filter(Boolean))
    );

    if (!profileIds.length) return rawMessages;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,username,avatar_url,role")
      .in("id", profileIds);

    if (error) {
      alert(error.message);
      return rawMessages;
    }

    const profiles = new Map(((data || []) as Profile[]).map((profile) => [profile.id, profile]));

    return rawMessages.map((message) => ({
      ...message,
      sender: profiles.get(message.sender_id) || null,
    }));
  }

  async function loadMessages(room: ChatRoomView) {
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

    const hydrated = (await hydrateMessages((data || []) as ChatMessage[])) as ChatMessage[];
    setMessages(hydrated);

    if (user) {
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("room_id", room.id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);
    }

    setLoadingMessages(false);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function selectRoom(room: ChatRoomView) {
    setSelectedRoom(room);
    await loadMessages(room);
  }

  async function sendMessage() {
    if (!user || !selectedRoom) return;

    const text = draft.trim();
    if (!text) return;

    const receiverId = getOtherUserId(selectedRoom, user.id);

    setSending(true);

    const { error: insertError } = await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      sender_id: user.id,
      receiver_id: receiverId,
      message: text,
      is_read: false,
    });

    if (insertError) {
      alert(insertError.message);
      setSending(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("chat_rooms")
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selectedRoom.id);

    if (updateError) {
      alert(updateError.message);
      setSending(false);
      return;
    }

    setDraft("");
    await loadMessages(selectedRoom);
    await loadRooms(user);
    setSending(false);
  }

  function sendQuickMessage(text: string) {
    setDraft(text);
  }

  useEffect(() => {
    async function initialize() {
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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,username,avatar_url,role")
        .eq("id", userData.user.id)
        .maybeSingle();

      setMyProfile((profileData || null) as Profile | null);
      await loadRooms(userData.user);

      setLoading(false);
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`chat-room-${selectedRoom.id}`)
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
          if (user) await loadRooms(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, user?.id]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>
          <p className="mt-4 text-gray-300">Please login to open your messages.</p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-6 font-black text-black hover:bg-cyan-300"
          >
            Login
          </Link>
        </div>
      </main>
    );
  }

  const selectedOther = selectedRoom ? getOtherProfile(selectedRoom, user.id) : null;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-[#020817] px-4 py-5 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Message Center
            </p>

            <h1 className="mt-4 text-4xl font-black md:text-6xl">Messages</h1>
            <p className="mt-2 text-gray-400">
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

      <section className="mx-auto grid max-w-7xl gap-0 px-4 py-8 md:px-8 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1020] lg:rounded-l-3xl lg:rounded-tr-none">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                {getAvatarLabel(myProfile)}
              </div>

              <div>
                <p className="font-black">{getDisplayName(myProfile)}</p>
                <p className="text-xs text-green-300">● Online</p>
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
                const other = getOtherProfile(room, user.id);
                const active = selectedRoom?.id === room.id;
                const image = getProductImage(room.product);

                return (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`flex w-full gap-3 border-b border-white/10 p-4 text-left transition hover:bg-white/5 ${
                      active ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 font-black text-cyan-300">
                          {getAvatarLabel(other)}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1020] bg-green-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-black">{getDisplayName(other)}</p>
                        <p className="shrink-0 text-xs text-gray-500">
                          {formatDate(room.last_message_at || room.created_at)}
                        </p>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-400">
                        {room.last_message || "No messages yet."}
                      </p>

                      {room.order_id && (
                        <p className="mt-1 text-xs font-bold text-yellow-300">
                          Order #{room.order_id}
                        </p>
                      )}
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
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1020] p-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                      {getAvatarLabel(selectedOther)}
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1020] bg-green-400" />
                  </div>

                  <div>
                    <h2 className="font-black">{getDisplayName(selectedOther)}</h2>
                    <p className="text-xs text-green-300">Online</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
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
                      {getProductImage(selectedRoom.product) ? (
                        <img
                          src={getProductImage(selectedRoom.product) || ""}
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
                        <h3 className="font-black">{getProductTitle(selectedRoom.product)}</h3>
                        <p className="text-sm text-green-300">
                          {formatPrice(selectedRoom.product.price)}
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
                      <p className="mt-2 text-gray-400">
                        Send a message to buyer or seller.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((message) => {
                      const mine = message.sender_id === user.id;
                      const imageMessage = isImageUrl(message.message);

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
                            {imageMessage && (
                              <a
                                href={message.message || ""}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-3 block overflow-hidden rounded-2xl border border-white/20 bg-black/20"
                              >
                                <img
                                  src={message.message || ""}
                                  alt="attachment"
                                  className="max-h-72 w-full object-cover"
                                />
                              </a>
                            )}

                            {!imageMessage && (
                              <p className="whitespace-pre-wrap text-sm leading-6">
                                {message.message}
                              </p>
                            )}

                            <p
                              className={`mt-2 text-right text-[11px] ${
                                mine ? "text-black/60" : "text-gray-500"
                              }`}
                            >
                              {formatTime(message.created_at)}
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
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => sendQuickMessage("Halo kak, produk masih tersedia?")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Produk tersedia?
                  </button>
                  <button
                    onClick={() => sendQuickMessage("Terima kasih, pesanan akan segera diproses.")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Auto reply seller
                  </button>
                  <button
                    onClick={() => sendQuickMessage("Saya sudah menyelesaikan pembayaran.")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Payment done
                  </button>
                  <button
                    onClick={() => sendQuickMessage("https://example.com/payment-proof.png")}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                  >
                    Image URL
                  </button>
                </div>

                <div className="flex gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
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
                    disabled={sending || !draft.trim()}
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
