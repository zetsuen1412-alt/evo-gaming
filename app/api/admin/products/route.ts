import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  recordAdminAudit,
  requireAdmin,
} from "@/lib/adminSecurity";

const allowedStatuses = new Set(["active", "hidden", "pending", "rejected"]);

export async function PATCH(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as {
      productId?: number | string;
      status?: string;
    };

    const productId = Number(body.productId || 0);
    const status = String(body.status || "").trim().toLowerCase();

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid product status." }, { status: 400 });
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (beforeError) throw new Error(beforeError.message);
    if (!before) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const { data: after, error: updateError } = await supabaseAdmin
      .from("products")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);

    await recordAdminAudit({
      adminId: user.id,
      action: "product.status.update",
      entityType: "product",
      entityId: productId,
      beforeData: before,
      afterData: after,
    });

    return NextResponse.json({ ok: true, product: after });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected product update error.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as { productId?: number | string };
    const productId = Number(body.productId || 0);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (beforeError) throw new Error(beforeError.message);
    if (!before) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", productId);

    if (deleteError) throw new Error(deleteError.message);

    await recordAdminAudit({
      adminId: user.id,
      action: "product.delete",
      entityType: "product",
      entityId: productId,
      beforeData: before,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected product delete error.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}
