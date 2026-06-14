import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ALLOWED_EVENT_TYPES = new Set([
  "offer_view",
  "product_view",
  "checkout_start",
  "payment_success",
  "order_complete",
]);

function nullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = nullableString(body.event_type);

    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid marketplace event type." },
        { status: 400 }
      );
    }

    const payload = {
      event_type: eventType,
      user_id: nullableString(body.user_id),
      session_id: nullableString(body.session_id),
      seller_id: nullableString(body.seller_id),
      product_id: nullableNumber(body.product_id),
      order_id: nullableNumber(body.order_id),
      game_slug: nullableString(body.game_slug),
      game_name: nullableString(body.game_name),
      category_slug: nullableString(body.category_slug),
      category_name: nullableString(body.category_name),
      page_path: nullableString(body.page_path),
      referrer: nullableString(body.referrer),
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };

    const { error } = await supabase.from("marketplace_events").insert(payload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to track marketplace event.",
      },
      { status: 500 }
    );
  }
}
