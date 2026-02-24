"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type PoolState = {
  pool_id: string;
  season_year: number;
  week_type: string;
  week_number: number;
  picks_locked: boolean;
  updated_at: string;
};

export default function PoolAdminPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const [poolId, setPoolId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [weekType, setWeekType] = useState<string>("REG");
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [picksLocked, setPicksLocked] = useState<boolean>(false);

  useEffect(() => {
    params.then(({ poolId }) => setPoolId(poolId));
  }, [params]);

  useEffect(() => {
    if (!poolId) return;

    const supabase = createClient();

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setErr("Not logged in. Go to /login first.");
        setLoading(false);
        return;
      }

      // Ensure there is a pool_state row for this pool (upsert)
      const { error: upsertErr } = await supabase
        .from("pool_state")
        .upsert({ pool_id: poolId }, { onConflict: "pool_id" });

      if (upsertErr) {
        setErr(upsertErr.message);
        setLoading(false);
        return;
      }

      // Load pool_state
      const { data, error } = await supabase
        .from("pool_state")
        .select("*")
        .eq("pool_id", poolId)
        .single<PoolState>();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      setSeasonYear(data.season_year);
      setWeekType(data.week_type);
      setWeekNumber(data.week_number);
      setPicksLocked(data.picks_locked);

      setLoading(false);
    })();
  }, [poolId]);

  async function save() {
    if (!poolId) return;
    const supabase = createClient();

    setSaving(true);
    setErr(null);

    const { error } = await supabase
      .from("pool_state")
      .update({
        season_year: seasonYear,
        week_type: weekType,
        week_number: weekNumber,
        picks_locked: picksLocked,
      })
      .eq("pool_id", poolId);

    if (error) setErr(error.message);
    setSaving(false);
  }

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }
async function advanceWeek() {
  if (!poolId) return;

  const supabase = createClient();

  const { data, error } = await supabase
    .from("pool_state")
    .update({
      week_number: weekNumber + 1,
      picks_locked: false,
    })
    .eq("pool_id", poolId)
    .select()
    .single();

  if (error) {
    setErr(error.message);
    return;
  }

  setWeekNumber(data.week_number);
  setPicksLocked(data.picks_locked);
}
  return (
    <main className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Pool Admin</h1>

      <div className="opacity-70">
        Pool: <code>{poolId}</code>
      </div>

      {err ? (
        <div className="rounded-xl border p-3">
          <div className="font-semibold">Error</div>
          <div className="opacity-70">{err}</div>
        </div>
      ) : null}

      <div className="rounded-xl border p-4 space-y-4">
        <div className="font-semibold">Current Week</div>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Season Year</div>
          <input
            className="w-full rounded-lg border px-3 py-2 bg-transparent"
            type="number"
            value={seasonYear}
            onChange={(e) => setSeasonYear(parseInt(e.target.value || "0", 10))}
          />
        </label>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Week Type</div>
          <select
            className="w-full rounded-lg border px-3 py-2 bg-transparent"
            value={weekType}
            onChange={(e) => setWeekType(e.target.value)}
          >
            <option value="REG">REG</option>
            <option value="POST">POST</option>
          </select>
        </label>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Week Number</div>
          <input
            className="w-full rounded-lg border px-3 py-2 bg-transparent"
            type="number"
            value={weekNumber}
            onChange={(e) => setWeekNumber(parseInt(e.target.value || "0", 10))}
            min={1}
            max={30}
          />
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={picksLocked}
            onChange={(e) => setPicksLocked(e.target.checked)}
          />
          <span className="text-sm">Picks Locked</span>
        </label>

        <button
  className="rounded-xl border px-4 py-2 hover:bg-white/5"
  onClick={save}
  disabled={saving}
>
  {saving ? "Saving…" : "Save"}
</button>

<button
  className="rounded-xl border px-4 py-2 hover:bg-white/5"
  onClick={advanceWeek}
>
  Advance to Next Week →
</button>
      </div>
    </main>
  );
}