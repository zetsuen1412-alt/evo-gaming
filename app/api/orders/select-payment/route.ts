import { NextResponse } from "next/server";
import {
  authErrorStatus,
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

export const runtime = "nodejs";

type ManualMethod = "qris" | "bank";

export async function POST(request: Request) {
  try {
    const buyer = await requireAuthenticatedUser(request);
    const body = (await request.json()) as {
      orderId?: string | number;
      method?: string;
    };

    const orderId = Number(body.orderId || 0);
    const method = String(body.method || "") as ManualMethod;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    if (!(["qris", "bank"] as string[]).includes(method)) {
      return NextResponse.json(
        { error: "Unsupported manual payment method." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,buyer_id,status,payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    if (order.buyer_id !== buyer.id) {
      return NextResponse.json(
        { error: "You can only update your own order." },
        { status: 403 }
      );
    }

    const status = String(order.status || "").toLowerCase();
    const paymentStatus = String(order.payment_status || "").toLowerCase();

    if (["paid", "delivered", "completed"].includes(status) || paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This order is already paid." },
        { status: 409 }
      );
    }

    const paymentProof =
      method === "qris"
        ? "Waiting QRIS payment confirmation"
        : "Waiting bank transfer confirmation";

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "waiting_payment",
        payment_status: "waiting_confirmation",
        payment_method: method,
        payment_proof: paymentProof,
        escrow_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("buyer_id", buyer.id)
      .select("id,status,payment_status,payment_method,escrow_status")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected payment selection error.";

    return NextResponse.json(
      { error: message },
      { status: authErrorStatus(message) }
    );
  }
}
