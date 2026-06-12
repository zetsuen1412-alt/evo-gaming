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

type Conversation = {
  id: number;
  buyer_id: string;
  seller_id: string;
  product_id: number | null;
  order_id: number | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  buyer?: Profile | null;
  seller?: Profile | null;
  product?: Product | null;
  order?: Order | null;
};

type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  message: string | null;
  message_type: string | null;
  attachment_url: string | null;
  created_at: string;
  sender?: Profile | null;
};

type Product = {
  id: number;
  title: string | null;
  price: string | number | null;
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

function getOtherProfile(conversation: Conversation, userId: string) {
  return conversation.buyer_id === userId ? conversation.seller : conversation.buyer;
}

function getProductImage(product?: Product | null) {
  return product?.image_url || product?.thumbnail_url || null;
}

export default function MessagesG2GStylePage() {
  const [user, setUser] = useState<User | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (!query) return true;

      const other = user ? getOtherProfile(conversation, user.id) : null;

      return (
        String(conversation.id).includes(query) ||
        String(conversation.order_id || "").includes(query) ||
        String(conversation.product_id || "").includes(query) ||
        (conversation.last_message || "").toLowerCase().includes(query) ||
        (conversation.product?.title || "").toLowerCase().includes(query) ||
        (other?.username || "").toLowerCase().includes(query) ||
        (other?.email || "").toLowerCase().includes(query)
      );
    });
  }, [conversations, search, user]);

  async function loadConversations(currentUser: User) {
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select(
        `
        *,
        buyer:buyer_id(id,email,username,avatar_url,role),
        seller:seller_id(id,email,username,avatar_url,role),
        product:product_id(id,title,price,image_url,thumbnail_url,status),
        order:order_id(id,status,total_price,escrow_status)
      `
      )
      .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (conversationError) {
      alert(conversationError.message);
      return;
    }

    const loaded = (conversationData || []) as Conversation[];
    setConversations(loaded);

    if (!selectedConversation && loaded.length > 0) {
      setSelectedConversation(loaded[0]);
      await loadMessages(loaded[0].id);
    }
  }

  async function loadMessages(conversationId: number) {
    setLoadingMessages(true);

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:sender_id(id,email,username,avatar_url,role)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messageError) {
      alert(messageError.message);
      setLoadingMessages(false);
      return;
    }

    setMessages((messageData || []) as Message[]);
    setLoadingMessages(false);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function selectConversation(conversation: Conversation) {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
  }

  async function sendMessage() {
    if (!user || !selectedConversation) return;

    const messageText = draft.trim();
    const imageUrl = attachmentUrl.trim();

    if (!messageText && !imageUrl) return;

    setSending(true);

    const messageType = imageUrl ? "image" : "text";
    const finalMessage = messageText || "Sent an attachment.";

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      message: finalMessage,
      message_type: messageType,
      attachment_url: imageUrl || null,
    });

    if (insertError) {
      alert(insertError.message);
      setSending(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        last_message: finalMessage,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      alert(updateError.message);
      setSending(false);
      return;
    }

    setDraft("");
    setAttachmentUrl("");
    await loadMessages(selectedConversation.id);
    await loadConversations(user);
    setSending(false);
  }

  async function sendQuickMessage(text: string) {
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
      await loadConversations(userData.user);

      setLoading(false);
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`conversation-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        async () => {
          await loadMessages(selectedConversation.id);
          if (user) await loadConversations(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id, user?.id]);

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

  const selectedOther = selectedConversation
    ? getOtherProfile(selectedConversation, user.id)
    : null;

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
              {filteredConversations.length}
            </span>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No conversations yet.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const other = getOtherProfile(conversation, user.id);
                const active = selectedConversation?.id === conversation.id;
                const image = getProductImage(conversation.product);

                return (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation)}
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
                          {formatDate(conversation.last_message_at || conversation.created_at)}
                        </p>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-400">
                        {conversation.last_message || "No messages yet."}
                      </p>

                      {conversation.order_id && (
                        <p className="mt-1 text-xs font-bold text-yellow-300">
                          Order #{conversation.order_id}
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
          {!selectedConversation ? (
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
                  {selectedConversation.order_id && (
                    <Link
                      href={`/order/${selectedConversation.order_id}`}
                      className="rounded-full border border-yellow-400 px-4 py-2 text-sm font-black text-yellow-300 hover:bg-yellow-400 hover:text-black"
                    >
                      Order #{selectedConversation.order_id}
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

              {selectedConversation.product && (
                <div className="border-b border-white/10 bg-cyan-400/5 p-4">
                  <div className="flex flex-col gap-4 rounded-2xl border border-cyan-400/20 bg-black/30 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      {getProductImage(selectedConversation.product) ? (
                        <img
                          src={getProductImage(selectedConversation.product) || ""}
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
                        <h3 className="font-black">
                          {selectedConversation.product.title || "Product"}
                        </h3>
                        <p className="text-sm text-green-300">
                          {formatPrice(selectedConversation.product.price)}
                        </p>
                      </div>
                    </div>

                    {selectedConversation.product_id && (
                      <Link
                        href={`/product/${selectedConversation.product_id}`}
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

                      if (message.message_type === "system") {
                        return (
                          <div key={message.id} className="text-center">
                            <span className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-black text-yellow-300">
                              {message.message}
                            </span>
                          </div>
                        );
                      }

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
                            {message.attachment_url && (
                              <a
                                href={message.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-3 block overflow-hidden rounded-2xl border border-white/20 bg-black/20"
                              >
                                <img
                                  src={message.attachment_url}
                                  alt="attachment"
                                  className="max-h-72 w-full object-cover"
                                />
                              </a>
                            )}

                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {message.message}
                            </p>

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
                </div>

                <input
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  placeholder="Optional image URL / attachment URL..."
                  className="mb-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
                />

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
                    disabled={sending || (!draft.trim() && !attachmentUrl.trim())}
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
