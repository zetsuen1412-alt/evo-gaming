import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ESCROW_RELEASE_DAYS = 3;

type Order = {
  id: number;
  buyer_id: string | null;
  buyer: string | null;
  seller_id: string | null;
  product_id: number | null;
  product: string | null;
  price: string | number | null;
  total_price: string | number | null;
  status: string | null;
  completed_at: string | null;
  escrow_status: string | null;
  escrow_released_at: string | null;
  created_at: string | null;
};

type Wallet = {
  id: number;
  user_id: string;
  balance: string | number;
  pending_balance: string | number;
  total_earned: string | number;
  total_spent: string | number;
  total_withdrawn: string | number;
  status: string;
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

function normalizeStatus(status: string | null) {
  if (status === "Selesai") return "Completed";
  if (status === "completed") return "Completed";
  return status || "Pending Payment";
}

function getOrderAmount(order: Order) {
  const amount = Number(order.total_price || order.price || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isReleaseReady(order: Order) {
  const completedAt = order.completed_at || order.created_at;
  if (!completedAt) return false;

  const completedTime = new Date(completedAt).getTime();
  if (!Number.isFinite(completedTime)) return false;

  const releaseTime =
    completedTime + ESCROW_RELEASE_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() >= releaseTime;
}

async function createNotification(params: {
  supabaseAdmin: any;
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

async function getOrCreateWallet(params: {
  supabaseAdmin: any;
  userId: string;
}) {
  const { supabaseAdmin, userId } = params;

  const { data: existingWallet, error: walletLoadError } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletLoadError) {
    throw new Error(walletLoadError.message);
  }

  if (existingWallet) {
    return existingWallet as Wallet;
  }

  const { data: createdWallet, error: walletCreateError } = await supabaseAdmin
    .from("wallets")
    .insert({
      user_id: userId,
      balance: 0,
      pending_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_withdrawn: 0,
      status: "active",
    })
    .select("*")
    .single();

  if (walletCreateError) {
    throw new Error(walletCreateError.message);
  }

  return createdWallet as Wallet;
}

async function releaseEscrowForOrder(params: {
  supabaseAdmin: any;
  order: Order;
}) {
  const { supabaseAdmin, order } = params;

  if (normalizeStatus(order.status) !== "Completed") {
    return {
      released: false,
      skipped: true,
      reason: "Order is not completed.",
    };
  }

  if (!order.seller_id) {
    return {
      released: false,
      skipped: true,
      reason: "Seller ID missing.",
    };
  }

  if (order.escrow_status === "released" || order.escrow_released_at) {
    return {
      released: false,
      skipped: true,
      reason: "Escrow already released.",
    };
  }

  if (order.escrow_status && order.escrow_status !== "pending") {
    return {
      released: false,
      skipped: true,
      reason: `Escrow status is ${order.escrow_status}.`,
    };
  }

  if (!isReleaseReady(order)) {
    return {
      released: false,
      skipped: true,
      reason: "Escrow release date has not passed yet.",
    };
  }

  const amount = getOrderAmount(order);

  if (amount <= 0) {
    return {
      released: false,
      skipped: true,
      reason: "Order amount is invalid.",
    };
  }

  const { count: activeDisputeCount, error: disputeError } = await supabaseAdmin
    .from("disputes")
    .select("*", { count: "exact", head: true })
    .eq("order_id", order.id)
    .in("status", ["open", "investigating"]);

  if (disputeError) {
    throw new Error(disputeError.message);
  }

  if ((activeDisputeCount || 0) > 0) {
    return {
      released: false,
      skipped: true,
      reason: "Order has active dispute.",
    };
  }

  const wallet = await getOrCreateWallet({
    supabaseAdmin,
    userId: order.seller_id,
  });

  if (wallet.status !== "active") {
    return {
      released: false,
      skipped: true,
      reason: "Seller wallet is not active.",
    };
  }

  const balanceBefore = Number(wallet.balance || 0);
  const balanceAfter = balanceBefore + amount;
  const totalEarnedAfter = Number(wallet.total_earned || 0) + amount;

  const { error: walletUpdateError } = await supabaseAdmin
    .from("wallets")
    .update({
      balance: balanceAfter,
      total_earned: totalEarnedAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
    .eq("user_id", order.seller_id);

  if (walletUpdateError) {
    throw new Error(walletUpdateError.message);
  }

  const { error: transactionError } = await supabaseAdmin
    .from("wallet_transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: order.seller_id,
      type: "sale_release",
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      order_id: order.id,
      description: `Escrow released for completed order #${order.id}`,
      status: "completed",
    });

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { error: orderUpdateError } = await supabaseAdmin
    .from("orders")
    .update({
      escrow_status: "released",
      escrow_released_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .is("escrow_released_at", null);

  if (orderUpdateError) {
    throw new Error(orderUpdateError.message);
  }

  await createNotification({
    supabaseAdmin,
    userId: order.seller_id,
    type: "wallet",
    title: "Escrow Released",
    message: `Payment from completed order #${order.id} has been released to your wallet.`,
    linkUrl: "/wallet",
  });

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

  return {
    released: true,
    skipped: false,
    reason: "Released.",
    amount,
  };
}

async function handleReleaseEscrow(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const expectedHeader = `Bearer ${cronSecret}`;

    if (authHeader !== expectedHeader) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized cron request.",
        },
        { status: 401 }
      );
    }
  }

  const supabaseAdmin = getSupabaseAdmin();

  const releaseBefore = new Date(
    Date.now() - ESCROW_RELEASE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select(
      "id,buyer_id,buyer,seller_id,product_id,product,price,total_price,status,completed_at,escrow_status,escrow_released_at,created_at"
    )
    .in("status", ["Completed", "Selesai", "completed"])
    .or("escrow_status.is.null,escrow_status.eq.pending")
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
      const result = await releaseEscrowForOrder({
        supabaseAdmin,
        order,
      });

      results.push({
        order_id: order.id,
        ...result,
      });

      if (result.released) {
        released += 1;
        totalReleasedAmount += result.amount || 0;
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