"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

export default function TestPaypal() {
  return (
    <main className="min-h-screen bg-[#050816] p-10 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-[#111827] p-6">
        <h1 className="text-2xl font-black">PayPal Sandbox Test</h1>
        <p className="mt-2 text-sm text-gray-400">
          Test pembayaran sandbox sebesar $5.00.
        </p>

        <div className="mt-6">
          <PayPalScriptProvider
            options={{
              clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
              currency: "USD",
              intent: "capture",
              components: "buttons",
            }}
          >
            <PayPalButtons
              style={{
                layout: "vertical",
                color: "gold",
                shape: "rect",
                label: "paypal",
              }}
              createOrder={async () => {
                const response = await fetch("/api/paypal/create-order", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    amount: 5,
                  }),
                });

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.error || "Failed to create PayPal order.");
                }

                return data.id;
              }}
              onApprove={async (data) => {
                const response = await fetch("/api/paypal/capture-order", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    orderId: data.orderID,
                  }),
                });

                const result = await response.json();

                if (!response.ok) {
                  alert(result.error || "Failed to capture PayPal payment.");
                  return;
                }

                alert(`Pembayaran berhasil. Status: ${result.status}`);
              }}
              onError={(error) => {
                console.error("PayPal error:", error);
                alert("PayPal error. Cek console browser.");
              }}
            />
          </PayPalScriptProvider>
        </div>
      </div>
    </main>
  );
}