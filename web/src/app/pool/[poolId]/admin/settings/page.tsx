"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PoolRow = {
  id: string;
  pool_name: string | null;
  season_year: number | null;
  entry_fee_cents: number | null;
  is_public: boolean | null;
  max_losses: number | null;
};

export default function PoolSettingsPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [poolName, setPoolName] = useState("");
  const [seasonYear, setSeasonYear] = useState<number>(2025);
  const [entryFeeDollars, setEntryFeeDollars] = useState<string>("0");
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [maxLosses, setMaxLosses] = useState<number>(2);

  async function load() {
    setLoading(true);
    setErr("");
    setOkMsg("");

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        window.location.href = "/login";
        return;
      }

      // Commissioner gate
      const { data: gate, error: gateErr } = await supabase
        .from("pool_members")
        .select("is_commissioner")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (gateErr || !gate?.is_commissioner) {
        window.location.href = `/pool/${poolId}/admin`;
        return;
      }

      // Load pool settings
      const { data: pool, error: poolErr } = await supabase
        .from("pools")
        .select("id, pool_name, season_year, entry_fee_cents, is_public, max_losses")
        .eq("id", poolId)
        .maybeSingle();

      if (poolErr) throw new Error(poolErr.message);
      const p = pool as PoolRow | null;
      if (!p) throw new Error("Pool not found");

      setPoolName(p.pool_name ?? "My Survivor Pool");
      setSeasonYear(Number(p.season_year ?? 2025));
      setEntryFeeDollars(String(((p.entry_fee_cents ?? 0) / 100).toFixed(0)));
      setIsPublic(Boolean(p.is_public ?? false));
      setMaxLosses(Number(p.max_losses ?? 2));

      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!poolId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  async function save() {
    setErr("");
    setOkMsg("");
    setSaving(true);

    try {
      const feeDollarsNum = Number(entryFeeDollars);
      const entry_fee_cents = Math.max(0, Math.floor((Number.isFinite(feeDollarsNum) ? feeDollarsNum : 0) * 100));

      const res = await fetch(`${window.location.origin}/api/pool/update-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          poolId,
          pool_name: poolName,
          season_year: Number(seasonYear),
          entry_fee_cents,
          is_public: Boolean(isPublic),
          max_losses: Number(maxLosses),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`API returned non-JSON (${res.status}). First chars: ${text.slice(0, 60)}`);
      }

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Save failed");

      setOkMsg("✅ Saved!");
      setTimeout(() => setOkMsg(""), 2000);
      setSaving(false);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
      setSaving(false);
    }
  }

  if (!poolId) return <main className="p-6">Missing poolId.</main>;

  return (
    <main className="p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pool Settings</h1>
          <p className="text-sm opacity-80 mt-1">
            Pool: <span className="font-mono">{poolId}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/pool/${poolId}/admin`}
            className="px-3 py-2 rounded-lg border text-sm font-semibold hover:opacity-90"
          >
            ← Admin
          </Link>
          <Link
            href={`/pool/${poolId}`}
            className="px-3 py-2 rounded-lg border text-sm font-semibold hover:opacity-90"
          >
            Pool Home
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-bold">General</h2>

        {loading ? <div className="mt-3 text-sm opacity-70">Loading…</div> : null}

        {err ? (
          <div className="mt-4 rounded-xl border border-black/20 bg-black/5 p-3 text-sm">
            <div className="font-semibold">Error</div>
            <div className="opacity-80 mt-1">{err}</div>
          </div>
        ) : null}

        {okMsg ? (
          <div className="mt-4 rounded-xl border border-black/20 bg-black/5 p-3 text-sm font-semibold">
            {okMsg}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Pool name</span>
            <input
              className="rounded-xl border p-3"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="My Survivor Pool"
              disabled={loading || saving}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Season year</span>
            <input
              className="rounded-xl border p-3"
              type="number"
              value={seasonYear}
              onChange={(e) => setSeasonYear(Number(e.target.value))}
              disabled={loading || saving}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Entry fee (dollars)</span>
            <input
              className="rounded-xl border p-3"
              type="number"
              value={entryFeeDollars}
              onChange={(e) => setEntryFeeDollars(e.target.value)}
              disabled={loading || saving}
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={loading || saving}
            />
            <div>
              <div className="font-semibold">Public pool</div>
              <div className="text-sm opacity-70">
                If off, only people with an invite link can join.
              </div>
            </div>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Max losses allowed</span>
            <select
              className="rounded-xl border p-3"
              value={maxLosses}
              onChange={(e) => setMaxLosses(Number(e.target.value))}
              disabled={loading || saving}
            >
              <option value={1}>1 (single elimination)</option>
              <option value={2}>2 (double elimination)</option>
              <option value={3}>3</option>
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              className="px-4 py-3 rounded-xl border text-sm font-extrabold hover:opacity-90"
              disabled={loading || saving}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>

            <button
              onClick={load}
              className="px-4 py-3 rounded-xl border text-sm font-semibold hover:opacity-90"
              disabled={loading || saving}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}