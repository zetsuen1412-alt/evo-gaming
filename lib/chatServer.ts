import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/serverSupabase";

export type ChatRoomRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: number | null;
  order_id: number | null;
  room_type?: string | null;
  status?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_sender_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ChatAccess = {
  room: ChatRoomRow;
  role: "buyer" | "seller" | "admin";
};

export async function isAdminUser(
  supabaseAdmin: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.role || "").trim().toLowerCase() === "admin";
}

export async function requireChatRoomAccess(input: {
  roomId: string;
  userId: string;
  allowAdmin?: boolean;
  supabaseAdmin?: SupabaseClient;
}): Promise<ChatAccess> {
  const supabaseAdmin = input.supabaseAdmin || createSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("chat_rooms")
    .select(
      "id,buyer_id,seller_id,product_id,order_id,room_type,status,last_message,last_message_at,last_message_sender_id,created_at,updated_at"
    )
    .eq("id", input.roomId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const notFound = new Error("Chat room not found.");
    Object.assign(notFound, { status: 404 });
    throw notFound;
  }

  const room = data as unknown as ChatRoomRow;
  if (room.buyer_id === input.userId) return { room, role: "buyer" };
  if (room.seller_id === input.userId) return { room, role: "seller" };

  if (input.allowAdmin && (await isAdminUser(supabaseAdmin, input.userId))) {
    return { room, role: "admin" };
  }

  const forbidden = new Error("You are not allowed to access this conversation.");
  Object.assign(forbidden, { status: 403 });
  throw forbidden;
}

export function chatErrorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: number }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }

  const message = error instanceof Error ? error.message : "";
  if (/authentication|token|login/i.test(message)) return 401;
  if (/not allowed|forbidden|admin access/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/required|invalid|unsupported|too large|blocked|suspended|limit|empty|between|cannot/i.test(message)) {
    return 400;
  }
  return 500;
}

export async function assertChatUserCanSend(
  supabaseAdmin: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from("user_account_settings")
    .select("chat_suspended_until,chat_suspension_reason")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !/column .* does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }

  const suspendedUntil = data?.chat_suspended_until
    ? new Date(String(data.chat_suspended_until))
    : null;
  if (suspendedUntil && suspendedUntil.getTime() > Date.now()) {
    const suspensionError = new Error(
      `Chat access is suspended until ${suspendedUntil.toISOString()}${
        data?.chat_suspension_reason ? `: ${data.chat_suspension_reason}` : "."
      }`
    );
    Object.assign(suspensionError, { status: 403 });
    throw suspensionError;
  }
}

export async function createChatNotification(input: {
  supabaseAdmin: SupabaseClient;
  receiverId: string;
  senderName: string;
  roomId: string;
  preview: string;
}) {
  const { error } = await input.supabaseAdmin.from("notifications").insert({
    user_id: input.receiverId,
    type: "chat_message",
    title: `New message from ${input.senderName}`,
    message: input.preview || "Sent you a message.",
    link_url: `/messages?room=${input.roomId}`,
    is_read: false,
  });

  if (error) {
    console.error("Chat notification insert failed:", error.message);
  }
}

export function safeProfileLabel(profile: Record<string, unknown> | null | undefined) {
  return String(
    profile?.username || profile?.full_name || profile?.email || "ComePlayers user"
  );
}
