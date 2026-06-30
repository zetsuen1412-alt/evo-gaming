import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdmin,
  createSupabaseAuthClient,
  getBearerToken,
} from "@/lib/serverSupabase";

const ALLOWED_EVENT_TYPES = new Set([
  "offer_view",
  "product_view",
  "checkout_start",
  "payment_success",
  "order_complete",
]);

function nullableString(value: unknown, maxLength = 250) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function authenticatedUserId(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createSupabaseAuthClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = nullableString(body.event_type, 50);

    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid marketplace event type." },
        { status: 400 }
      );
    }

    const metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (JSON.stringify(metadata).length > 5000) {
      return NextResponse.json(
        { ok: false, error: "Marketplace event metadata is too large." },
        { status: 400 }
      );
    }

    // Never trust a user_id sent by the browser. Resolve it from a valid
    // Supabase access token or store the event as anonymous.
    const userId = await authenticatedUserId(request);

    const payload = {
      event_type: eventType,
      user_id: userId,
      session_id: nullableString(body.session_id, 100),
      seller_id: nullableString(body.seller_id, 100),
      product_id: nullableNumber(body.product_id),
      order_id: nullableNumber(body.order_id),
      game_slug: nullableString(body.game_slug, 150),
      game_name: nullableString(body.game_name, 200),
      category_slug: nullableString(body.category_slug, 150),
      category_name: nullableString(body.category_name, 200),
      page_path: nullableString(body.page_path, 500),
      referrer: nullableString(body.referrer, 500),
      metadata,
    };

    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("marketplace_events")
      .insert(payload);

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
        error:
          error instanceof Error
            ? error.message
            : "Failed to track marketplace event.",
      },
      { status: 500 }
    );
  }
}
