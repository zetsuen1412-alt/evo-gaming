import { NextResponse } from "next/server";
import { chatErrorStatus } from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabaseAdmin = createSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected unread count error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}
