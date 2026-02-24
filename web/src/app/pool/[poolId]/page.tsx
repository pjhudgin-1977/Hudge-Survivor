"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Row = {
  user_id: string;
  screen_name: string;
  losses: number;
  is_eliminated: boolean;
};

export default function StandingsPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const [poolId, setPoolId] = useState<string>("");

  useEffect(() => {
    params.then(({ poolId }) => setPoolId(poolId));
  }, [params]);  
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setErr("Not logged in. Go to /login first.");
        setLoading(false);
        return;
      }

     

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
}, [poolId]);

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
