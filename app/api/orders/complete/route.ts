import { NextResponse } from "next/server";
import {
  authErrorStatus,
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

export async function POST(request: Request) {
  try {
    const buyer = await requireAuthenticatedUser(request);
    const body = (await request.json()) as { orderId?: number | string };
    const orderId = Number(body.orderId || 0);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "complete_order_and_release_escrow_v23",
      {
        p_order_id: orderId,
        p_buyer_id: buyer.id,
      }
    );

    if (rpcError) {
      const message = rpcError.message || "Failed to complete order.";
      const normalized = message.toLowerCase();
      const status = normalized.includes("not found")
        ? 404
        : normalized.includes("only the buyer") || normalized.includes("buyer mismatch")
          ? 403
          : normalized.includes("must be delivered") ||
              normalized.includes("must be paid") ||
              normalized.includes("invalid")
            ? 400
            : 500;

      return NextResponse.json({ error: message }, { status });
    }

    const result = (data || {}) as {
      already_completed?: boolean;
      seller_id?: string;
      seller_earning?: number;
      marketplace_fee?: number;
      seller_sales_tax?: number;
      seller_sales_tax_rate_percent?: number;
      seller_gross?: number;
    };

    if (!result.already_completed && result.seller_id) {
      const sellerEarning = Number(result.seller_earning || 0);
      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert([
          {
            user_id: buyer.id,
            type: "order_completed",
            title: `Order #${orderId} Completed`,
            message: "You confirmed receipt and released the escrow payment.",
            link_url: `/orders/${orderId}`,
            is_read: false,
          },
          {
            user_id: result.seller_id,
            type: "seller_payout_released",
            title: `Payout Released for Order #${orderId}`,
            message:
              Number(result.seller_sales_tax_rate_percent || 0) > 0
                ? `${sellerEarning.toLocaleString(
                    "id-ID"
                  )} IDR has been added after marketplace fee and ${Number(
                    result.seller_sales_tax_rate_percent || 0
                  )}% seller sales tax.`
                : `${sellerEarning.toLocaleString(
                    "id-ID"
                  )} IDR has been added after marketplace fee. This historical paid order keeps the tax treatment captured before the current immutable pricing model.`,
            link_url: "/wallet",
            is_read: false,
          },
        ]);

      if (notificationError) {
        console.error("Order completion notification failed:", notificationError.message);
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected complete order error.";

    return NextResponse.json(
      { error: message },
      { status: authErrorStatus(message) }
    );
  }
}
