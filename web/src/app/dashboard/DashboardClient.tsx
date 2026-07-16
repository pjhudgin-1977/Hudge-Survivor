"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Membership = {
  pool_id: string;
  screen_name?: string | null;
  pool_name?: string | null;
};

function extractPoolId(input: string): string | null {
  const value = String(input || "").trim();

  const match = value.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  return match ? match[0] : null;
}

export default function DashboardClient() {
  const router = useRouter();
  

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [joinText, setJoinText] = useState("");
  const [joinErr, setJoinErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadDashboard() {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: memberRows, error: memberError } = await supabase
  .from("pool_members")
  .select("pool_id, screen_name")
  .eq("user_id", user.id)
  .order("pool_id", { ascending: false });

if (memberError) {
  setErr(memberError.message);
  setLoading(false);
  return;
}

const poolIds = Array.from(
  new Set((memberRows ?? []).map((row) => row.pool_id))
);

const poolNameMap = new Map<string, string>();

if (poolIds.length > 0) {
  const { data: poolRows, error: poolError } = await supabase
    .from("pools")
    .select("id, name")
    .in("id", poolIds);

  if (poolError) {
    setErr(poolError.message);
    setLoading(false);
    return;
  }

  for (const pool of poolRows ?? []) {
    poolNameMap.set(pool.id, pool.name || "Unnamed Pool");
  }
}

const list = (memberRows ?? []).map((row) => ({
  pool_id: row.pool_id,
  screen_name: row.screen_name,
  pool_name: poolNameMap.get(row.pool_id) ?? "Unnamed Pool",
})) as Membership[];

      setMemberships(list);

      if (list.length === 1 && list[0]?.pool_id) {
        router.replace(`/pool/${list[0].pool_id}`);
        return;
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  function onQuickJoin() {
    setJoinErr(null);

    const poolId = extractPoolId(joinText);

    if (!poolId) {
      setJoinErr("Paste a valid pool invite link or pool ID.");
      return;
    }

    router.push(`/join/${poolId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-6xl">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <h1 className="text-3xl font-bold text-white">Home</h1>

          <p className="mt-2 text-sm text-slate-300">
            Signed in as <strong className="text-white">{email}</strong>
          </p>
        </section>

        
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white">Join a Pool</h2>

            <p className="mt-1 text-sm text-slate-300">
              Paste an invite link or pool ID and we’ll take you to the join
              page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[260px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="Paste invite link or pool ID…"
              value={joinText}
              onChange={(event) => setJoinText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onQuickJoin();
              }}
            />

            <button
              type="button"
              className="rounded-lg border border-orange-400 bg-orange-500 px-5 py-2 font-bold text-black transition hover:bg-orange-400"
              onClick={onQuickJoin}
            >
              Join
            </button>

            
          </div>

          {joinErr ? (
            <div className="text-sm font-semibold text-red-300">{joinErr}</div>
          ) : null}
        </section>

        {err ? (
          <section className="rounded-2xl border border-red-400/40 bg-slate-900 p-4 text-red-200 shadow-lg">
            Error loading pools: <span className="text-red-300">{err}</span>
          </section>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
          <h2 className="text-xl font-bold text-white">Your Pools</h2>

          {memberships.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-slate-300">
              You’re not in any pools yet. Ask your commissioner for an invite
              link.
            </div>
          ) : (
            <div className="grid gap-4">
              {memberships.map((membership) => (
                <div
                  key={membership.pool_id}
                  className="rounded-xl border border-slate-600 bg-slate-800 p-4 shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <Link
                        className="text-lg font-bold text-orange-300 hover:text-orange-200 hover:underline"
                        href={`/pool/${membership.pool_id}`}
                      >
                        {membership.pool_name || "Unnamed Pool"}
                      </Link>

                      {membership.screen_name ? (
                        <div className="mt-1 text-sm text-slate-300">
                          Playing as{" "}
                          <strong className="text-white">
                            {membership.screen_name}
                          </strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <Link
                        className="rounded-lg bg-orange-500 px-3 py-2 font-bold text-black transition hover:bg-orange-400"
                        href={`/pool/${membership.pool_id}`}
                      >
                        Standings
                      </Link>

                      <Link
                        className="rounded-lg bg-slate-600 px-3 py-2 font-bold text-white transition hover:bg-slate-500"
                        href={`/pool/${membership.pool_id}/pick`}
                      >
                        Pick
                      </Link>

                      <Link
                        className="rounded-lg bg-slate-600 px-3 py-2 font-bold text-white transition hover:bg-slate-500"
                        href={`/pool/${membership.pool_id}/sweat`}
                      >
                        Sweat
                      </Link>

                      <Link
                        className="rounded-lg bg-slate-600 px-3 py-2 font-bold text-white transition hover:bg-slate-500"
                        href={`/pool/${membership.pool_id}/standings2`}
                      >
                        Latest Picks
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}