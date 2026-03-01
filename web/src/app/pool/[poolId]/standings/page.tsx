"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Status = "SAFE" | "ON_LAST_LIFE" | "ELIMINATED";

type Row = {
  user_id: string;
  screen_name: string;
  losses: number;
  is_eliminated: boolean;
  strikes_left: number;
  status: Status;

  // Latest pick
  latest_pick_team?: string | null;
  latest_pick_week?: number | null;
  latest_pick_phase?: string | null;
  latest_pick_result?: string | null;
  latest_pick_was_autopick?: boolean | null;
};

function AutoPill() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 10,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(0,0,0,0.25)",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.6,
        verticalAlign: "middle",
      }}
      title="This pick was automatically made by the system (Autopick)."
      aria-label="Autopick"
    >
      <span aria-hidden="true">⚙️</span>
      AUTO
    </span>
  );
}

export default function StandingsPage() {
  const router = useRouter();
  const params = useParams();
  const poolId = params.poolId as string;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      if (!poolId || poolId === "undefined") {
        setErr("Missing poolId in URL.");
        setLoading(false);
        return;
      }

      // 1) Load pool members (base standings)
      const { data: members, error: memErr } = await supabase
        .from("pool_members")
        .select("user_id, screen_name, losses, is_eliminated")
        .eq("pool_id", poolId);

      if (memErr) {
        setErr(memErr.message);
        setLoading(false);
        return;
      }

      // 2) Load latest pick per user for this pool
      // We'll do it in one query, then reduce to latest per user by submitted_at
      const { data: picks, error: pickErr } = await supabase
        .from("picks")
        .select("user_id, week_number, phase, picked_team, submitted_at, result, was_autopick")
        .eq("pool_id", poolId)
        .order("submitted_at", { ascending: false });

      if (pickErr) {
        setErr(pickErr.message);
        setLoading(false);
        return;
      }

      const latestByUser = new Map<string, any>();
      for (const p of picks ?? []) {
        const uid = String((p as any).user_id);
        if (!latestByUser.has(uid)) latestByUser.set(uid, p);
      }

      const mapped: Row[] = (members ?? []).map((r: any) => {
        const losses = Number(r.losses ?? 0);
        const eliminatedByLosses = losses >= 2;
        const is_eliminated = Boolean(r.is_eliminated) || eliminatedByLosses;

        const strikes_left = Math.max(0, 2 - losses);

        let status: Status = "SAFE";
        if (is_eliminated) status = "ELIMINATED";
        else if (losses === 1) status = "ON_LAST_LIFE";

        const lp = latestByUser.get(String(r.user_id)) ?? null;

        return {
          user_id: r.user_id,
          screen_name: r.screen_name,
          losses,
          is_eliminated,
          strikes_left,
          status,

          latest_pick_team: lp?.picked_team ?? null,
          latest_pick_week: lp?.week_number ?? null,
          latest_pick_phase: lp?.phase ?? null,
          latest_pick_result: lp?.result ?? null,
          latest_pick_was_autopick: lp?.was_autopick ?? null,
        };
      });

      setRows(mapped);
      setLoading(false);
    })();
  }, [router, poolId]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDead = a.is_eliminated ? 1 : 0;
      const bDead = b.is_eliminated ? 1 : 0;
      if (aDead !== bDead) return aDead - bDead;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.screen_name.localeCompare(b.screen_name);
    });
  }, [rows]);

  const alive = sorted.filter((r) => !r.is_eliminated).length;
  const eliminated = sorted.length - alive;

  function statusBadge(r: Row) {
    if (r.status === "ELIMINATED")
      return <span style={badgeGray}>❌ Eliminated</span>;
    if (r.status === "ON_LAST_LIFE")
      return <span style={badgeOrange}>⚠️ Last Life</span>;
    return <span style={badgeNavy}>🐻 Alive</span>;
  }

  function pickLabel(r: Row) {
    if (!r.latest_pick_team) return "—";
    const phase = String(r.latest_pick_phase ?? "").toLowerCase();
    const wk = r.latest_pick_week ?? null;

    const wkLabel =
      wk == null ? "" : phase === "playoffs" ? ` (P${wk})` : ` (W${wk})`;

    return `${r.latest_pick_team}${wkLabel}`;
  }

  function resultBadge(r: Row) {
    const res = String(r.latest_pick_result ?? "").toLowerCase();
    if (!res) return <span style={badgeThin}>—</span>;

    // Tie counts as loss per your rule, so show it “bad”
    if (res.includes("win")) return <span style={badgeGreen}>WIN</span>;
    if (res.includes("tie")) return <span style={badgeRed}>TIE*</span>;
    if (res.includes("loss")) return <span style={badgeRed}>LOSS</span>;

    return <span style={badgeThin}>{String(r.latest_pick_result)}</span>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Standings</h1>

      {loading && <p>Loading…</p>}
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}

      {!loading && !err && (
        <>
          <p style={{ marginTop: 8 }}>
            Alive: <strong>{alive}</strong> | Eliminated:{" "}
            <strong>{eliminated}</strong> | Total: <strong>{sorted.length}</strong>
          </p>

          <table
            border={1}
            cellPadding={6}
            style={{ marginTop: 12, width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Status</th>
                <th>Latest Pick</th>
                <th>Result</th>
                <th align="right">Losses</th>
                <th align="right">Strikes Left</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((r, idx) => (
                <tr
                  key={r.user_id}
                  style={{
                    opacity: r.is_eliminated ? 0.55 : 1,
                    background: idx % 2 ? "rgba(0,0,0,0.12)" : "transparent",
                  }}
                >
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 800 }}>{r.screen_name}</td>
                  <td>{statusBadge(r)}</td>

                  <td style={{ fontWeight: 800 }}>
                    {pickLabel(r)}
                    {r.latest_pick_was_autopick ? <AutoPill /> : null}
                  </td>

                  <td>{resultBadge(r)}</td>
                  <td align="right">{r.losses}</td>
                  <td align="right">{r.strikes_left}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
            * Tie counts as a loss in this pool.
          </p>
        </>
      )}
    </main>
  );
}

// Existing styles (kept simple + Bears-ish)
const badgeNavy: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(0, 35, 79, 0.35)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 900,
};

const badgeOrange: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255, 128, 0, 0.25)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 900,
};

const badgeGray: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 900,
};

const badgeGreen: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(0,255,0,0.16)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 900,
};

const badgeRed: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,0,0,0.16)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 900,
};

const badgeThin: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.20)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 900,
};