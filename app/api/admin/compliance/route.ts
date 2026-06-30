import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  recordAdminAudit,
  requireAdmin,
} from "@/lib/adminSecurity";
import { calculateCommerceMetrics } from "@/lib/commerceMetrics";
import { generateProviderSettlementReport } from "@/lib/providerSettlementServer";

function clean(value: unknown, length = 1000) {
  return String(value ?? "").trim().slice(0, length);
}

function parseTimestamp(value: unknown, label: string, fallback?: string) {
  const raw = clean(value, 80) || fallback || "";
  const timestamp = new Date(raw).getTime();
  if (!raw || !Number.isFinite(timestamp)) throw new Error(`${label} is invalid.`);
  return new Date(timestamp).toISOString();
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireAdmin(request);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [sellerTaxSettings, withdrawalTaxRates, policyReviews, privacyRequests, settlements, feedback, orders, withdrawals] = await Promise.all([
      supabaseAdmin.from("seller_tax_settings").select("*").eq("setting_key", "global_seller_sales_tax").maybeSingle(),
      supabaseAdmin.from("withdrawal_tax_rates").select("*").order("country_code").order("payout_method").order("valid_from", { ascending: false }).limit(500),
      supabaseAdmin.from("product_policy_reviews").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("privacy_requests").select("*").order("requested_at", { ascending: false }).limit(200),
      supabaseAdmin.from("provider_settlement_reports").select("*").order("period_end", { ascending: false }).limit(50),
      supabaseAdmin.from("risk_feedback_events").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin
        .from("orders")
        .select("status,payment_status,total_amount,total_price,seller_gross_amount,seller_sales_tax_amount,marketplace_fee_amount,created_at,paid_at,delivered_at,completed_at,delivery_due_at")
        .gte("created_at", since)
        .limit(10000),
      supabaseAdmin
        .from("withdrawal_requests")
        .select("status,amount,tax_amount,fee_amount,net_amount,paid_at")
        .gte("created_at", since)
        .limit(10000),
    ]);
    const firstError = [sellerTaxSettings.error, withdrawalTaxRates.error, policyReviews.error, privacyRequests.error, settlements.error, feedback.error, orders.error, withdrawals.error].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const productIds = Array.from(new Set((policyReviews.data || []).map((row) => Number(row.product_id || 0)).filter(Boolean)));
    const sellerIds = Array.from(new Set((policyReviews.data || []).map((row) => String(row.seller_id || "")).filter(Boolean)));
    const [productsResult, profilesResult] = await Promise.all([
      productIds.length
        ? supabaseAdmin.from("products").select("id,title,status,policy_status,seller_id").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      sellerIds.length
        ? supabaseAdmin.from("profiles").select("id,email,username,seller_name").in("id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsResult.error) throw new Error(productsResult.error.message);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    const products = new Map((productsResult.data || []).map((row) => [Number(row.id), row]));
    const profiles = new Map((profilesResult.data || []).map((row) => [String(row.id), row]));

    return NextResponse.json({
      sellerTaxSettings: sellerTaxSettings.data || null,
      withdrawalTaxRates: withdrawalTaxRates.data || [],
      policyReviews: (policyReviews.data || []).map((row) => ({
        ...row,
        product: products.get(Number(row.product_id)) || null,
        seller: profiles.get(String(row.seller_id)) || null,
      })),
      privacyRequests: privacyRequests.data || [],
      settlements: settlements.data || [],
      riskFeedback: feedback.data || [],
      metrics: calculateCommerceMetrics(orders.data || [], withdrawals.data || []),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load compliance dashboard.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = clean(body.action, 50).toLowerCase();

    if (action === "save_withdrawal_tax_rate") {
      const countryCode = clean(body.countryCode, 2).toUpperCase();
      const payoutMethod = clean(body.payoutMethod, 40).toLowerCase();
      const ratePercent = Number(body.ratePercent || 0);
      const fixedAmount = Number(body.fixedAmount || 0);
      const currency = clean(body.currency || "IDR", 3).toUpperCase();
      if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("A two-letter country code is required.");
      if (!/^[a-z0-9_-]{2,40}$/.test(payoutMethod)) throw new Error("Payout method is invalid.");
      if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) throw new Error("Withdrawal tax rate must be between 0 and 100.");
      if (!Number.isFinite(fixedAmount) || fixedAmount < 0) throw new Error("Fixed withdrawal tax cannot be negative.");
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("A three-letter currency code is required.");
      const status = clean(body.status || "draft", 20).toLowerCase();
      if (!["draft", "active", "inactive"].includes(status)) {
        throw new Error("Withdrawal tax status must be draft, active, or inactive.");
      }
      const validFrom = parseTimestamp(body.validFrom, "Withdrawal tax start date", new Date().toISOString());
      const validTo = clean(body.validTo, 80)
        ? parseTimestamp(body.validTo, "Withdrawal tax end date")
        : null;
      if (validTo && new Date(validTo).getTime() <= new Date(validFrom).getTime()) {
        throw new Error("Withdrawal tax end date must be after the start date.");
      }
      const sourceReference = clean(body.sourceReference, 500);
      if (status === "active" && !sourceReference) {
        throw new Error("An active withdrawal tax rule requires a legal/source reference.");
      }
      if (status === "active") {
        const { error: closeError } = await supabaseAdmin
          .from("withdrawal_tax_rates")
          .update({ status: "inactive", valid_to: validFrom, updated_at: new Date().toISOString() })
          .eq("country_code", countryCode)
          .eq("payout_method", payoutMethod)
          .eq("currency", currency)
          .eq("status", "active")
          .is("valid_to", null)
          .lt("valid_from", validFrom);
        if (closeError) throw new Error(closeError.message);
      }
      const payload = {
        country_code: countryCode,
        payout_method: payoutMethod,
        rate_percent: ratePercent,
        fixed_amount: fixedAmount,
        currency,
        status,
        valid_from: validFrom,
        valid_to: validTo,
        source_reference: sourceReference || null,
        metadata: { reviewed_by: user.id, tax_bearer: "seller" },
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseAdmin
        .from("withdrawal_tax_rates")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await recordAdminAudit({
        adminId: user.id,
        action: "withdrawal_tax_rate.create",
        entityType: "withdrawal_tax_rate",
        entityId: data.id,
        afterData: data,
      });
      return NextResponse.json({ withdrawalTaxRate: data }, { status: 201 });
    }


    if (action === "retry_privacy_deletion") {
      const requestId = clean(body.requestId, 80);
      if (!requestId) throw new Error("Privacy request ID is required.");
      const now = new Date().toISOString();
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("privacy_requests")
        .select("*")
        .eq("id", requestId)
        .eq("request_type", "delete")
        .eq("status", "failed")
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (!existing) throw new Error("Failed privacy deletion request not found.");
      const { data, error } = await supabaseAdmin
        .from("privacy_requests")
        .update({
          status: "pending",
          scheduled_for: now,
          failure_reason: null,
          updated_at: now,
          metadata: {
            ...((existing.metadata || {}) as Record<string, unknown>),
            retried_by: user.id,
            retried_at: now,
          },
        })
        .eq("id", requestId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await recordAdminAudit({
        adminId: user.id,
        action: "privacy_deletion.retry",
        entityType: "privacy_request",
        entityId: requestId,
        beforeData: existing,
        afterData: data,
      });
      return NextResponse.json({ request: data });
    }

    if (action === "generate_settlement") {
      const periodEnd = parseTimestamp(body.periodEnd, "Settlement period end", new Date().toISOString());
      const defaultStart = new Date(new Date(periodEnd).getTime() - 24 * 60 * 60 * 1000).toISOString();
      const periodStart = parseTimestamp(body.periodStart, "Settlement period start", defaultStart);
      if (new Date(periodEnd).getTime() <= new Date(periodStart).getTime()) {
        throw new Error("Settlement period end must be after the start.");
      }
      if (new Date(periodEnd).getTime() - new Date(periodStart).getTime() > 366 * 86_400_000) {
        throw new Error("Settlement period cannot exceed 366 days.");
      }
      const result = await generateProviderSettlementReport({
        supabaseAdmin,
        periodStart,
        periodEnd,
        generatedBy: user.id,
        source: "admin",
      });
      await recordAdminAudit({ adminId: user.id, action: "settlement.generate", entityType: "provider_settlement_report", entityId: result.reportId, metadata: result });
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported compliance action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compliance action failed.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const reviewId = Number(body.reviewId || 0);
    const decision = clean(body.decision, 20).toLowerCase();
    const note = clean(body.note, 2000);
    if (!Number.isInteger(reviewId) || reviewId <= 0) throw new Error("Invalid policy review ID.");
    if (!["approved", "rejected"].includes(decision)) throw new Error("Decision must be approved or rejected.");
    if (!note) throw new Error("A compliance review note is required.");

    const { data: review, error } = await supabaseAdmin
      .from("product_policy_reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!review) throw new Error("Pending policy review not found.");
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("product_policy_reviews")
      .update({ status: decision, reviewed_by: user.id, review_note: note, reviewed_at: now, updated_at: now })
      .eq("id", reviewId)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    const { data: product, error: productReadError } = await supabaseAdmin
      .from("products")
      .select("id,stock,status")
      .eq("id", review.product_id)
      .maybeSingle();
    if (productReadError) throw new Error(productReadError.message);
    if (!product) throw new Error("Reviewed product no longer exists.");

    const productUpdate = decision === "approved"
      ? {
          policy_status: "allowed",
          policy_reasons: [],
          policy_checked_at: now,
          status: Number(product.stock || 0) > 0 ? "active" : "inactive",
          updated_at: now,
        }
      : { policy_status: "rejected", policy_checked_at: now, status: "inactive", updated_at: now };
    const { error: productError } = await supabaseAdmin.from("products").update(productUpdate).eq("id", review.product_id);
    if (productError) throw new Error(productError.message);

    if (decision === "rejected") {
      const reasons = Array.isArray(review.reasons) ? review.reasons : [];
      const { error: strikeError } = await supabaseAdmin.from("seller_policy_strikes").insert({
        seller_id: review.seller_id,
        product_id: review.product_id,
        review_id: reviewId,
        severity: review.severity,
        reason: reasons.join("; ") || note,
        created_by: user.id,
      });
      if (strikeError) throw new Error(strikeError.message);
    }

    await recordAdminAudit({
      adminId: user.id,
      action: `product_policy.${decision}`,
      entityType: "product_policy_review",
      entityId: reviewId,
      beforeData: review,
      afterData: updated,
      metadata: { note, product_id: review.product_id },
    });
    return NextResponse.json({ review: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy review failed.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}
