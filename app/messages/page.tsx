"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaExclamationTriangle,
  FaFilePdf,
  FaFlag,
  FaLock,
  FaPaperclip,
  FaShieldAlt,
} from "react-icons/fa";
import { useCurrency } from "@/components/CurrencyProvider";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type Product = {
  id: number;
  title?: string | null;
  image_url?: string | null;
  price?: string | number | null;
  game_name?: string | null;
  category?: string | null;
};

type OrderSummary = {
  id: number;
  status?: string | null;
  payment_status?: string | null;
  product_title?: string | null;
  created_at?: string | null;
};

type Room = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id?: number | null;
  order_id?: number | null;
  room_type?: string | null;
  status?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  unread_count: number;
  other: Profile | null;
  product: Product | null;
  order: OrderSummary | null;
};

type Attachment = {
  id: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  moderation_status?: string | null;
  deleted_at?: string | null;
};

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  message_type?: string | null;
  attachment_id?: number | null;
  moderation_status?: string | null;
  risk_score?: number | null;
  risk_flags?: string[] | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at: string;
  deleted_at?: string | null;
  attachment?: Attachment | null;
};

type ConversationResponse = {
  room: Room & { me?: Profile | null; role?: string | null };
  messages: Message[];
};

function displayName(profile?: Profile | null) {
  return profile?.username || profile?.full_name || profile?.email || "ComePlayers User";
}

function initial(profile?: Profile | null) {
  return displayName(profile).slice(0, 1).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSize(value?: number | null) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentViewer({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reveal() {
    setLoading(true);
    setError("");
    try {
      const data = await authenticatedFetchJson<{ url: string }>(
        `/api/messages/attachments/${attachment.id}`
      );
      setUrl(data.url);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not open attachment.");
    } finally {
      setLoading(false);
    }
  }

  const isImage = attachment.mime_type.startsWith("image/");

  return (
    <div className="rounded-2xl border border-white/15 bg-black/20 p-3">
      {url && isImage ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.file_name}
            className="max-h-72 w-full rounded-xl object-contain"
          />
        </a>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl">
            {attachment.mime_type === "application/pdf" ? <FaFilePdf /> : <FaPaperclip />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{attachment.file_name}</p>
            <p className="text-xs opacity-60">{formatSize(attachment.size_bytes)}</p>
          </div>
        </div>
      )}

      <button
        onClick={reveal}
        disabled={loading}
        className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs font-black hover:bg-white hover:text-black disabled:opacity-50"
      >
        {loading ? "Opening..." : url ? "Refresh secure link" : "Open secure attachment"}
      </button>
      {url && !isImage ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-2 inline-flex rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-black"
        >
          View file
        </a>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export default function MessagesPage() {
  const { formatPrice } = useCurrency();
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initializedQueryRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || conversation?.room || null,
    [rooms, selectedRoomId, conversation]
  );

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) =>
      [
        displayName(room.other),
        room.last_message || "",
        room.product?.title || "",
        String(room.order_id || ""),
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [rooms, search]);

  async function loadRooms(preferredRoomId?: string) {
    const data = await authenticatedFetchJson<{ rooms: Room[] }>("/api/messages/rooms");
    setRooms(data.rooms || []);
    const nextId =
      preferredRoomId ||
      selectedRoomId ||
      data.rooms?.[0]?.id ||
      "";
    if (nextId) setSelectedRoomId(nextId);
    return data.rooms || [];
  }

  async function loadConversation(roomId: string, silent = false) {
    if (!roomId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const data = await authenticatedFetchJson<ConversationResponse>(
        `/api/messages/rooms/${roomId}`
      );
      setConversation(data);
      await authenticatedFetchJson(`/api/messages/rooms/${roomId}/read`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setRooms((current) =>
        current.map((room) => (room.id === roomId ? { ...room, unread_count: 0 } : room))
      );
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load conversation.");
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  async function createRoomFromQuery() {
    if (initializedQueryRef.current) return "";
    initializedQueryRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const directRoom = params.get("room") || "";
    if (directRoom) return directRoom;

    const sellerId = params.get("seller") || "";
    const productId = Number(params.get("product") || 0);
    const orderId = Number(params.get("order") || 0);
    if (!productId && !orderId) return "";

    const data = await authenticatedFetchJson<{ room: { id: string } }>(
      "/api/messages/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          sellerId: sellerId || undefined,
          productId: productId || undefined,
          orderId: orderId || undefined,
        }),
      }
    );
    return String(data.room?.id || "");
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) {
          window.location.replace("/");
          return;
        }
        if (!active) return;
        setUserId(data.user.id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,email,username,full_name,avatar_url,role")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!active) return;
        setProfile((profileData || null) as Profile | null);

        const queryRoomId = await createRoomFromQuery();
        const roomList = await loadRooms(queryRoomId);
        const initialRoomId = queryRoomId || roomList[0]?.id || "";
        if (initialRoomId) {
          setSelectedRoomId(initialRoomId);
          await loadConversation(initialRoomId);
        }
      } catch (initError) {
        setError(initError instanceof Error ? initError.message : "Failed to initialize messages.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoomId || loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversation(selectedRoomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(async () => {
      try {
        await loadRooms(selectedRoomId);
        if (selectedRoomId) await loadConversation(selectedRoomId, true);
      } catch {
        // Polling is only a fallback; foreground actions still show errors.
      }
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || !userId) return;
    const channel = supabase
      .channel(`protected-chat-${selectedRoomId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${selectedRoomId}`,
        },
        () => {
          void loadConversation(selectedRoomId, true);
          void loadRooms(selectedRoomId);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  async function sendMessage(attachmentId?: number) {
    if (!selectedRoomId || (!draft.trim() && !attachmentId)) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      await authenticatedFetchJson(`/api/messages/rooms/${selectedRoomId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: draft.trim(), attachmentId }),
      });
      setDraft("");
      await Promise.all([loadConversation(selectedRoomId, true), loadRooms(selectedRoomId)]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!selectedRoomId) return;
    setUploading(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please login again before uploading.");
      }
      const formData = new FormData();
      formData.set("roomId", selectedRoomId);
      formData.set("file", file);
      const response = await fetch("/api/messages/attachments", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        attachment?: { id: number };
      };
      if (!response.ok || !payload.attachment?.id) {
        throw new Error(payload.error || "Attachment upload failed.");
      }
      await sendMessage(payload.attachment.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Attachment upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function reportMessage(message: Message) {
    const reason = window.prompt(
      "Report reason: scam, off_platform_payment, external_contact, harassment, spam, suspicious_attachment, or other",
      "scam"
    );
    if (!reason) return;
    const details = window.prompt("Optional details for the moderator", "") || "";
    try {
      await authenticatedFetchJson("/api/messages/reports", {
        method: "POST",
        body: JSON.stringify({ messageId: message.id, reason, details }),
      });
      setNotice("Message reported to ComePlayers moderation.");
      await loadConversation(selectedRoomId, true);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Report failed.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-xl font-black text-cyan-300">Loading protected messages...</p>
      </main>
    );
  }

  const roomLocked = String(selectedRoom?.status || "active").toLowerCase() !== "active";

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 px-6 py-9">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-300">
              <FaShieldAlt /> Protected Message Center
            </p>
            <h1 className="mt-4 text-5xl font-black">Messages</h1>
            <p className="mt-3 max-w-2xl text-gray-400">
              Keep payments, contact, and delivery inside ComePlayers. External links, contact details, and credentials are blocked automatically.
            </p>
          </div>
          <Link
            href="/resolution-center"
            className="inline-flex h-12 items-center justify-center rounded-full border border-orange-400 px-6 font-black text-orange-300 hover:bg-orange-400 hover:text-black"
          >
            Resolution Center
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 px-6 py-8 lg:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1020] lg:rounded-l-3xl lg:rounded-tr-none">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                {initial(profile)}
              </div>
              <div>
                <p className="font-black">{displayName(profile)}</p>
                <p className="text-xs font-bold text-cyan-300">Protected by anti-scam filters</p>
              </div>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, product, or order"
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
            />
          </div>

          <div className="max-h-[690px] overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No conversations yet. Open a product and select Chat Seller.
              </div>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`flex w-full gap-3 border-b border-white/10 p-4 text-left transition hover:bg-white/5 ${
                    selectedRoomId === room.id ? "bg-white/10" : ""
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 font-black text-cyan-300">
                    {initial(room.other)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-black">{displayName(room.other)}</p>
                      <p className="shrink-0 text-[11px] text-gray-500">
                        {formatDate(room.last_message_at || room.created_at)}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-400">
                      {room.last_message || "Conversation created"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {room.order_id ? (
                        <span className="text-xs font-bold text-yellow-300">Order #{room.order_id}</span>
                      ) : null}
                      {room.unread_count > 0 ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black">
                          {room.unread_count}
                        </span>
                      ) : null}
                      {room.status === "locked" ? (
                        <span className="text-xs text-red-300">Locked</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-[790px] flex-col overflow-hidden rounded-b-3xl border border-t-0 border-white/10 bg-[#070b16] lg:rounded-r-3xl lg:rounded-bl-none lg:border-l-0 lg:border-t">
          {!selectedRoom ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <FaLock className="mx-auto text-4xl text-cyan-300" />
                <h2 className="mt-4 text-3xl font-black">Select a conversation</h2>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 bg-[#0b1020] p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 font-black text-black">
                      {initial(selectedRoom.other)}
                    </div>
                    <div>
                      <h2 className="font-black">{displayName(selectedRoom.other)}</h2>
                      <p className="text-xs text-cyan-300">
                        {selectedRoom.order_id ? `Order #${selectedRoom.order_id}` : "Pre-sale product chat"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoom.order_id ? (
                      <Link
                        href={`/orders/${selectedRoom.order_id}`}
                        className="rounded-full border border-yellow-400 px-4 py-2 text-sm font-black text-yellow-300 hover:bg-yellow-400 hover:text-black"
                      >
                        Open Order
                      </Link>
                    ) : null}
                    {selectedRoom.product_id ? (
                      <Link
                        href={`/product/${selectedRoom.product_id}`}
                        className="rounded-full border border-cyan-400 px-4 py-2 text-sm font-black text-cyan-300 hover:bg-cyan-400 hover:text-black"
                      >
                        View Product
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              {selectedRoom.product ? (
                <div className="border-b border-white/10 bg-cyan-400/5 p-4">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-400/20 bg-black/30 p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-cyan-300">Product Context</p>
                      <p className="truncate font-black">{selectedRoom.product.title || "Product"}</p>
                    </div>
                    <p className="shrink-0 font-black text-green-300">
                      {formatPrice(selectedRoom.product.price || 0)}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="border-b border-yellow-400/20 bg-yellow-400/10 px-5 py-3 text-sm text-yellow-100">
                <strong>Safety:</strong> Never move payment outside ComePlayers. Sellers must send account credentials through the encrypted delivery form on the order page, not chat.
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-gray-400">Loading chat...</div>
                ) : conversation?.messages?.length ? (
                  <div className="space-y-5">
                    {conversation.messages.map((message) => {
                      const mine = message.sender_id === userId;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`group max-w-[82%] ${mine ? "text-right" : "text-left"}`}>
                            <div
                              className={`rounded-3xl px-5 py-4 shadow-xl ${
                                mine ? "bg-cyan-400 text-black" : "bg-white/10 text-white"
                              } ${message.deleted_at ? "opacity-60" : ""}`}
                            >
                              {message.message ? (
                                <p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                              ) : null}
                              {message.attachment ? (
                                <div className="mt-3">
                                  <AttachmentViewer attachment={message.attachment} />
                                </div>
                              ) : null}
                              <div className={`mt-2 flex items-center gap-2 text-[11px] ${mine ? "justify-end text-black/60" : "text-gray-500"}`}>
                                <span>{formatDate(message.created_at)}</span>
                                {mine ? <span>{message.is_read ? "✓✓" : "✓"}</span> : null}
                                {message.moderation_status === "reported" ? <span>Reported</span> : null}
                              </div>
                            </div>
                            {!mine && !message.deleted_at ? (
                              <button
                                onClick={() => reportMessage(message)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                              >
                                <FaFlag /> Report
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <FaShieldAlt className="mx-auto text-4xl text-cyan-300" />
                      <h2 className="mt-4 text-2xl font-black">Start a protected conversation</h2>
                      <p className="mt-2 text-gray-400">Ask about the product without sharing external contact details.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#0b1020] p-5">
                {notice ? (
                  <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                    {notice}
                  </div>
                ) : null}
                {error ? (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
                    <FaExclamationTriangle className="mt-0.5 shrink-0" /> {error}
                  </div>
                ) : null}

                {roomLocked ? (
                  <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-center font-black text-red-200">
                    This conversation is locked by moderation.
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {["Is this product still available?", "What is the delivery estimate?", "I have completed payment through ComePlayers."].map((text) => (
                        <button
                          key={text}
                          onClick={() => setDraft(text)}
                          className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white hover:text-black"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAttachment(file);
                      }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploading}
                        className="flex w-14 items-center justify-center rounded-2xl border border-white/10 bg-black text-cyan-300 hover:border-cyan-400 disabled:opacity-50"
                        title="Upload private image or PDF"
                      >
                        <FaPaperclip />
                      </button>
                      <textarea
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        rows={2}
                        maxLength={2000}
                        placeholder="Type a message. External contacts, links, and credentials are blocked."
                        className="min-h-[56px] flex-1 resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
                      />
                      <button
                        onClick={() => void sendMessage()}
                        disabled={sending || uploading || !draft.trim()}
                        className="w-24 rounded-2xl bg-cyan-400 font-black text-black hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {sending || uploading ? "..." : "Send"}
                      </button>
                    </div>
                    <p className="mt-2 text-right text-xs text-gray-500">{draft.length}/2000</p>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
