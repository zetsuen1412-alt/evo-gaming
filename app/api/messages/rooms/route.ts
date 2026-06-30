import { NextResponse } from "next/server";
import {
  chatErrorStatus,
  requireChatRoomAccess,
  type ChatRoomRow,
} from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

export const runtime = "nodejs";

function numericId(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabaseAdmin = createSupabaseAdmin();

    const { data: rooms, error } = await supabaseAdmin
      .from("chat_rooms")
      .select(
        "id,buyer_id,seller_id,product_id,order_id,room_type,status,last_message,last_message_at,last_message_sender_id,created_at,updated_at"
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const roomRows = (rooms || []) as unknown as ChatRoomRow[];
    const profileIds = Array.from(
      new Set(roomRows.flatMap((room) => [room.buyer_id, room.seller_id]).filter(Boolean))
    );
    const productIds = Array.from(
      new Set(
        roomRows
          .map((room) => Number(room.product_id || 0))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    const orderIds = Array.from(
      new Set(
        roomRows
          .map((room) => Number(room.order_id || 0))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const [profilesResult, productsResult, ordersResult, unreadResult] =
      await Promise.all([
        profileIds.length
          ? supabaseAdmin
              .from("profiles")
              .select("id,email,username,full_name,avatar_url,role")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        productIds.length
          ? supabaseAdmin
              .from("products")
              .select("id,title,image_url,price,game_name,category,seller_id")
              .in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabaseAdmin
              .from("orders")
              .select("id,status,payment_status,product_title,created_at")
              .in("id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        supabaseAdmin
          .from("chat_messages")
          .select("room_id")
          .eq("receiver_id", user.id)
          .eq("is_read", false)
          .is("deleted_at", null),
      ]);

    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (productsResult.error) throw new Error(productsResult.error.message);
    if (ordersResult.error) throw new Error(ordersResult.error.message);
    if (unreadResult.error) throw new Error(unreadResult.error.message);

    const profileMap = new Map(
      (profilesResult.data || []).map((profile) => [String(profile.id), profile])
    );
    const productMap = new Map(
      (productsResult.data || []).map((product) => [Number(product.id), product])
    );
    const orderMap = new Map(
      (ordersResult.data || []).map((order) => [Number(order.id), order])
    );
    const unreadMap = new Map<string, number>();
    for (const row of unreadResult.data || []) {
      const roomId = String(row.room_id || "");
      if (!roomId) continue;
      unreadMap.set(roomId, (unreadMap.get(roomId) || 0) + 1);
    }

    return NextResponse.json({
      rooms: roomRows.map((room) => {
        const otherId = room.buyer_id === user.id ? room.seller_id : room.buyer_id;
        return {
          ...room,
          other: profileMap.get(otherId) || null,
          product: room.product_id
            ? productMap.get(Number(room.product_id)) || null
            : null,
          order: room.order_id
            ? orderMap.get(Number(room.order_id)) || null
            : null,
          unread_count: unreadMap.get(String(room.id)) || 0,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chat room error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as {
      sellerId?: string;
      productId?: number | string;
      orderId?: number | string;
    };

    const sellerId = String(body.sellerId || "").trim() || null;
    const productId = numericId(body.productId);
    const orderId = numericId(body.orderId);

    if (!productId && !orderId) {
      return NextResponse.json(
        { error: "A valid product or order is required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc(
      "cp_get_or_create_chat_room_v12",
      {
        p_actor_id: user.id,
        p_seller_id: sellerId,
        p_product_id: productId,
        p_order_id: orderId,
      }
    );

    if (error) throw new Error(error.message);

    const result = (data || {}) as { room_id?: string };
    const roomId = String(result.room_id || "");
    if (!roomId) throw new Error("Chat room creation returned no room ID.");

    const access = await requireChatRoomAccess({
      roomId,
      userId: user.id,
      supabaseAdmin,
    });

    return NextResponse.json({ ok: true, room: access.room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected room creation error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}
