"use client";

import { useEffect, useMemo, useState } from "react";
import AccountShell from "@/components/account/AccountShell";
import { authenticatedFetchJson } from "@/lib/authenticatedFetch";
import { supabase } from "@/lib/supabase";

const DEVICE_KEY_STORAGE = "comeplayers_security_device_id";

function deviceKey() {
  let value = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE, value);
  }
  return value;
}

function deviceName() {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "Device";
  const browser = navigator.userAgent.includes("Edg/")
    ? "Edge"
    : navigator.userAgent.includes("Chrome/")
      ? "Chrome"
      : navigator.userAgent.includes("Firefox/")
        ? "Firefox"
        : navigator.userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  return `${browser} on ${platform}`.slice(0, 120);
}

type SecurityOverview = {
  account: { email: string; phoneNumber: string };
  privacy: { showFollowers: boolean; acceptProfileChat: boolean };
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    kycLevel: number;
  };
  payoutSecurity: {
    pinSet: boolean;
    pinSetAt: string | null;
    pinLockedUntil: string | null;
    payoutCooldownUntil: string | null;
    cooldownReason: string | null;
    mfaRequiredForPayout: boolean;
  };
  risk: {
    score: number;
    level: string;
    status: string;
    dailyLimit: number;
    reasons: string[];
    lastEvaluatedAt: string | null;
  };
  events: Array<{
    id: number;
    event_type: string;
    severity: string;
    status: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
};

type SecurityDevice = {
  id: string;
  device_name: string;
  user_agent: string;
  first_seen_at: string;
  last_seen_at: string;
  trusted_at: string | null;
  revoked_at: string | null;
  last_used_for_payout_at: string | null;
};

type MfaFactor = {
  id: string;
  friendly_name?: string;
  status?: string;
  factor_type?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}*****@${domain}`;
}

function maskPhone(phone: string) {
  if (!phone) return "Not set";
  return `${phone.slice(0, 4)}*****${phone.slice(-2)}`;
}

function riskClass(level: string) {
  if (level === "critical" || level === "high") return "text-red-300";
  if (level === "medium") return "text-yellow-300";
  return "text-emerald-300";
}

export default function SecurityPageClient() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [devices, setDevices] = useState<SecurityDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "", confirmPin: "" });
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [renderNow] = useState(() => Date.now());

  const activeMfaFactor = useMemo(
    () => mfaFactors.find((factor) => factor.status === "verified") || null,
    [mfaFactors]
  );

  async function loadMfa() {
    const { data, error: mfaError } = await supabase.auth.mfa.listFactors();
    if (mfaError) throw mfaError;
    const factors = [
      ...(data.totp || []),
      ...(data.phone || []),
    ] as MfaFactor[];
    setMfaFactors(factors);
  }

  async function load() {
    try {
      const key = deviceKey();
      const registered = await authenticatedFetchJson<{ device: SecurityDevice }>(
        "/api/security/devices",
        {
          method: "POST",
          body: JSON.stringify({ deviceKey: key, deviceName: deviceName() }),
        }
      );
      setCurrentDeviceId(registered.device.id);

      const [security, deviceList] = await Promise.all([
        authenticatedFetchJson<SecurityOverview>("/api/account/security"),
        authenticatedFetchJson<{ devices: SecurityDevice[] }>("/api/security/devices"),
        loadMfa(),
      ]);
      setOverview(security);
      setDevices(deviceList.devices);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load security center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updatePrivacy(field: "showFollowers" | "acceptProfileChat") {
    if (!overview) return;
    const next = { ...overview.privacy, [field]: !overview.privacy[field] };
    setOverview({ ...overview, privacy: next });
    try {
      await authenticatedFetchJson("/api/account/security", {
        method: "PATCH",
        body: JSON.stringify({ action: "privacy", ...next }),
      });
    } catch (updateError) {
      setOverview(overview);
      alert(updateError instanceof Error ? updateError.message : "Failed to update privacy.");
    }
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault();
    if (pinForm.newPin !== pinForm.confirmPin) {
      alert("PIN confirmation does not match.");
      return;
    }

    setBusy(true);
    try {
      await authenticatedFetchJson("/api/account/security", {
        method: "PATCH",
        body: JSON.stringify({
          action: "set_withdrawal_pin",
          currentPin: pinForm.currentPin,
          newPin: pinForm.newPin,
        }),
      });
      setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
      await load();
      alert("Withdrawal PIN saved. A security cooldown may apply before payout.");
    } catch (pinError) {
      alert(pinError instanceof Error ? pinError.message : "Failed to save withdrawal PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function startMfaEnrollment() {
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ComePlayers Authenticator",
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (enrollError) {
      alert(enrollError instanceof Error ? enrollError.message : "Failed to start MFA enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa() {
    if (!enrollment) return;
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      setEnrollment(null);
      setMfaCode("");
      await loadMfa();
      alert("Authenticator MFA is now active.");
    } catch (verifyError) {
      alert(verifyError instanceof Error ? verifyError.message : "Invalid MFA code.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMfa() {
    if (!activeMfaFactor || !confirm("Remove authenticator MFA from this account?")) return;
    setBusy(true);
    try {
      const { error: removeError } = await supabase.auth.mfa.unenroll({
        factorId: activeMfaFactor.id,
      });
      if (removeError) throw removeError;
      await loadMfa();
    } catch (removeError) {
      alert(removeError instanceof Error ? removeError.message : "Failed to remove MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function setPayoutMfaRequirement(required: boolean) {
    setBusy(true);
    try {
      await authenticatedFetchJson("/api/account/security", {
        method: "PATCH",
        body: JSON.stringify({ action: "set_mfa_payout_requirement", required }),
      });
      await load();
    } catch (requirementError) {
      alert(requirementError instanceof Error ? requirementError.message : "Failed to update payout MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function deviceAction(deviceId: string, action: "trust" | "revoke") {
    setBusy(true);
    try {
      await authenticatedFetchJson("/api/security/devices", {
        method: "PATCH",
        body: JSON.stringify({ deviceId, action }),
      });
      await load();
    } catch (deviceError) {
      alert(deviceError instanceof Error ? deviceError.message : "Failed to update device.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <AccountShell><div className="p-8 text-slate-300">Loading security center...</div></AccountShell>;
  }

  if (!overview) {
    return <AccountShell><div className="p-8 text-red-300">{error || "Security center unavailable."}</div></AccountShell>;
  }

  return (
    <AccountShell>
      <section className="border-b border-white/10 p-6 md:p-8">
        <h1 className="text-3xl font-black">Trust & Account Security</h1>
        <p className="mt-2 text-sm text-slate-300">Protect login, devices, payout accounts, and seller withdrawals.</p>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <Metric label="KYC level" value={String(overview.verification.kycLevel)} />
          <Metric label="Risk level" value={overview.risk.level.toUpperCase()} valueClass={riskClass(overview.risk.level)} />
          <Metric label="Daily payout limit" value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(overview.risk.dailyLimit)} />
        </div>
      </section>

      <section className="border-b border-white/10 p-6 md:p-8">
        <h2 className="text-2xl font-black">Identity</h2>
        <SecurityRow title="Email" description={maskEmail(overview.account.email)} status={overview.verification.emailVerified ? "Verified" : "Pending"} />
        <SecurityRow title="Mobile number" description={maskPhone(overview.account.phoneNumber)} status={overview.verification.phoneVerified ? "Verified" : "Pending"} />
        <SecurityRow title="Identity verification" description={`KYC level ${overview.verification.kycLevel}`} status={overview.verification.identityVerified ? "Verified" : "Incomplete"} />
      </section>

      <section className="border-b border-white/10 p-6 md:p-8">
        <h2 className="text-2xl font-black">Authenticator MFA</h2>
        <p className="mt-2 text-sm text-slate-300">Use a TOTP authenticator app for stronger login and optional payout protection.</p>

        {activeMfaFactor ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-black text-emerald-300">MFA active</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => setPayoutMfaRequirement(!overview.payoutSecurity.mfaRequiredForPayout)} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-black disabled:opacity-50">
                {overview.payoutSecurity.mfaRequiredForPayout ? "Disable payout MFA requirement" : "Require MFA for payouts"}
              </button>
              <button disabled={busy} onClick={removeMfa} className="rounded-xl border border-red-400/50 px-4 py-3 font-black text-red-300 disabled:opacity-50">Remove MFA</button>
            </div>
          </div>
        ) : enrollment ? (
          <div className="mt-5 grid gap-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 md:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="Authenticator QR code" className="h-52 w-52 rounded-xl bg-white p-3" />
            <div>
              <p className="font-black">Scan with your authenticator app</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-300">Secret: {enrollment.secret}</p>
              <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="mt-5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3" />
              <button disabled={busy || mfaCode.length !== 6} onClick={verifyMfa} className="mt-3 rounded-xl bg-cyan-400 px-5 py-3 font-black text-black disabled:opacity-50">Verify & Activate</button>
            </div>
          </div>
        ) : (
          <button disabled={busy} onClick={startMfaEnrollment} className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-black text-black disabled:opacity-50">Set up authenticator MFA</button>
        )}
      </section>

      <section className="border-b border-white/10 p-6 md:p-8">
        <h2 className="text-2xl font-black">Withdrawal PIN</h2>
        <p className="mt-2 text-sm text-slate-300">A separate 6-digit PIN is required before seller funds can be withdrawn.</p>
        {overview.payoutSecurity.payoutCooldownUntil && new Date(overview.payoutSecurity.payoutCooldownUntil).getTime() > renderNow ? (
          <p className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-200">Security cooldown until {formatDate(overview.payoutSecurity.payoutCooldownUntil)}. Reason: {overview.payoutSecurity.cooldownReason || "security change"}.</p>
        ) : null}
        <form onSubmit={savePin} className="mt-5 grid gap-4 md:grid-cols-3">
          {overview.payoutSecurity.pinSet ? (
            <input type="password" inputMode="numeric" maxLength={6} value={pinForm.currentPin} onChange={(event) => setPinForm((current) => ({ ...current, currentPin: event.target.value.replace(/\D/g, "") }))} required placeholder="Current PIN" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3" />
          ) : null}
          <input type="password" inputMode="numeric" maxLength={6} value={pinForm.newPin} onChange={(event) => setPinForm((current) => ({ ...current, newPin: event.target.value.replace(/\D/g, "") }))} required placeholder="New 6-digit PIN" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3" />
          <input type="password" inputMode="numeric" maxLength={6} value={pinForm.confirmPin} onChange={(event) => setPinForm((current) => ({ ...current, confirmPin: event.target.value.replace(/\D/g, "") }))} required placeholder="Confirm PIN" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3" />
          <button disabled={busy || pinForm.newPin.length !== 6 || pinForm.confirmPin.length !== 6} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-black disabled:opacity-50">{overview.payoutSecurity.pinSet ? "Change withdrawal PIN" : "Create withdrawal PIN"}</button>
        </form>
      </section>

      <section className="border-b border-white/10 p-6 md:p-8">
        <h2 className="text-2xl font-black">Devices</h2>
        <div className="mt-5 space-y-3">
          {devices.map((device) => (
            <div key={device.id} className={`rounded-2xl border p-4 ${device.revoked_at ? "border-red-400/30 bg-red-400/10" : "border-white/10 bg-black/20"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-black">{device.device_name} {device.id === currentDeviceId ? <span className="text-cyan-300">· Current</span> : null}</p>
                  <p className="mt-1 text-xs text-slate-400">Last seen: {formatDate(device.last_seen_at)}</p>
                  <p className="mt-1 text-xs text-slate-500">{device.user_agent}</p>
                </div>
                <div className="flex gap-2">
                  {!device.trusted_at && !device.revoked_at ? <button disabled={busy} onClick={() => deviceAction(device.id, "trust")} className="rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-black text-emerald-300">Trust</button> : null}
                  {!device.revoked_at ? <button disabled={busy} onClick={() => deviceAction(device.id, "revoke")} className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-black text-red-300">Revoke</button> : <span className="text-xs font-black text-red-300">Revoked</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-white/10 p-6 md:p-8">
        <h2 className="text-2xl font-black">Privacy</h2>
        <ToggleRow title="Show followers and following" checked={overview.privacy.showFollowers} onClick={() => updatePrivacy("showFollowers")} />
        <ToggleRow title="Accept chat from profile page" checked={overview.privacy.acceptProfileChat} onClick={() => updatePrivacy("acceptProfileChat")} />
      </section>

      <section className="p-6 md:p-8">
        <h2 className="text-2xl font-black">Recent Security Activity</h2>
        <div className="mt-5 space-y-3">
          {overview.events.length === 0 ? <p className="text-sm text-slate-400">No security events recorded yet.</p> : overview.events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex justify-between gap-4"><p className="font-black">{event.event_type.replace(/_/g, " ")}</p><span className="text-xs uppercase text-slate-400">{event.severity}</span></div>
              <p className="mt-2 text-xs text-slate-500">{formatDate(event.created_at)}</p>
            </div>
          ))}
        </div>
      </section>
    </AccountShell>
  );
}

function Metric({ label, value, valueClass = "text-cyan-300" }: { label: string; value: string; valueClass?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 text-xl font-black ${valueClass}`}>{value}</p></div>;
}

function SecurityRow({ title, description, status }: { title: string; description: string; status: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 py-5"><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-slate-300">{description}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{status}</span></div>;
}

function ToggleRow({ title, checked, onClick }: { title: string; checked: boolean; onClick: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 py-5"><p className="font-bold">{title}</p><button type="button" onClick={onClick} className={`h-7 w-14 rounded-full p-1 transition ${checked ? "bg-cyan-400" : "bg-slate-600"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-7" : ""}`} /></button></div>;
}
