"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  message: string;
  is_read: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  seller_name: string | null;
  avatar_url: string | null;
};

type ProductInfo = {
  id: number;
  title: string | null;
  image_url: string | null;
};

type OrderInfo = {
  id: number;
  product: string | null;
  status: string | null;
  total_price: string | number | null;
  price: string | number | null;
  created_at: string | null;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "Rp 0";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function normalizeStatus(status: string | null | undefined) {
  if (status === "pending") return "Pending Payment";
  if (status === "pending_payment") return "Pending Payment";
  if (status === "Menunggu Pembayaran") return "Pending Payment";
  if (status === "Menunggu Cek Pembayaran") return "Payment Verification";
  if (status === "Diproses") return "Processing";
  if (status === "Selesai") return "Completed";
  if (status === "Dibatalkan") return "Cancelled";
  return status || "Chat";
}

function getDisplayName(profile?: Profile | null) {
  return (
    profile?.seller_name ||
    profile?.username ||
    profile?.email ||
    "Unknown User"
  );
}

function getInitial(profile?: Profile | null) {
  return getDisplayName(profile).charAt(0).toUpperCase();
}

function getRoomContextTitle(
  room: ChatRoom,
  productsById: Record<number, ProductInfo>,
  ordersById: Record<number, OrderInfo>
) {
  if (room.order_id) {
    const order = ordersById[room.order_id];
    return `Order #${room.order_id}${order?.product ? ` · ${order.product}` : ""}`;
  }

  if (room.product_id) {
    const product = productsById[room.product_id];
    return product?.title ? `Product · ${product.title}` : `Product #${room.product_id}`;
  }

  return "General conversation";
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const roomIdFromUrl = searchParams.get("room");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [productsById, setProductsById] = useState<Record<number, ProductInfo>>({});
  const [ordersById, setOrdersById] = useState<Record<number, OrderInfo>>({});

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messageText, setMessageText] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedReceiverId = useMemo(() => {
    if (!user || !selectedRoom) return null;

    return selectedRoom.buyer_id === user.id
      ? selectedRoom.seller_id
      : selectedRoom.buyer_id;
  }, [user, selectedRoom]);

  const selectedReceiverProfile = selectedReceiverId
    ? profiles[selectedReceiverId]
    : null;

  const selectedOrder = selectedRoom?.order_id
    ? ordersById[selectedRoom.order_id]
    : null;

  const selectedProduct = selectedRoom?.product_id
    ? productsById[selectedRoom.product_id]
    : null;

  async function loadProfiles(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueIds.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,username,seller_name,avatar_url")
      .in("id", uniqueIds);

    if (error) {
      console.error("Load profiles error:", error.message);
      return;
    }

    const map: Record<string, Profile> = {};

    (data || []).forEach((profile) => {
      map[profile.id] = profile;
    });

    setProfiles((current) => ({
      ...current,
      ...map,
    }));
  }

  async function loadRoomMetadata(roomData: ChatRoom[]) {
    const productIds = Array.from(
      new Set(roomData.map((room) => room.product_id).filter(Boolean))
    ) as number[];

    const orderIds = Array.from(
      new Set(roomData.map((room) => room.order_id).filter(Boolean))
    ) as number[];

    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,image_url")
        .in("id", productIds);

      if (error) {
        console.error("Load chat product metadata error:", error.message);
      } else {
        const map: Record<number, ProductInfo> = {};
        (data || []).forEach((item) => {
          map[item.id] = item;
        });
        setProductsById((current) => ({ ...current, ...map }));
      }
    }

    if (orderIds.length > 0) {
      const { data, error } = await supabase
        .from("orders")
        .select("id,product,status,total_price,price,created_at")
        .in("id", orderIds);

      if (error) {
        console.error("Load chat order metadata error:", error.message);
      } else {
        const map: Record<number, OrderInfo> = {};
        (data || []).forEach((item) => {
          map[item.id] = item;
        });
        setOrdersById((current) => ({ ...current, ...map }));
      }
    }
  }

  async function loadMessages(room: ChatRoom, currentUser: User) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setMessages(data || []);

    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("room_id", room.id)
      .eq("receiver_id", currentUser.id)
      .eq("is_read", false);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function loadRooms(currentUser: User) {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
      .order("last_message_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const roomData = data || [];
    setRooms(roomData);

    const ids = roomData.flatMap((room) => [room.buyer_id, room.seller_id]);
    await Promise.all([loadProfiles(ids), loadRoomMetadata(roomData)]);

    const roomFromUrl = roomIdFromUrl
      ? roomData.find((room) => room.id === roomIdFromUrl)
      : null;

    const nextSelectedRoom =
      roomFromUrl ||
      (selectedRoom
        ? roomData.find((room) => room.id === selectedRoom.id) || null
        : null) ||
      roomData[0] ||
      null;

    setSelectedRoom(nextSelectedRoom);

    if (nextSelectedRoom) {
      await loadMessages(nextSelectedRoom, currentUser);
    } else {
      setMessages([]);
    }
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
      await loadRooms(userData.user);
      setLoading(false);
    }

    initializePage();
  }, [roomIdFromUrl]);

  useEffect(() => {
    if (!user) return;

    const roomChannel = supabase
      .channel(`chat-rooms-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_rooms",
        },
        () => {
          loadRooms(user);
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`chat-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          if (selectedRoom) {
            loadMessages(selectedRoom, user);
          }
          loadRooms(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user, selectedRoom]);

  async function selectRoom(room: ChatRoom) {
    if (!user) return;

    setSelectedRoom(room);
    await loadMessages(room, user);

    window.history.replaceState(null, "", `/messages?room=${room.id}`);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!user || !selectedRoom || !selectedReceiverId) return;

    const cleanMessage = messageText.trim();

    if (!cleanMessage) return;

    setSending(true);

    const { error: messageError } = await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      sender_id: user.id,
      receiver_id: selectedReceiverId,
      message: cleanMessage,
      is_read: false,
    });

    if (messageError) {
      alert(messageError.message);
      setSending(false);
      return;
    }

    const { error: roomError } = await supabase
      .from("chat_rooms")
      .update({
        last_message: cleanMessage,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selectedRoom.id);

    if (roomError) {
      console.error("Update chat room error:", roomError.message);
    }

    setMessageText("");
    await loadMessages(selectedRoom, user);
    await loadRooms(user);
    setSending(false);
  }

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
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black text-cyan-300">Login Required</h1>

          <p className="mt-4 text-gray-400">
            Please login first to view messages.
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

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              Message Center
            </p>

            <h1 className="text-5xl font-black md:text-7xl">Messages</h1>

            <p className="mt-5 max-w-2xl text-gray-300">
              Chat with buyers and sellers in real time.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-cyan-400 px-6 font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
          >
            Browse Marketplace
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-8 py-10 lg:grid-cols-[380px_1fr]">
        <aside className="h-[720px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-2xl font-black">Inbox</h2>
            <p className="mt-1 text-sm text-gray-400">
              {rooms.length} conversation{rooms.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="h-[640px] overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No conversations yet.
              </div>
            ) : (
              rooms.map((room) => {
                const otherUserId =
                  room.buyer_id === user.id ? room.seller_id : room.buyer_id;
                const otherProfile = profiles[otherUserId];
                const contextTitle = getRoomContextTitle(room, productsById, ordersById);
                const orderInfo = room.order_id ? ordersById[room.order_id] : null;

                return (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`flex w-full gap-4 border-b border-white/10 p-5 text-left transition hover:bg-cyan-400/10 ${
                      selectedRoom?.id === room.id
                        ? "bg-cyan-400/10"
                        : "bg-transparent"
                    }`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
                      {otherProfile?.avatar_url ? (
                        <img
                          src={otherProfile.avatar_url}
                          alt={getDisplayName(otherProfile)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-black text-cyan-300">
                          {getInitial(otherProfile)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-white">
                        {getDisplayName(otherProfile)}
                      </p>

                      <p className="mt-1 truncate text-xs font-black text-cyan-300">
                        {contextTitle}
                      </p>

                      {orderInfo && (
                        <p className="mt-1 text-xs text-yellow-300">
                          {normalizeStatus(orderInfo.status)} · {formatPrice(orderInfo.total_price || orderInfo.price)}
                        </p>
                      )}

                      <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                        {room.last_message || "No messages yet."}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {formatTime(room.last_message_at || room.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex h-[720px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
          {!selectedRoom ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <h2 className="text-3xl font-black">No conversation selected</h2>
                <p className="mt-3 text-gray-400">
                  Select a conversation from inbox.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
                      {selectedReceiverProfile?.avatar_url ? (
                        <img
                          src={selectedReceiverProfile.avatar_url}
                          alt={getDisplayName(selectedReceiverProfile)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-black text-cyan-300">
                          {getInitial(selectedReceiverProfile)}
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl font-black">
                        {getDisplayName(selectedReceiverProfile)}
                      </h2>
                      <p className="text-sm text-gray-400">
                        Real-time conversation
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedRoom.order_id && (
                      <Link
                        href={`/order/${selectedRoom.order_id}`}
                        className="rounded-full border border-yellow-400 px-4 py-2 text-xs font-black text-yellow-300 transition hover:bg-yellow-400 hover:text-black"
                      >
                        View Order #{selectedRoom.order_id}
                      </Link>
                    )}

                    {selectedRoom.product_id && (
                      <Link
                        href={`/product/${selectedRoom.product_id}`}
                        className="rounded-full border border-cyan-400 px-4 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                      >
                        View Product
                      </Link>
                    )}
                  </div>
                </div>

                {(selectedRoom.order_id || selectedRoom.product_id) && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                      Conversation Context
                    </p>

                    <h3 className="mt-2 text-lg font-black text-white">
                      {getRoomContextTitle(selectedRoom, productsById, ordersById)}
                    </h3>

                    {selectedOrder && (
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 font-bold text-yellow-300">
                          {normalizeStatus(selectedOrder.status)}
                        </span>
                        <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 font-bold text-green-300">
                          {formatPrice(selectedOrder.total_price || selectedOrder.price)}
                        </span>
                      </div>
                    )}

                    {!selectedOrder && selectedProduct && (
                      <p className="mt-2 text-sm text-gray-400">
                        Product chat about {selectedProduct.title || `Product #${selectedProduct.id}`}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-gray-400">
                    No messages yet. Say hello.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === user.id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-3xl px-5 py-4 ${
                            isMine
                              ? "bg-cyan-400 text-black"
                              : "bg-black/40 text-white"
                          }`}
                        >
                          <p className="whitespace-pre-line text-sm font-semibold leading-6">
                            {message.message}
                          </p>

                          <p
                            className={`mt-2 text-[11px] ${
                              isMine ? "text-black/60" : "text-gray-500"
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="grid gap-3 border-t border-white/10 p-5 md:grid-cols-[1fr_140px]"
              >
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Type your message..."
                  rows={2}
                  className="resize-none rounded-2xl border border-white/10 bg-black px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />

                <button
                  disabled={sending || !messageText.trim()}
                  className="rounded-2xl bg-cyan-400 px-5 py-4 font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
