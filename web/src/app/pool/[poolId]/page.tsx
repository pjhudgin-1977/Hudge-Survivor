"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PoolHomePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const [poolId, setPoolId] = useState("");

  useEffect(() => {
    params.then(({ poolId }) => setPoolId(poolId));
  }, [params]);

  if (!poolId) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Pool Home</h1>

      <div className="opacity-70">
        Pool: <code>{poolId}</code>
      </div>

      <div className="grid gap-3">
        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/pick`}>
          <div className="font-semibold">Make Pick</div>
          <div className="text-sm opacity-70">Choose your team for this week</div>
        </Link>

        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/sweat`}>
          <div className="font-semibold">Sweat</div>
          <div className="text-sm opacity-70">Live view of picks and game status</div>
        </Link>

        <Link className="rounded-xl border p-4 hover:bg-white/5" href={`/pool/${poolId}/standings`}>
          <div className="font-semibold">Standings</div>
          <div className="text-sm opacity-70">Who’s alive / eliminated</div>
        </Link>
      </div>
    </main>
  );
}