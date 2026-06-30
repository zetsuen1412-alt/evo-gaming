import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  recordAdminAudit,
  requireAdmin,
} from "@/lib/adminSecurity";
import { decryptPayoutAccount } from "@/lib/payoutCrypto";

function clean(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await requireAdmin(request);
    const url = new URL(request.url);
    const requestedStatus = clean(url.searchParams.get("status"), 30).toLowerCase();

    let query = supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (requestedStatus && requestedStatus !== "all") {
      query = query.eq("status", requestedStatus);
    }

    const { data: withdrawals, error } = await query;
    if (error) throw new Error(error.message);

    const rows = withdrawals || [];
    const userIds = [...new Set(rows.map((row) => String(row.user_id || "")).filter(Boolean))];
    const walletIds = [...new Set(rows.map((row) => Number(row.wallet_id || 0)).filter((id) => id > 0))];
    const accountIds = [...new Set(rows.map((row) => Number(row.payout_account_id || 0)).filter((id) => id > 0))];

    const [profilesResult, walletsResult, accountsResult] = await Promise.all([
      userIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id,email,username,role,avatar_url,seller_name,seller_status")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      walletIds.length
        ? supabaseAdmin
            .from("wallets")
            .select("id,user_id,balance,total_withdrawn,status")
            .in("id", walletIds)
        : Promise.resolve({ data: [], error: null }),
      accountIds.length
        ? supabaseAdmin
            .from("payout_accounts")
            .select("id,user_id,method,label,account_name,account_last4,bank_name,country_code,currency,is_default,status,verification_status")
            .in("id", accountIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (walletsResult.error) throw new Error(walletsResult.error.message);
    if (accountsResult.error) throw new Error(accountsResult.error.message);

    const profiles = new Map((profilesResult.data || []).map((item) => [String(item.id), item]));
    const wallets = new Map((walletsResult.data || []).map((item) => [Number(item.id), item]));
    const accounts = new Map((accountsResult.data || []).map((item) => [Number(item.id), item]));

    return NextResponse.json({
      withdrawals: rows.map((row) => ({
        ...row,
        profiles: profiles.get(String(row.user_id)) || null,
        wallets: wallets.get(Number(row.wallet_id)) || null,
        payout_accounts: accounts.get(Number(row.payout_account_id)) || null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected withdrawal error.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as {
      withdrawalId?: number | string;
      action?: string;
      reason?: string;
    };

    const withdrawalId = Number(body.withdrawalId || 0);
    const action = clean(body.action || "reveal", 30).toLowerCase();
    const reason = clean(body.reason, 300);

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ error: "Invalid withdrawal ID." }, { status: 400 });
    }
    if (action !== "reveal") {
      return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
    }

    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (withdrawalError) throw new Error(withdrawalError.message);
    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal request not found." }, { status: 404 });
    }

    let details = {
      method: String(withdrawal.payout_method || ""),
      accountName: String(withdrawal.payout_account_name || ""),
      accountIdentifier: String(withdrawal.payout_account_number || ""),
      bankName: "",
      countryCode: "ID",
      currency: String(withdrawal.currency || "IDR"),
    };

    const payoutAccountId = Number(withdrawal.payout_account_id || 0);
    if (payoutAccountId > 0) {
      if (withdrawal.payout_ciphertext && withdrawal.payout_iv && withdrawal.payout_auth_tag) {
        details = decryptPayoutAccount(payoutAccountId, {
          ciphertext: String(withdrawal.payout_ciphertext),
          iv: String(withdrawal.payout_iv),
          auth_tag: String(withdrawal.payout_auth_tag),
          key_version: Number(withdrawal.payout_key_version || 1),
        });
      } else {
        const { data: account, error: accountError } = await supabaseAdmin
          .from("payout_accounts")
          .select("id,ciphertext,iv,auth_tag,key_version")
          .eq("id", payoutAccountId)
          .eq("user_id", withdrawal.user_id)
          .maybeSingle();

        if (accountError) throw new Error(accountError.message);
        if (!account?.ciphertext || !account.iv || !account.auth_tag) {
          throw new Error("Encrypted payout account details are unavailable.");
        }

        details = decryptPayoutAccount(payoutAccountId, {
          ciphertext: String(account.ciphertext),
          iv: String(account.iv),
          auth_tag: String(account.auth_tag),
          key_version: Number(account.key_version || 1),
        });
      }
    }

    await recordAdminAudit({
      adminId: user.id,
      action: "withdrawal.payout_details_revealed",
      entityType: "withdrawal_request",
      entityId: withdrawalId,
      metadata: {
        reason: reason || "Manual payout processing",
        payout_account_id: payoutAccountId || null,
      },
    });

    return NextResponse.json({ details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payout reveal error.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireAdmin(request);
    const body = (await request.json()) as {
      withdrawalId?: number | string;
      action?: string;
      note?: string;
      reference?: string;
      provider?: string;
      feeAmount?: number | string;
      overrideHold?: boolean;
    };

    const withdrawalId = Number(body.withdrawalId || 0);
    const action = clean(body.action, 30).toLowerCase();
    const note = clean(body.note, 1000);
    const reference = clean(body.reference, 180);
    const provider = clean(body.provider, 80);
    const feeAmount = numberValue(body.feeAmount);
    const allowed = new Set(["approve", "processing", "paid", "reject", "fail"]);

    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ error: "Invalid withdrawal ID." }, { status: 400 });
    }
    if (!allowed.has(action)) {
      return NextResponse.json({ error: "Invalid withdrawal action." }, { status: 400 });
    }
    if ((action === "reject" || action === "fail") && !note) {
      return NextResponse.json(
        { error: "An admin note is required for rejected or failed payouts." },
        { status: 400 }
      );
    }
    if (action === "paid" && !reference) {
      return NextResponse.json(
        { error: "A payout reference is required before marking paid." },
        { status: 400 }
      );
    }
    if (feeAmount < 0) {
      return NextResponse.json({ error: "Payout fee cannot be negative." }, { status: 400 });
    }

    const { data: before } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    const { data, error } = await supabaseAdmin.rpc(
      "cp_admin_process_withdrawal_v22",
      {
        p_withdrawal_id: withdrawalId,
        p_admin_id: user.id,
        p_action: action,
        p_note: note || null,
        p_reference: reference || null,
        p_provider: provider || null,
        p_fee_amount: feeAmount,
        p_override_hold: Boolean(body.overrideHold),
      }
    );

    if (error) throw new Error(error.message);

    const { data: after } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    await recordAdminAudit({
      adminId: user.id,
      action: `withdrawal.${action}`,
      entityType: "withdrawal_request",
      entityId: withdrawalId,
      beforeData: before,
      afterData: after,
      metadata: {
        note,
        reference,
        provider,
        feeAmount,
        overrideHold: Boolean(body.overrideHold),
      },
    });

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected withdrawal error.";
    return NextResponse.json({ error: message }, { status: adminErrorStatus(error) });
  }
}
