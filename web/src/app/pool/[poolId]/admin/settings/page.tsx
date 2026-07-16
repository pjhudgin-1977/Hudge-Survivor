"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PoolRow = {
  id: string;
  name: string | null;
  pool_name: string | null;
  season_year: number | null;
  entry_fee_cents: number | null;
  is_public: boolean | null;
  max_losses: number | null;
};

export default function PoolSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [poolName, setPoolName] = useState("");
  const [deletePoolName, setDeletePoolName] = useState("");
  const [seasonYear, setSeasonYear] = useState<number>(2026);
  const [entryFeeDollars, setEntryFeeDollars] = useState("0");
  const [isPublic, setIsPublic] = useState(false);
  const [maxLosses, setMaxLosses] = useState(2);

  const [deleteNameConfirmation, setDeleteNameConfirmation] = useState("");
  const [deleteWordConfirmation, setDeleteWordConfirmation] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    setOkMsg("");
    setDeleteError("");

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user) {
        window.location.href = "/login";
        return;
      }

      const { data: memberRows, error: gateErr } = await supabase
        .from("pool_members")
        .select("is_commissioner, role")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id);

      const isCommissioner = (memberRows ?? []).some(
        (row) =>
          Boolean(row?.is_commissioner) ||
          String(row?.role ?? "").toLowerCase() === "commissioner" ||
          String(row?.role ?? "").toLowerCase() === "admin"
      );

      if (gateErr || !isCommissioner) {
        window.location.href = `/pool/${poolId}`;
        return;
      }

      const { data: pool, error: poolErr } = await supabase
        .from("pools")
        .select(
          "id, name, pool_name, season_year, entry_fee_cents, is_public, max_losses"
        )
        .eq("id", poolId)
        .maybeSingle();

      if (poolErr) {
        throw new Error(poolErr.message);
      }

      const loadedPool = pool as PoolRow | null;

      if (!loadedPool) {
        throw new Error("Pool not found");
      }

      const readableName =
        loadedPool.name?.trim() ||
        loadedPool.pool_name?.trim() ||
        "My Survivor Pool";

      setPoolName(readableName);
      setDeletePoolName(loadedPool.name?.trim() || readableName);
      setSeasonYear(Number(loadedPool.season_year ?? 2026));
      setEntryFeeDollars(
        String(((loadedPool.entry_fee_cents ?? 0) / 100).toFixed(0))
      );
      setIsPublic(Boolean(loadedPool.is_public ?? false));
      setMaxLosses(Number(loadedPool.max_losses ?? 2));
    } catch (error: any) {
      setErr(error?.message ?? "Unknown error");
    } finally {
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
      const cleanPoolName = poolName.trim();

      if (cleanPoolName.length < 3 || cleanPoolName.length > 60) {
        throw new Error("Pool name must be between 3 and 60 characters.");
      }

      const feeDollarsNumber = Number(entryFeeDollars);

      const entryFeeCents = Math.max(
        0,
        Math.floor(
          (Number.isFinite(feeDollarsNumber) ? feeDollarsNumber : 0) * 100
        )
      );

      const response = await fetch(
        `${window.location.origin}/api/pool/update-settings`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            poolId,
            name: cleanPoolName,
            pool_name: cleanPoolName,
            season_year: Number(seasonYear),
            entry_fee_cents: entryFeeCents,
            is_public: Boolean(isPublic),
            max_losses: Number(maxLosses),
          }),
        }
      );

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();

        throw new Error(
          `API returned non-JSON (${response.status}). First characters: ${text.slice(
            0,
            60
          )}`
        );
      }

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json?.error ?? "Save failed");
      }

      setOkMsg("✅ Settings saved.");
      setTimeout(() => setOkMsg(""), 2500);
    } catch (error: any) {
      setErr(error?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deletePool() {
    setDeleteError("");

    if (deleteNameConfirmation.trim() !== deletePoolName) {
      setDeleteError("The pool name does not match exactly.");
      return;
    }

    if (deleteWordConfirmation.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Type DELETE in the second confirmation field.');
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${deletePoolName}"?\n\nThis will delete all entries, picks, messages, invites, used teams, pool settings, and related pool history. This cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/pool/${poolId}/admin/delete`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            confirmationName: deleteNameConfirmation.trim(),
            confirmationWord: deleteWordConfirmation.trim(),
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json?.error ?? "Pool deletion failed");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error: any) {
      setDeleteError(error?.message ?? "Pool deletion failed");
      setDeleting(false);
    }
  }

  if (!poolId) {
    return <main className="p-6">Missing pool ID.</main>;
  }

  const deleteReady =
    deleteNameConfirmation.trim() === deletePoolName &&
    deleteWordConfirmation.trim().toUpperCase() === "DELETE" &&
    !deleting;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Pool Settings
            </h1>

            <p className="mt-1 text-sm text-slate-300">
              {deletePoolName || poolId}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/pool/${poolId}/admin`}
              className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              ← Admin
            </Link>

            <Link
              href={`/pool/${poolId}`}
              className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Pool Home
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
          <h2 className="text-xl font-bold text-white">General Settings</h2>

          {loading ? (
            <div className="mt-4 text-sm text-slate-300">Loading…</div>
          ) : null}

          {err ? (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">
              <div className="font-bold">Error</div>
              <div className="mt-1">{err}</div>
            </div>
          ) : null}

          {okMsg ? (
            <div className="mt-4 rounded-xl border border-green-400/40 bg-green-400/10 p-3 text-sm font-semibold text-green-200">
              {okMsg}
            </div>
          ) : null}

          <div className="mt-5 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Pool name</span>

              <input
                className="rounded-xl border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                value={poolName}
                onChange={(event) => setPoolName(event.target.value)}
                placeholder="My Survivor Pool"
                maxLength={60}
                disabled={loading || saving || deleting}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Season year</span>

              <input
                className="rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
                type="number"
                min="2026"
                max="2035"
                value={seasonYear}
                onChange={(event) =>
                  setSeasonYear(Number(event.target.value))
                }
                disabled={loading || saving || deleting}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">
                Entry fee (dollars)
              </span>

              <input
                className="rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
                type="number"
                min="0"
                value={entryFeeDollars}
                onChange={(event) =>
                  setEntryFeeDollars(event.target.value)
                }
                disabled={loading || saving || deleting}
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-600 bg-slate-800 p-4">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                disabled={loading || saving || deleting}
              />

              <div>
                <div className="font-bold text-white">Public pool</div>

                <div className="text-sm text-slate-300">
                  If off, only people with an invite link can join.
                </div>
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">
                Max losses allowed
              </span>

              <select
                className="rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
                value={maxLosses}
                onChange={(event) =>
                  setMaxLosses(Number(event.target.value))
                }
                disabled={loading || saving || deleting}
              >
                <option value={1}>1 — Single elimination</option>
                <option value={2}>2 — Double elimination</option>
                <option value={3}>3 losses</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-extrabold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                disabled={loading || saving || deleting}
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>

              <button
                type="button"
                onClick={load}
                className="rounded-xl border border-slate-500 bg-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-60"
                disabled={loading || saving || deleting}
              >
                Reload
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-500/50 bg-slate-900 p-5 shadow-lg">
          <h2 className="text-xl font-bold text-red-300">Danger Zone</h2>

          <p className="mt-2 text-sm text-slate-300">
            Permanently deleting this pool removes its players, entries,
            picks, messages, invites, used teams, locks, and pool history.
            User login accounts will not be deleted.
          </p>

          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="font-bold text-white">
              Delete {deletePoolName || "this pool"}
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-200">
                Type the exact pool name:
              </span>

              <div className="mt-1 rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm text-red-200">
                {deletePoolName}
              </div>

              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                placeholder="Exact pool name"
                value={deleteNameConfirmation}
                onChange={(event) =>
                  setDeleteNameConfirmation(event.target.value)
                }
                autoComplete="off"
                disabled={loading || deleting}
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-200">
                Type DELETE:
              </span>

              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                placeholder="DELETE"
                value={deleteWordConfirmation}
                onChange={(event) =>
                  setDeleteWordConfirmation(event.target.value)
                }
                autoComplete="off"
                disabled={loading || deleting}
              />
            </label>

            {deleteError ? (
              <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm font-semibold text-red-200">
                {deleteError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={deletePool}
              disabled={!deleteReady}
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-extrabold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {deleting ? "Deleting Pool…" : "Permanently Delete Pool"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}