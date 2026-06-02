import { supabase } from "@/lib/supabase";

type CreateNotificationParams = {
  userId: string | null | undefined;
  type: string;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
};

export async function createNotification({
  userId,
  type,
  title,
  message = null,
  linkUrl = null,
}: CreateNotificationParams) {
  if (!userId) {
    return {
      success: false,
      error: "Missing userId",
    };
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link_url: linkUrl,
    is_read: false,
  });

  if (error) {
    console.error("Create notification error:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    error: null,
  };
}