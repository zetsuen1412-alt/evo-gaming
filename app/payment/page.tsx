import { Suspense } from "react";
import PaymentClient from "./PaymentClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
          <p className="text-xl font-black text-cyan-300">
            Loading payment...
          </p>
        </main>
      }
    >
      <PaymentClient />
    </Suspense>
  );
}