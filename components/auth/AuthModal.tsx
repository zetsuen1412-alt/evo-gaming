"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FaDiscord,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaShieldAlt,
  FaShoppingBag,
  FaStore,
  FaUser,
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";
import {
  createCooldownDeadline,
  getCooldownSeconds,
  isRateLimitMessage,
} from "@/lib/auth/cooldown";
import { getPasswordStrength } from "@/lib/auth/passwordStrength";
import {
  getRememberMePreference,
  setRememberMePreference,
} from "@/lib/auth/sessionStorage";
import { supabase } from "@/lib/supabase";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";

export type AuthMode = "login" | "register" | "forgot" | "verify";
type OAuthProvider = "google" | "discord";
type AuthNotice = {
  type: "error" | "success" | "info";
  message: string;
};

type AuthModalProps = {
  open: boolean;
  initialMode?: Extract<AuthMode, "login" | "register">;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-2xl border border-slate-700 bg-[#070b20] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 sm:py-4";

const EMAIL_ACTION_COOLDOWN_SECONDS = 60;
const LOGIN_FAILURE_COOLDOWN_SECONDS = 30;
const MAX_LOGIN_FAILURES = 5;
const AUTH_COOLDOWN_PREFIX = "comeplayers_auth_cooldown";

function getCooldownStorageKey(action: "register" | "reset" | "verify", email: string) {
  return `${AUTH_COOLDOWN_PREFIX}_${action}_${email.trim().toLowerCase()}`;
}

function readStoredCooldown(action: "register" | "reset" | "verify", email: string) {
  if (typeof window === "undefined" || !email) return 0;
  return Number(window.localStorage.getItem(getCooldownStorageKey(action, email)) || 0);
}

function storeCooldown(
  action: "register" | "reset" | "verify",
  email: string,
  availableAt: number
) {
  if (typeof window === "undefined" || !email) return;
  window.localStorage.setItem(
    getCooldownStorageKey(action, email),
    String(availableAt)
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

export default function AuthModal({
  open,
  initialMode = "login",
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [loginFailures, setLoginFailures] = useState(0);
  const [loginBlockedUntil, setLoginBlockedUntil] = useState(0);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const activeCooldownDeadline =
    mode === "login"
      ? loginBlockedUntil
      : mode === "forgot" || mode === "verify"
      ? cooldownUntil
      : 0;
  const cooldownSeconds = getCooldownSeconds(
    activeCooldownDeadline,
    cooldownNow
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [initialMode, onClose, open]);

  useEffect(() => {
    if (!activeCooldownDeadline) return;

    const timer = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeCooldownDeadline]);

  if (!open) return null;

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setLoading(false);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (nextMode !== "register") setAcceptTerms(false);

    if (nextMode === "register") {
      setCooldownUntil(readStoredCooldown("register", email));
    } else if (nextMode === "forgot") {
      setCooldownUntil(readStoredCooldown("reset", email));
    } else if (nextMode === "verify") {
      setCooldownUntil(readStoredCooldown("verify", verificationEmail || email));
    } else {
      setCooldownUntil(0);
    }
  }

  function beginEmailCooldown(action: "register" | "reset" | "verify", targetEmail: string) {
    const deadline = createCooldownDeadline(EMAIL_ACTION_COOLDOWN_SECONDS);
    storeCooldown(action, targetEmail, deadline);
    setCooldownUntil(deadline);
    setCooldownNow(Date.now());
  }

  function handleProviderError(
    message: string,
    action?: "register" | "reset" | "verify",
    targetEmail?: string
  ) {
    if (!isRateLimitMessage(message)) {
      setNotice({ type: "error", message });
      return;
    }

    if (action && targetEmail) {
      beginEmailCooldown(action, targetEmail);
    }

    setNotice({
      type: "error",
      message:
        "Too many requests were detected. Please wait for the countdown before trying again.",
    });
  }

  async function ensureInitialWallet() {
    try {
      await authenticatedFetchJson("/api/wallet/topups", {
        method: "POST",
        body: JSON.stringify({ action: "ensure-wallet" }),
      });
    } catch (error) {
      console.error(
        "Create initial wallet error:",
        error instanceof Error ? error.message : error
      );
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const finalEmail = email.trim().toLowerCase();

    if (!finalEmail) {
      setNotice({ type: "error", message: "Please enter your email address." });
      return;
    }

    if (mode === "forgot") {
      const resetDeadline = Math.max(
        cooldownUntil,
        readStoredCooldown("reset", finalEmail)
      );
      const resetRemaining = getCooldownSeconds(resetDeadline);

      if (resetRemaining > 0) {
        setCooldownUntil(resetDeadline);
        setCooldownNow(Date.now());
        setNotice({
          type: "info",
          message: `Please wait ${resetRemaining} seconds before requesting another link.`,
        });
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(finalEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        handleProviderError(error.message, "reset", finalEmail);
        setLoading(false);
        return;
      }

      beginEmailCooldown("reset", finalEmail);
      setNotice({
        type: "success",
        message:
          "Reset link sent. Check your inbox and spam folder. Another link can be requested after the countdown.",
      });
      setLoading(false);
      return;
    }

    if (!password) {
      setNotice({ type: "error", message: "Please enter your password." });
      return;
    }

    if (mode === "register" && cooldownSeconds > 0) {
      setNotice({
        type: "info",
        message: `Please wait ${cooldownSeconds} seconds before trying to register again.`,
      });
      return;
    }

    setRememberMePreference(rememberMe);
    setLoading(true);

    if (mode === "login") {
      const remainingBlock = getCooldownSeconds(loginBlockedUntil);
      if (remainingBlock > 0) {
        setNotice({
          type: "error",
          message: `Login is temporarily paused. Try again in ${remainingBlock} seconds.`,
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password,
      });

      if (error) {
        const nextFailures = loginFailures + 1;

        if (nextFailures >= MAX_LOGIN_FAILURES) {
          const deadline = createCooldownDeadline(
            LOGIN_FAILURE_COOLDOWN_SECONDS
          );
          setLoginBlockedUntil(deadline);
          setCooldownNow(Date.now());
          setLoginFailures(0);
          setNotice({
            type: "error",
            message:
              "Several unsuccessful attempts were detected. Login is paused briefly to reduce automated abuse.",
          });
        } else {
          setLoginFailures(nextFailures);
          handleProviderError(error.message);
        }

        setLoading(false);
        return;
      }

      setLoginFailures(0);
      setLoginBlockedUntil(0);
      onClose();
      return;
    }

    const finalUsername = username.trim();

    if (!/^[A-Za-z0-9_]{3,20}$/.test(finalUsername)) {
      setNotice({
        type: "error",
        message:
          "Username must be 3–20 characters and use only letters, numbers, or underscores.",
      });
      setLoading(false);
      return;
    }

    if (strength.score < 3) {
      setNotice({
        type: "error",
        message:
          "Please choose a stronger password using at least 8 characters and a mix of character types.",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ type: "error", message: "Passwords do not match." });
      setLoading(false);
      return;
    }

    if (!acceptTerms) {
      setNotice({
        type: "error",
        message: "Please agree to the Terms and Privacy Policy.",
      });
      setLoading(false);
      return;
    }

    const { data: existingUsername, error: usernameCheckError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", finalUsername)
      .maybeSingle();

    if (usernameCheckError) {
      setNotice({ type: "error", message: usernameCheckError.message });
      setLoading(false);
      return;
    }

    if (existingUsername) {
      setNotice({ type: "error", message: "Username is already taken." });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: finalEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: finalUsername },
      },
    });

    if (error) {
      handleProviderError(error.message, "register", finalEmail);
      setLoading(false);
      return;
    }

    beginEmailCooldown("register", finalEmail);

    if (data.session) {
      await ensureInitialWallet();
      onClose();
      return;
    }

    setVerificationEmail(finalEmail);
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
    beginEmailCooldown("verify", finalEmail);
    setMode("verify");
  }

  async function handleOAuthLogin(provider: OAuthProvider) {
    setRememberMePreference(rememberMe);
    setLoading(true);
    setNotice(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setNotice({ type: "error", message: error.message });
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!verificationEmail) return;

    if (cooldownSeconds > 0) {
      setNotice({
        type: "info",
        message: `You can request another verification email in ${cooldownSeconds} seconds.`,
      });
      return;
    }

    setResendLoading(true);
    setNotice(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      handleProviderError(error.message, "verify", verificationEmail);
      setResendLoading(false);
      return;
    }

    beginEmailCooldown("verify", verificationEmail);
    setNotice({
      type: "success",
      message: "A new verification email has been sent.",
    });
    setResendLoading(false);
  }


  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-5 backdrop-blur-md sm:px-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="ComePlayers account access"
    >
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-slate-700/80 bg-[#12172e] shadow-[0_32px_100px_rgba(0,0,0,0.8)] lg:grid-cols-[0.88fr_1.12fr]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#10152a]/90 text-xl font-black text-slate-400 transition hover:border-cyan-400/50 hover:text-white"
          aria-label="Close authentication modal"
          type="button"
        >
          ×
        </button>

        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-[linear-gradient(145deg,#061324_0%,#101b3f_55%,#092736_100%)] p-9 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-yellow-300/10 blur-3xl" />

          <div className="relative">
            <Image
              src="/logo-transparent.png"
              alt="ComePlayers"
              width={230}
              height={76}
              className="h-auto w-[210px] object-contain"
              priority
            />
            <h2 className="mt-7 text-4xl font-black leading-tight text-white">
              Trade gaming products with confidence.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              One account for protected checkout, verified sellers, order tracking,
              disputes, wallet activity, and seller tools.
            </p>
          </div>

          <div className="relative mt-10 grid gap-4">
            {[
              {
                icon: FaShieldAlt,
                title: "Protected transactions",
                text: "Escrow, risk checks, and dispute support are built into the marketplace.",
              },
              {
                icon: FaShoppingBag,
                title: "Everything in one place",
                text: "Manage purchases, messages, invoices, and account security from one dashboard.",
              },
              {
                icon: FaStore,
                title: "Ready when you want to sell",
                text: "Apply as a seller and grow with storefront, analytics, and payout tools.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="relative mt-10 text-xs text-slate-500">
            Secure account access powered by Supabase authentication.
          </p>
        </aside>

        <section className="max-h-[calc(100vh-2.5rem)] overflow-y-auto bg-[linear-gradient(180deg,#181d43_0%,#12182f_100%)] p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-xl">
            <Image
              src="/logo-transparent.png"
              alt="ComePlayers"
              width={170}
              height={56}
              className="mb-5 h-auto w-[150px] object-contain lg:hidden"
              priority
            />
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300 sm:text-[11px]">
              Secure account access
            </div>

            {mode === "verify" ? (
              <div className="py-8 text-center sm:py-12">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <FaEnvelope className="h-7 w-7" />
                </div>
                <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Verify your email
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
                  We sent a verification link to{" "}
                  <span className="font-bold text-white">
                    {maskEmail(verificationEmail)}
                  </span>
                  . Open the link to activate your account.
                </p>

                {notice && (
                  <div
                    className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                      notice.type === "error"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {notice.message}
                  </div>
                )}

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <a
                    href={`mailto:${verificationEmail}`}
                    className="rounded-2xl bg-cyan-400 px-5 py-3.5 font-black text-black transition hover:bg-cyan-300"
                  >
                    Open email app
                  </a>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading || cooldownSeconds > 0}
                    className="rounded-2xl border border-slate-600 bg-white/5 px-5 py-3.5 font-bold text-white transition hover:border-cyan-400/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendLoading
                      ? "Sending..."
                      : cooldownSeconds > 0
                      ? `Resend in ${cooldownSeconds}s`
                      : "Resend email"}
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(verificationEmail);
                      switchMode("login");
                    }}
                    className="font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    Back to login
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-semibold text-slate-400 hover:text-white"
                  >
                    Use another email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {mode === "login"
                      ? "Welcome back"
                      : mode === "register"
                      ? "Create your account"
                      : "Reset your password"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-[15px]">
                    {mode === "login"
                      ? "Sign in to continue buying, chatting, and managing your orders securely."
                      : mode === "register"
                      ? "Join ComePlayers and start trading digital gaming products safely."
                      : "Enter your email and we will send a secure password reset link."}
                  </p>
                </div>

                {mode !== "forgot" ? (
                  <div className="mt-6 grid grid-cols-2 rounded-2xl border border-slate-700 bg-[#0b1024] p-1">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className={`rounded-xl py-3 text-sm font-black transition ${
                        mode === "login"
                          ? "bg-cyan-400 text-black"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("register")}
                      className={`rounded-xl py-3 text-sm font-black transition ${
                        mode === "register"
                          ? "bg-cyan-400 text-black"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Register
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    <span aria-hidden>←</span> Back to login
                  </button>
                )}

                {notice && (
                  <div
                    className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                      notice.type === "error"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : notice.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                    }`}
                  >
                    {notice.message}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                  {mode === "register" && (
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-200">Username</span>
                      <div className="relative">
                        <FaUser className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="Choose a public username"
                          autoComplete="username"
                          className={inputClass}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        3–20 characters. Letters, numbers, and underscores only.
                      </span>
                    </label>
                  )}

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-200">Email address</span>
                    <div className="relative">
                      <FaEnvelope className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={inputClass}
                      />
                    </div>
                  </label>

                  {mode !== "forgot" && (
                    <label className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-200">Password</span>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => switchMode("forgot")}
                            className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <FaLock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={
                            mode === "register"
                              ? "Create a strong password"
                              : "Enter your password"
                          }
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <FaEyeSlash className="h-4 w-4" />
                          ) : (
                            <FaEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {mode === "register" && (
                        <PasswordStrengthMeter password={password} />
                      )}
                    </label>
                  )}

                  {mode === "register" && (
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-200">
                        Confirm password
                      </span>
                      <div className="relative">
                        <FaLock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((current) => !current)
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirm password"
                              : "Show confirm password"
                          }
                        >
                          {showConfirmPassword ? (
                            <FaEyeSlash className="h-4 w-4" />
                          ) : (
                            <FaEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </label>
                  )}

                  {mode === "login" && (
                    <label className="flex items-start gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-[#070b20] text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        Remember me on this device
                        <span className="block text-xs text-slate-500">
                          Turn this off on shared or public computers.
                        </span>
                      </span>
                    </label>
                  )}

                  {mode === "register" && (
                    <label className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(event) => setAcceptTerms(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-[#070b20] text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        I agree to the{" "}
                        <Link
                          href="/terms"
                          className="font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          ComePlayers Terms
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          className="font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                  )}

                  <button
                    disabled={loading || cooldownSeconds > 0}
                    className="rounded-2xl bg-cyan-400 py-3.5 text-base font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:py-4"
                  >
                    {loading
                      ? "Please wait..."
                      : cooldownSeconds > 0 && mode === "login"
                      ? `Try again in ${cooldownSeconds}s`
                      : cooldownSeconds > 0 && mode === "forgot"
                      ? `Send again in ${cooldownSeconds}s`
                      : cooldownSeconds > 0 && mode === "register"
                      ? `Try again in ${cooldownSeconds}s`
                      : mode === "login"
                      ? "Login securely"
                      : mode === "register"
                      ? "Create Account"
                      : "Send Reset Link"}
                  </button>
                </form>

                {mode !== "forgot" && (
                  <>
                    <div className="my-6 flex items-center gap-4">
                      <div className="h-px flex-1 bg-slate-700" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
                        or continue with
                      </p>
                      <div className="h-px flex-1 bg-slate-700" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleOAuthLogin("google")}
                        className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-[#111827] px-4 text-sm font-semibold text-white transition hover:border-cyan-400/60 hover:bg-[#202b42] disabled:opacity-60"
                      >
                        <FcGoogle className="h-5 w-5" /> Google
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleOAuthLogin("discord")}
                        className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-[#111827] px-4 text-sm font-semibold text-white transition hover:border-[#5865F2]/70 hover:bg-[#202b42] disabled:opacity-60"
                      >
                        <FaDiscord className="h-5 w-5 text-[#5865F2]" /> Discord
                      </button>
                    </div>
                  </>
                )}

                <div className="mt-6 border-t border-white/8 pt-5 text-center text-sm text-slate-400">
                  {mode === "login" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className="font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        Register now
                      </button>
                    </>
                  ) : mode === "register" ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        Login here
                      </button>
                    </>
                  ) : (
                    <>
                      Remembered your password?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        Return to login
                      </button>
                    </>
                  )}
                </div>

                <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
                  By continuing, you agree to the{" "}
                  <Link href="/terms" className="text-slate-300 hover:text-white">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-slate-300 hover:text-white">
                    Privacy Policy
                  </Link>
                  . Need help?{" "}
                  <Link href="/support" className="text-slate-300 hover:text-white">
                    Contact support
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
