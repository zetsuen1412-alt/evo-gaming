import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const TOPUP_RATE = 15000;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase server env.");
  }

  return createClient(supabaseUrl, serviceKey);
}

async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal env is missing.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token.");
  }

  const data = await response.json();
  return data.access_token as string;
}

async function ensureWallet(supabaseAdmin: any, userId: string) {
  const { data: existingWallet, error: walletSelectError } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletSelectError) {
    throw new Error(walletSelectError.message);
  }

  if (existingWallet) return existingWallet;

  const { data: newWallet, error: walletInsertError } = await supabaseAdmin
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

  if (walletInsertError) {
    throw new Error(walletInsertError.message);
  }

  return newWallet;
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = await request.json();
    const orderId = String(body.orderId || "");
    const userId = String(body.userId || "");

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing PayPal order ID." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
    }

    const wallet = await ensureWallet(supabaseAdmin, userId);

    const { data: existingTopup, error: duplicateCheckError } =
      await supabaseAdmin
        .from("wallet_topups")
        .select("*")
        .eq("payment_method", "PayPal")
        .eq("payment_note", `PayPal Order ID: ${orderId}`)
        .maybeSingle();

    if (duplicateCheckError) {
      throw new Error(duplicateCheckError.message);
    }

    if (existingTopup) {
      return NextResponse.json({
        status: "COMPLETED",
        duplicated: true,
        amountIdr: Number(existingTopup.amount || 0),
        message: "PayPal order already processed.",
      });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to capture PayPal order.", details: data },
        { status: response.status }
      );
    }

    if (data.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal payment is not completed.", details: data },
        { status: 400 }
      );
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0] || null;
    const paypalAmountUsd = Number(capture?.amount?.value || 0);

    if (!paypalAmountUsd || paypalAmountUsd <= 0) {
      return NextResponse.json(
        { error: "Invalid captured PayPal amount." },
        { status: 400 }
      );
    }

    const amountIdr = Math.round(paypalAmountUsd * TOPUP_RATE);
    const oldBalance = Number(wallet.balance || 0);
    const newBalance = oldBalance + amountIdr;

    const { error: updateWalletError } = await supabaseAdmin
      .from("wallets")
      .update({
        balance: newBalance,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    if (updateWalletError) {
      throw new Error(updateWalletError.message);
    }

    const payerName =
      data.payer?.name?.given_name ||
      data.payer?.name?.surname ||
      "PayPal User";

    const payerEmail = data.payer?.email_address || null;

    const { error: topupInsertError } = await supabaseAdmin
      .from("wallet_topups")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        amount: amountIdr,
        payment_method: "PayPal",
        sender_name: payerName,
        sender_account: payerEmail,
        payment_note: `PayPal Order ID: ${orderId}`,
        payment_image: null,
        status: "approved",
        admin_note: `Auto approved by PayPal. USD ${paypalAmountUsd.toFixed(
          2
        )} x Rp ${TOPUP_RATE.toLocaleString("id-ID")}`,
        processed_at: new Date().toISOString(),
      });

    if (topupInsertError) {
      throw new Error(topupInsertError.message);
    }

    const { error: transactionInsertError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        type: "topup",
        amount: amountIdr,
        description: `PayPal wallet top up - Order ${orderId}`,
        status: "completed",
      });

    if (transactionInsertError) {
      console.error(
        "Wallet transaction insert error:",
        transactionInsertError.message
      );
    }

    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        type: "wallet_topup_success",
        title: "Wallet Top Up Berhasil",
        message: `Saldo wallet kamu bertambah Rp ${amountIdr.toLocaleString(
          "id-ID"
        )} via PayPal.`,
        link_url: "/wallet/topup",
        is_read: false,
      });

    if (notificationError) {
      console.error("Notification insert error:", notificationError.message);
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      paypalAmountUsd,
      amountIdr,
      oldBalance,
      newBalance,
      payer: data.payer || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected PayPal capture order error.",
      },
      { status: 500 }
    );
  }
}