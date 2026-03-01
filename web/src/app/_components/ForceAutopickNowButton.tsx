"use client";

import { useState } from "react";

export default function ForceAutopickNowButton({ poolId }: { poolId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (loading) return;

    const yes = window.confirm(
      "Force Autopick Now?\n\nThis will submit picks for any alive players who have NOT picked yet for the current week."
    );
    if (!yes) return;

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/pool/${poolId}/admin/force-autopick`, {
        method: "POST",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setMsg(`❌ ${json?.error ?? "Failed"}`);
      } else {
        const inserted = json?.autopicks_inserted ?? 0;
        const label = json?.week_number
          ? `Week ${json.week_number}`
          : "this week";
        setMsg(`✅ Autopicks inserted: ${inserted} (${label})`);

        // Optional: refresh the page so standings/sweat updates immediately
        window.location.reload();
      }
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Network error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">
            Admin Actions
          </div>
          <div className="text-xs text-slate-400">
            Force picks for users who haven’t picked yet (alive only)
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Running..." : "Force Autopick Now"}
        </button>
      </div>

      {msg ? <div className="mt-2 text-xs text-slate-200">{msg}</div> : null}
    </div>
  );
}