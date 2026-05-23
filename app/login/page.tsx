"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Login berhasil!");

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-4xl font-black">
          Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="mt-8 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mt-4 w-full rounded-2xl border border-gray-700 bg-black px-5 py-4 outline-none focus:border-cyan-400"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="mt-6 w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black hover:bg-cyan-300"
        >
          Login
        </button>

        <a
          href="/register"
          className="mt-6 block text-center text-cyan-400"
        >
          Belum punya akun? Register
        </a>
      </div>
    </main>
  );
}