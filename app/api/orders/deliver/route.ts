import { NextResponse } from "next/server";
import { encryptDelivery } from "@/lib/deliveryCrypto";
import {
  authErrorStatus,
  createSupabaseAdmin,
  requireAuthenticatedUser,
} from "@/lib/serverSupabase";

export const runtime = "nodejs";

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const seller = await requireAuthenticatedUser(request);
    const body = (await request.json()) as {
      orderId?: number | string;
      deliveryMessage?: string;
      deliveryCredentials?: string;
    };

    const orderId = Number(body.orderId || 0);
    const deliveryMessage = String(body.deliveryMessage || "").trim();
    const deliveryCredentials = String(body.deliveryCredentials || "").trim();

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    if (!deliveryMessage && !deliveryCredentials) {
      return NextResponse.json(
        { error: "Enter a delivery message or digital delivery details." },
        { status: 400 }
      );
    }

    if (deliveryMessage.length > 5000 || deliveryCredentials.length > 12000) {
      return NextResponse.json(
        { error: "Delivery details are too long." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id,buyer_id,seller_id,status,payment_status,escrow_status,product_title,product,delivered_at"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    if (order.seller_id !== seller.id) {
      return NextResponse.json(
        { error: "Only this order's seller can deliver it." },
        { status: 403 }
      );
    }

    const status = normalize(order.status);
    const paymentStatus = normalize(order.payment_status);
    const escrowStatus = normalize(order.escrow_status);

    if (status === "completed" || escrowStatus === "released") {
      return NextResponse.json(
        { error: "A completed order can no longer be edited." },
        { status: 409 }
      );
    }

    if (
      status === "cancelled" ||
      status === "disputed" ||
      escrowStatus === "disputed"
    ) {
      return NextResponse.json(
        { error: "This order cannot be delivered in its current state." },
        { status: 409 }
      );
    }

    const paid =
      paymentStatus === "paid" || status === "paid" || status === "delivered";

    if (!paid) {
      return NextResponse.json(
        { error: "Order must be paid before delivery." },
        { status: 400 }
      );
    }

    const encrypted = encryptDelivery(orderId, {
      message: deliveryMessage,
      credentials: deliveryCredentials,
    });

    const { data: deliveryResult, error: deliveryError } = await supabaseAdmin.rpc(
      "cp_store_encrypted_delivery",
      {
        p_order_id: orderId,
        p_seller_id: seller.id,
        p_ciphertext: encrypted.ciphertext,
        p_iv: encrypted.iv,
        p_auth_tag: encrypted.authTag,
        p_key_version: encrypted.keyVersion,
      }
    );

    if (deliveryError) {
      throw new Error(deliveryError.message);
    }

    const result = (deliveryResult || {}) as {
      buyer_id?: string | null;
      product_title?: string | null;
      first_delivery?: boolean;
      [key: string]: unknown;
    };

    if (result.first_delivery && result.buyer_id) {
      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: result.buyer_id,
          type: "order_delivered",
          title: `Order #${orderId} Delivered`,
          message: `The seller delivered ${
            result.product_title || "your digital product"
          }. Review the delivery details before confirming receipt.`,
          link_url: `/orders/${orderId}`,
          is_read: false,
        });

      if (notificationError) {
        console.error(
          "Order delivery notification failed:",
          notificationError.message
        );
      }
    }

    return NextResponse.json({
      ok: true,
      order: result,
      deliveryEncrypted: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected order delivery error.";

    return NextResponse.json(
      { error: message },
      { status: authErrorStatus(message) }
    );
  }
}
