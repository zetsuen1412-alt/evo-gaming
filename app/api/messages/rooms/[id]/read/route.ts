import { NextResponse } from "next/server";
import { chatErrorStatus, requireChatRoomAccess } from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const roomId = String(id || "").trim();
    const supabaseAdmin = createSupabaseAdmin();

    await requireChatRoomAccess({ roomId, userId: user.id, supabaseAdmin });

    const { error } = await supabaseAdmin
      .from("chat_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected read receipt error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}
