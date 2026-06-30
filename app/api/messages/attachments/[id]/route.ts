import { NextResponse } from "next/server";
import { chatErrorStatus, requireChatRoomAccess } from "@/lib/chatServer";
import {
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    const attachmentId = Number(id || 0);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return NextResponse.json({ error: "Invalid attachment ID." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: attachment, error } = await supabaseAdmin
      .from("chat_attachments")
      .select("id,room_id,file_name,storage_path,mime_type,size_bytes,moderation_status,deleted_at")
      .eq("id", attachmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment || attachment.deleted_at) {
      const notFound = new Error("Attachment not found.");
      Object.assign(notFound, { status: 404 });
      throw notFound;
    }

    await requireChatRoomAccess({
      roomId: String(attachment.room_id),
      userId: user.id,
      allowAdmin: true,
      supabaseAdmin,
    });

    if (String(attachment.moderation_status || "approved") === "removed") {
      const removed = new Error("Attachment was removed by moderation.");
      Object.assign(removed, { status: 404 });
      throw removed;
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("chat-attachments-private")
      .createSignedUrl(String(attachment.storage_path), 120);
    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "Could not create attachment link.");
    }

    return NextResponse.json({
      url: signed.signedUrl,
      expiresIn: 120,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      sizeBytes: Number(attachment.size_bytes || 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected attachment access error.";
    return NextResponse.json({ error: message }, { status: chatErrorStatus(error) });
  }
}
