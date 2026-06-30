"use client";

import { useCallback, useEffect, useState } from "react";
import AccountShell from "@/components/account/AccountShell";
import { supabase } from "@/lib/supabase";

type PrivacyRequest = {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  scheduled_for?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  failure_reason?: string | null;
};

export default function PrivacyPage() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [graceDays, setGraceDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Please login again.");
    return data.session.access_token;
  }, []);

  const load = useCallback(async () => {
    try {
      const accessToken = await token();
      const response = await fetch("/api/account/privacy", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load privacy requests.");
      setRequests(json.requests || []);
      setGraceDays(Number(json.deleteGraceDays || 30));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load privacy requests.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function downloadExport() {
    setBusy("export");
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/account/privacy", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `comeplayers-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Privacy export downloaded.");
      await load();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    } finally {
      setBusy("");
    }
  }

  async function requestDeletion() {
    const confirmation = window.prompt("Type DELETE exactly to schedule account deletion:") || "";
    if (!confirmation) return;
    setBusy("delete");
    setError("");
    setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/account/privacy", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_deletion", confirmation }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Deletion request failed.");
      setMessage(`Deletion is scheduled after the ${graceDays}-day grace period.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Deletion request failed.");
    } finally {
      setBusy("");
    }
  }

  async function cancelDeletion() {
    setBusy("cancel");
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/account/privacy", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_deletion" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Cancellation failed.");
      setMessage("Deletion request cancelled.");
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Cancellation failed.");
    } finally {
      setBusy("");
    }
  }

  const pendingDeletion = requests.find((row) => row.request_type === "delete" && row.status === "pending");

  return (
    <AccountShell>
      <section className="border-b border-white/10 p-6 md:p-8">
        <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">V21 Privacy Operations</p>
        <h1 className="mt-4 text-3xl font-black md:text-4xl">Your data & account</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Download a machine-readable copy of your marketplace data or schedule account deletion with a reversible grace period.</p>
      </section>

      <section className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
        <article className="rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-xl font-black">Download your data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Includes profile, billing, orders, wallet activity, disputes, notifications, wishlist, security events, and privacy history.</p>
          <button disabled={Boolean(busy)} onClick={downloadExport} className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-black text-black disabled:opacity-50">
            {busy === "export" ? "Preparing..." : "Download JSON export"}
          </button>
        </article>

        <article className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
          <h2 className="text-xl font-black text-red-300">Delete account</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Deletion is scheduled after {graceDays} days. Personal and behavioral data is removed or anonymized; financial, tax, fraud-prevention, dispute, and audit records may be retained where required.</p>
          {pendingDeletion ? (
            <div className="mt-5">
              <p className="text-sm text-yellow-300">Scheduled for {pendingDeletion.scheduled_for ? new Date(pendingDeletion.scheduled_for).toLocaleString("id-ID") : "processing"}</p>
              <button disabled={Boolean(busy)} onClick={cancelDeletion} className="mt-4 rounded-xl border border-white/20 px-5 py-3 font-black disabled:opacity-50">
                {busy === "cancel" ? "Cancelling..." : "Cancel deletion"}
              </button>
            </div>
          ) : (
            <button disabled={Boolean(busy)} onClick={requestDeletion} className="mt-6 rounded-xl bg-red-400 px-5 py-3 font-black text-black disabled:opacity-50">
              {busy === "delete" ? "Scheduling..." : "Schedule account deletion"}
            </button>
          )}
        </article>
      </section>

      {(error || message) && <div className={`mx-6 mb-6 rounded-xl border p-4 text-sm md:mx-8 md:mb-8 ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || message}</div>}

      <section className="border-t border-white/10 p-6 md:p-8">
        <h2 className="text-xl font-black">Request history</h2>
        {loading ? <p className="mt-4 text-slate-400">Loading...</p> : (
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? <p className="text-slate-500">No privacy requests yet.</p> : requests.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-3"><strong className="capitalize">{row.request_type}</strong><span className="capitalize text-cyan-300">{row.status}</span></div>
                <p className="mt-2 text-slate-500">Requested {new Date(row.requested_at).toLocaleString("id-ID")}</p>
                {row.failure_reason && <p className="mt-2 text-red-300">{row.failure_reason}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </AccountShell>
  );
}
