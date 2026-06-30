import { NextResponse } from "next/server";
import {
  authErrorStatus,
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";
import {
  requireCheckoutAccess,
  runtimeControlErrorCode,
  runtimeControlErrorStatus,
} from "@/lib/runtimeControls";

export async function POST(request: Request) {
  try {
    const buyer = await requireAuthenticatedUser(request);
    const body = (await request.json()) as { orderId?: number | string };
    const orderId = Number(body.orderId || 0);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    await requireCheckoutAccess({ supabaseAdmin, userId: buyer.id });

    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "pay_order_with_wallet",
      {
        p_order_id: orderId,
        p_buyer_id: buyer.id,
      }
    );

    if (rpcError) {
      const message = rpcError.message || "Wallet payment failed.";
      const normalized = message.toLowerCase();
      const status = normalized.includes("not found")
        ? 404
        : normalized.includes("buyer mismatch") || normalized.includes("own order")
          ? 403
          : normalized.includes("insufficient") ||
              normalized.includes("stock") ||
              normalized.includes("invalid")
            ? 400
            : 500;

      return NextResponse.json({ error: message }, { status });
    }

    const result = (data || {}) as {
      already_paid?: boolean;
      seller_id?: string;
      total?: number;
    };

    if (!result.already_paid) {
      const notifications = [
        {
          user_id: buyer.id,
          type: "payment_success",
          title: "Wallet Payment Successful",
          message: `Your payment for Order #${orderId} was completed.`,
          link_url: `/order-success/${orderId}`,
          is_read: false,
        },
      ];

      if (result.seller_id) {
        notifications.push({
          user_id: result.seller_id,
          type: "seller_new_paid_order",
          title: "New Paid Order",
          message: `Order #${orderId} has been paid with ComePlayers Wallet.`,
          link_url: `/orders/${orderId}`,
          is_read: false,
        });
      }

      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Wallet payment notification failed:", notificationError.message);
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected wallet payment error.";

    const runtimeStatus = runtimeControlErrorStatus(error);
    return NextResponse.json(
      { error: message, code: runtimeControlErrorCode(error) },
      { status: runtimeStatus || authErrorStatus(message) }
    );
  }
}
