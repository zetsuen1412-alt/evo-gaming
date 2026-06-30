import { NextResponse } from "next/server";
import { analyzeChatMessage, chatMessagePreview } from "@/lib/chatSafety";
import {
  assertChatUserCanSend,
  chatErrorStatus,
  createChatNotification,
  requireChatRoomAccess,
  safeProfileLabel,
} from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const roomId = String(id || "").trim();
    const body = (await request.json()) as {
      message?: string;
      attachmentId?: number | string;
    };

    const rawMessage = String(body.message || "").trim();
    const attachmentId = Number(body.attachmentId || 0);
    const hasAttachment = Number.isInteger(attachmentId) && attachmentId > 0;

    if (!rawMessage && !hasAttachment) {
      return NextResponse.json(
        { error: "Message text or an attachment is required." },
        { status: 400 }
      );
    }
    if (rawMessage.length > 2000) {
      return NextResponse.json(
        { error: "Message must be 2,000 characters or fewer." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    await assertChatUserCanSend(supabaseAdmin, user.id);
    const { room } = await requireChatRoomAccess({
      roomId,
      userId: user.id,
      supabaseAdmin,
    });

    if (String(room.status || "active").toLowerCase() !== "active") {
      const locked = new Error("This conversation is currently locked.");
      Object.assign(locked, { status: 403 });
      throw locked;
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", since);
    if (countError) throw new Error(countError.message);
    if ((count || 0) >= 20) {
      const limited = new Error("Message rate limit reached. Please wait one minute.");
      Object.assign(limited, { status: 429 });
      throw limited;
    }

    let attachment: Record<string, unknown> | null = null;
    if (hasAttachment) {
      const { data, error } = await supabaseAdmin
        .from("chat_attachments")
        .select("*")
        .eq("id", attachmentId)
        .eq("room_id", roomId)
        .eq("uploaded_by", user.id)
        .is("message_id", null)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Attachment is invalid or already used.");
      if (String(data.moderation_status || "approved") !== "approved") {
        throw new Error("Attachment is not approved for sending.");
      }
      attachment = data as Record<string, unknown>;
    }

    const safety = analyzeChatMessage(rawMessage);
    if (!safety.allowed) {
      const { error: moderationError } = await supabaseAdmin
        .from("chat_moderation_events")
        .insert({
          room_id: roomId,
          user_id: user.id,
          event_type: "blocked_message",
          risk_score: safety.score,
          risk_level: safety.level,
          flags: safety.flags,
          redacted_excerpt: chatMessagePreview(safety.redactedText),
          status: "open",
        });
      if (moderationError) {
        console.error("Blocked chat event insert failed:", moderationError.message);
      }

      return NextResponse.json(
        {
          error: safety.userMessage || "Message blocked by chat safety.",
          code: "CHAT_SAFETY_BLOCKED",
          flags: safety.flags,
        },
        { status: 422 }
      );
    }

    const receiverId = room.buyer_id === user.id ? room.seller_id : room.buyer_id;
    const messageText = rawMessage || (attachment ? "Attachment" : "");
    const moderationStatus = safety.score >= 35 ? "flagged" : "clean";

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: user.id,
        receiver_id: receiverId,
        message: messageText,
        message_type: attachment ? "attachment" : "text",
        attachment_id: attachmentId || null,
        moderation_status: moderationStatus,
        risk_score: safety.score,
        risk_flags: safety.flags,
        is_read: false,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);

    if (attachment) {
      const { error } = await supabaseAdmin
        .from("chat_attachments")
        .update({ message_id: inserted.id })
        .eq("id", attachmentId)
        .is("message_id", null);
      if (error) throw new Error(error.message);
    }

    const preview = attachment
      ? `📎 ${String(attachment.file_name || "Attachment")}`
      : chatMessagePreview(messageText);
    const { error: roomError } = await supabaseAdmin
      .from("chat_rooms")
      .update({
        last_message: preview,
        last_message_at: inserted.created_at,
        last_message_sender_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);
    if (roomError) throw new Error(roomError.message);

    if (moderationStatus === "flagged") {
      const { error } = await supabaseAdmin.from("chat_moderation_events").insert({
        room_id: roomId,
        message_id: inserted.id,
        user_id: user.id,
        event_type: "flagged_message",
        risk_score: safety.score,
        risk_level: safety.level,
        flags: safety.flags,
        redacted_excerpt: chatMessagePreview(safety.redactedText),
        status: "open",
      });
      if (error) console.error("Flagged chat event insert failed:", error.message);
    }

    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("username,full_name,email")
      .eq("id", user.id)
      .maybeSingle();

    await createChatNotification({
      supabaseAdmin,
      receiverId,
      senderName: safeProfileLabel(senderProfile),
      roomId,
      preview,
    });

    return NextResponse.json({
      ok: true,
      message: inserted,
      safety: {
        level: safety.level,
        flags: safety.flags,
        moderated: moderationStatus === "flagged",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected message error.";
    const status = chatErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
