"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  ran_at: string;
  status: "ok" | "error" | string;
  message: string | null;
  duration_ms: number | null;
  details: any | null;
};

export default function AdminAutolockPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const lastRun = runs[0] ?? null;
  const lastSuccess = runs.find((r) => r.status === "ok") ?? null;
  const hasRecentError = runs.some(
    (r) =>
      r.status === "error" &&
      Date.now() - new Date(r.ran_at).getTime() < 24 * 60 * 60 * 1000
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/autolock-runs/", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load");
      setRuns(json.runs ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>
          Admin · Autolock Runs
        </h1>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            fontWeight: 800,
            border: "1px solid rgba(0,0,0,0.12)",
            background: hasRecentError
              ? "rgba(255,0,0,0.10)"
              : "rgba(0,150,0,0.10)",
          }}
        >
          {hasRecentError ? "Health: attention" : "Health: ok"}
        </span>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Shows the latest 50 autolock executions.
      </p>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.02)",
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 800 }}>Last run</div>
          <div style={{ marginTop: 4, opacity: 0.85 }}>
            {lastRun
              ? `${new Date(lastRun.ran_at).toLocaleString()} · ${lastRun.status}`
              : "—"}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.02)",
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 800 }}>Last success</div>
          <div style={{ marginTop: 4, opacity: 0.85 }}>
            {lastSuccess ? new Date(lastSuccess.ran_at).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,0,0,0.08)",
            border: "1px solid rgba(255,0,0,0.2)",
          }}
        >
          <strong>Error:</strong> {err}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          overflowX: "auto",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.12)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.04)" }}>
              <th style={{ padding: 12 }}>Ran At</th>
              <th style={{ padding: 12 }}>Status</th>
              <th style={{ padding: 12 }}>Duration</th>
              <th style={{ padding: 12 }}>Locks Added</th>
              <th style={{ padding: 12 }}>Message</th>
            </tr>
          </thead>

          <tbody>
            {runs.map((r) => (
              <tr
                key={r.id}
                style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}
              >
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  {new Date(r.ran_at).toLocaleString()}
                </td>

                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  {r.status === "ok"
                    ? "✅ ok"
                    : r.status === "error"
                      ? "❌ error"
                      : r.status}
                </td>

                {/* ✅ Duration stays plain */}
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  {typeof r.duration_ms === "number" ? `${r.duration_ms} ms` : "—"}
                </td>

                {/* ✅ Locks Added gets the hover tooltip */}
                <td
                  style={{ padding: 12, whiteSpace: "nowrap", cursor: "help" }}
                  title={
                    r.details
                      ? `Before: ${r.details.locks_before}
After: ${r.details.locks_after}
Added: ${r.details.locks_added_this_run}`
                      : ""
                  }
                >
                  {typeof r.details?.locks_added_this_run === "number"
                    ? r.details.locks_added_this_run
                    : "—"}
                </td>

                <td style={{ padding: 12 }}>{r.message ?? "—"}</td>
              </tr>
            ))}

            {!loading && runs.length === 0 ? (
              <tr>
                <td style={{ padding: 12 }} colSpan={5}>
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, opacity: 0.7, fontSize: 14 }}>
        Tip: Trigger your cron once (or hit the cron URL manually with the secret)
        then refresh here.
      </div>
    </main>
  );
}