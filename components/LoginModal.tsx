"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    const finalEmail = email.trim();
    const finalPassword = password.trim();
    const finalUsername = username.trim();

    if (!finalEmail || !finalPassword) {
      alert("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: finalPassword,
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      onSuccess?.();
      onClose();
      window.location.reload();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: finalEmail,
      password: finalPassword,
      options: {
        data: {
          username: finalUsername || finalEmail.split("@")[0],
        },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: finalEmail,
        username: finalUsername || finalEmail.split("@")[0],
        role: "user",
      });
    }

    alert("Akun berhasil dibuat. Jika email confirmation aktif, cek email kamu.");
    onSuccess?.();
    onClose();
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-cyan-400/30 bg-[#0b1020] p-7 text-white shadow-2xl shadow-cyan-500/10">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-300 hover:bg-white hover:text-black"
          type="button"
        >
          ✕
        </button>

        <div className="mb-6">
          <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">
            ComePlayers Account
          </p>

          <h2 className="mt-4 text-4xl font-black">
            {mode === "login" ? "Login" : "Register"}
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            {mode === "login"
              ? "Masuk untuk membuka pesan, order, wallet, dan seller dashboard."
              : "Buat akun baru untuk mulai membeli dan menjual item gaming."}
          </p>
        </div>

        {mode === "register" && (
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            className="mb-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
          />
        )}

        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="mb-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="mb-4 w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm outline-none placeholder:text-gray-500 focus:border-cyan-400"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          type="button"
          className="h-14 w-full rounded-2xl bg-cyan-400 font-black text-black hover:bg-cyan-300 disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
        </button>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          type="button"
          className="mt-5 w-full text-center text-sm font-bold text-cyan-300 hover:text-cyan-200"
        >
          {mode === "login"
            ? "Belum punya akun? Register"
            : "Sudah punya akun? Login"}
        </button>
      </div>
    </div>
  );
}
