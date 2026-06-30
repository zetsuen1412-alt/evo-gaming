import { NextResponse } from "next/server";
import { chatErrorStatus, requireChatRoomAccess } from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const roomId = String(id || "").trim();
    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { room, role } = await requireChatRoomAccess({
      roomId,
      userId: user.id,
      supabaseAdmin,
    });

    const [messagesResult, profilesResult, productResult, orderResult] =
      await Promise.all([
        supabaseAdmin
          .from("chat_messages")
          .select(
            "id,room_id,sender_id,receiver_id,message,message_type,attachment_id,moderation_status,risk_score,risk_flags,is_read,read_at,created_at,edited_at,deleted_at"
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(300),
        supabaseAdmin
          .from("profiles")
          .select("id,email,username,full_name,avatar_url,role")
          .in("id", [room.buyer_id, room.seller_id]),
        room.product_id
          ? supabaseAdmin
              .from("products")
              .select("id,title,image_url,price,game_name,category,seller_id")
              .eq("id", Number(room.product_id))
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        room.order_id
          ? supabaseAdmin
              .from("orders")
              .select("id,status,payment_status,product_title,created_at")
              .eq("id", Number(room.order_id))
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (messagesResult.error) throw new Error(messagesResult.error.message);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (productResult.error) throw new Error(productResult.error.message);
    if (orderResult.error) throw new Error(orderResult.error.message);

    const messageRows = messagesResult.data || [];
    const attachmentIds = Array.from(
      new Set(
        messageRows
          .map((message) => Number(message.attachment_id || 0))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    );

    const attachmentMap = new Map<number, Record<string, unknown>>();
    if (attachmentIds.length) {
      const { data, error } = await supabaseAdmin
        .from("chat_attachments")
        .select("id,room_id,message_id,file_name,mime_type,size_bytes,moderation_status,created_at,deleted_at")
        .in("id", attachmentIds)
        .eq("room_id", roomId);
      if (error) throw new Error(error.message);
      for (const attachment of data || []) {
        attachmentMap.set(Number(attachment.id), attachment as Record<string, unknown>);
      }
    }

    const profiles = profilesResult.data || [];
    const profileMap = new Map(profiles.map((profile) => [String(profile.id), profile]));
    const otherId = room.buyer_id === user.id ? room.seller_id : room.buyer_id;

    return NextResponse.json({
      room: {
        ...room,
        role,
        other: profileMap.get(otherId) || null,
        me: profileMap.get(user.id) || null,
        product: productResult.data || null,
        order: orderResult.data || null,
      },
      messages: messageRows.map((message) => ({
        ...message,
        message: message.deleted_at
          ? "[Message removed by moderation]"
          : message.message,
        attachment: message.attachment_id
          ? attachmentMap.get(Number(message.attachment_id)) || null
          : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected conversation error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}
