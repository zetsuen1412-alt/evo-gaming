import { NextResponse } from "next/server";

const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = String(body.userId || "");
    const amountUsd = Number(body.amountUsd || 0);
    const rate = Number(body.rate || 15000);
    const amountIdr = Math.round(amountUsd * rate);

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
    }

    if (!amountUsd || amountUsd <= 0) {
      return NextResponse.json({ error: "Invalid PayPal amount." }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: userId,
            description: `ComePlayers Wallet Top Up - Rp ${amountIdr.toLocaleString("id-ID")}`,
            amount: {
              currency_code: "USD",
              value: amountUsd.toFixed(2),
            },
          },
        ],
      }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to create PayPal order.", details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      amountUsd,
      amountIdr,
      rate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected PayPal create order error.",
      },
      { status: 500 }
    );
  }
}