import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ESCROW_RELEASE_DAYS = 3;

type Order = {
  id: number;
  buyer_id: string | null;
  seller_id: string | null;
  status: string | null;
  completed_at: string | null;
  escrow_status: string | null;
  escrow_released_at: string | null;
};

type EscrowReleaseResult = {
  released?: boolean;
  reason?: string;
  amount?: number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function createNotification(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
}) {
  const { supabaseAdmin, userId, type, title, message, linkUrl } = params;

  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link_url: linkUrl,
    is_read: false,
  });

  if (error) {
    console.error("Notification insert error:", error.message);
  }
}

async function handleReleaseEscrow(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized cron request.",
      },
      { status: 401 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const releaseBefore = new Date(
    Date.now() - ESCROW_RELEASE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id,buyer_id,seller_id,status,completed_at,escrow_status,escrow_released_at")
    .in("status", ["Completed", "completed", "Selesai"])
    .or("escrow_status.is.null,escrow_status.neq.released")
    .is("escrow_released_at", null)
    .lte("completed_at", releaseBefore)
    .order("id", { ascending: true })
    .limit(50);

  if (ordersError) {
    return NextResponse.json(
      {
        success: false,
        error: ordersError.message,
      },
      { status: 500 }
    );
  }

  const results: {
    order_id: number;
    released: boolean;
    skipped: boolean;
    reason: string;
    amount?: number;
  }[] = [];

  let released = 0;
  let skipped = 0;
  let totalReleasedAmount = 0;

  for (const order of (orders || []) as Order[]) {
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "release_order_escrow",
        {
          p_order_id: order.id,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = (rpcData || {}) as EscrowReleaseResult;
      const wasReleased = result.released === true;
      const amount = Number(result.amount || 0);
      const reason = result.reason || (wasReleased ? "Released." : "Skipped.");

      results.push({
        order_id: order.id,
        released: wasReleased,
        skipped: !wasReleased,
        reason,
        amount: amount > 0 ? amount : undefined,
      });

      if (wasReleased) {
        released += 1;
        totalReleasedAmount += amount;

        if (order.seller_id) {
          await createNotification({
            supabaseAdmin,
            userId: order.seller_id,
            type: "wallet",
            title: "Escrow Released",
            message: `Payment from completed order #${order.id} has been released to your wallet.`,
            linkUrl: "/wallet",
          });
        }

        if (order.buyer_id) {
          await createNotification({
            supabaseAdmin,
            userId: order.buyer_id,
            type: "order",
            title: "Order Escrow Released",
            message: `Escrow for order #${order.id} has been released to the seller.`,
            linkUrl: `/order/${order.id}`,
          });
        }
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;

      results.push({
        order_id: order.id,
        released: false,
        skipped: true,
        reason: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }

  return NextResponse.json({
    success: true,
    release_days: ESCROW_RELEASE_DAYS,
    scanned: orders?.length || 0,
    released,
    skipped,
    total_released_amount: totalReleasedAmount,
    results,
  });
}

export async function GET(request: Request) {
  return handleReleaseEscrow(request);
}

export async function POST(request: Request) {
  return handleReleaseEscrow(request);
}
