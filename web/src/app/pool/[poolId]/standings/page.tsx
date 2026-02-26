"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Row = {
  user_id: string;
  screen_name: string;
  losses: number;
  is_eliminated: boolean;
};

export default function StandingsPage() {
  const router = useRouter();

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

      // One big pool: grab the pool_id from any row in v_sweat_game_board
      const { data: sample, error: sampleErr } = await supabase
        .from("v_sweat_game_board")
        .select("pool_id")
        .limit(1)
        .maybeSingle();

      if (sampleErr || !sample?.pool_id) {
        setErr("Could not determine pool_id from v_sweat_game_board.");
        setLoading(false);
        return;
      }

      const poolId = sample.pool_id as string;

      // Standings from pool_members
      const { data, error } = await supabase
        .from("pool_members")
        .select("user_id, screen_name, losses, is_eliminated")
        .eq("pool_id", poolId);

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [router]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      // alive first, then fewer losses, then name
      const aDead = a.is_eliminated ? 1 : 0;
      const bDead = b.is_eliminated ? 1 : 0;
      if (aDead !== bDead) return aDead - bDead;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.screen_name.localeCompare(b.screen_name);
    });
  }, [rows]);

  const alive = sorted.filter((r) => !r.is_eliminated).length;
  const eliminated = sorted.length - alive;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Standings</h1>

      {loading && <p>Loading…</p>}
      {err && <pre style={{ color: "crimson", marginTop: 12 }}>{err}</pre>}

      {!loading && !err && (
        <>
          <p style={{ marginTop: 8 }}>
            Alive: <strong>{alive}</strong> &nbsp;|&nbsp; Eliminated:{" "}
            <strong>{eliminated}</strong> &nbsp;|&nbsp; Total:{" "}
            <strong>{sorted.length}</strong>
          </p>

          <table border={1} cellPadding={6} style={{ marginTop: 12, width: "100%" }}>
            <thead>
              <tr>
                <th align="left">#</th>
                <th align="left">Player</th>
                <th align="left">Status</th>
                <th align="right">Losses</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={r.user_id}>
                  <td>{idx + 1}</td>
                  <td>{r.screen_name}</td>
                  <td>{r.is_eliminated ? "❌ Eliminated" : "✅ Alive"}</td>
                  <td align="right">{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}