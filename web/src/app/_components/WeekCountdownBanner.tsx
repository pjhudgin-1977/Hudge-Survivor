"use client";

import { useEffect, useMemo, useState } from "react";

type WeekStatus = {
  label: string;
  kickoff_at: string;
  is_locked: boolean;
  ms_until_lock: number;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  // If we ever show days (we usually won't past 7d), keep it readable
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function fmtLockDate(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WeekCountdownBanner({ poolId }: { poolId: string }) {
  const [data, setData] = useState<WeekStatus | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  // initial fetch + refresh every 60s (server source of truth)
  useEffect(() => {
    let mounted = true;

    async function load() {
      const res = await fetch(`/api/pool/${poolId}/week-status`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as WeekStatus;
      if (!mounted) return;
      setData(json);
      setRemainingMs(json.ms_until_lock ?? 0);
    }

    load();
    const interval = setInterval(load, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [poolId]);

  // local 1s countdown tick ONLY when we are within 7 days
  useEffect(() => {
    if (!data) return;
    if (data.is_locked) return;
    if (remainingMs > SEVEN_DAYS_MS) return;

    const t = setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1000));
    }, 1000);

    return () => clearInterval(t);
  }, [data, remainingMs]);

  const isLocked = useMemo(() => {
    if (!data) return false;
    return data.is_locked || remainingMs <= 0;
  }, [data, remainingMs]);

  if (!data) return null;

  const kickoffLabel = fmtLockDate(data.kickoff_at);

  const rightText = isLocked
    ? { main: "Picks are locked", sub: `Kickoff: ${kickoffLabel}` }
    : remainingMs > SEVEN_DAYS_MS
    ? { main: `Locks on ${kickoffLabel}`, sub: "Countdown starts 7 days before kickoff" }
    : { main: `Locks in ${fmtCountdown(remainingMs)}`, sub: `Kickoff: ${kickoffLabel}` };

  return (
    <div className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            {data.label}
          </span>

          {isLocked ? (
            <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-semibold text-red-200">
              LOCKED
            </span>
          ) : (
            <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
              OPEN
            </span>
          )}
        </div>

        <div className="text-xs text-slate-300">
          <span className={isLocked ? "font-semibold text-red-200" : "font-semibold text-slate-100"}>
            {rightText.main}
          </span>
        </div>
      </div>

      <div className="mt-1 text-[11px] text-slate-400">{rightText.sub}</div>
    </div>
  );
}