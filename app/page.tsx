import { Suspense } from "react";
import HomeClient from "./HomeClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
          <p className="text-xl font-black text-cyan-300">
            Loading homepage...
          </p>
        </main>
      }
    >
      <HomeClient />
    </Suspense>
  );
}