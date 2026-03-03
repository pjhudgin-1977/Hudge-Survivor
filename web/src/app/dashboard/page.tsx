"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Membership = {
  pool_id: string;
  screen_name?: string | null;
};

function extractPoolId(input: string): string | null {
  const s = String(input || "").trim();

  // UUID match (works for full URLs too)
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

export default function DashboardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const onboardingJoinOnly = useMemo(() => sp.get("onboarding") === "joinonly", [sp]);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [joinText, setJoinText] = useState("");
  const [joinErr, setJoinErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("pool_members")
        .select("pool_id, screen_name")
        .eq("user_id", user.id)
        .order("pool_id", { ascending: false });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const list = (data ?? []) as Membership[];
      setMemberships(list);

      // ✅ If the user is in exactly one pool, land them on the pool Standings (grid) page
      if (list.length === 1 && list[0]?.pool_id) {
        router.replace(`/pool/${list[0].pool_id}`);
        return;
      }

      setLoading(false);
    })();
  }, [router]);

  function onQuickJoin() {
    setJoinErr(null);

    const pid = extractPoolId(joinText);
    if (!pid) {
      setJoinErr("Paste a valid invite link or pool id (UUID).");
      return;
    }

    // Send them to the join flow
    router.push(`/join/${pid}`);
  }

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }

  return (
    <main className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-semibold">Home</h1>

      <p className="opacity-80">
        Signed in as <strong>{email}</strong>
      </p>

      {onboardingJoinOnly ? (
        <div className="rounded-xl border p-4 bg-yellow-50/5">
          <div className="font-semibold">Pool creation is disabled</div>
          <div className="opacity-80 mt-1 text-sm">
            To get started, you’ll need an invite link from a commissioner.
          </div>
        </div>
      ) : null}

      {/* Join-only onboarding card */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="font-semibold">Join a Pool</div>
        <div className="opacity-70 text-sm">
          Paste an invite link or pool id and we’ll take you to the join page.
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border p-2 flex-1 min-w-[260px] rounded-lg bg-transparent"
            placeholder="Paste invite link or pool id…"
            value={joinText}
            onChange={(e) => setJoinText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onQuickJoin();
            }}
          />

          <button
            className="px-4 py-2 rounded-lg border font-semibold"
            onClick={onQuickJoin}
          >
            Join
          </button>

          <Link className="px-4 py-2 rounded-lg border font-semibold" href="/join">
            Open Join Page
          </Link>
        </div>

        {joinErr ? <div className="text-sm text-red-400">{joinErr}</div> : null}
      </div>

      {err ? (
        <div className="rounded-xl border p-3">
          Error loading pools: <span className="opacity-70">{err}</span>
        </div>
      ) : null}

      {/* Pools list (only if multi-pool) */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="font-semibold">Your Pools</div>

        {memberships.length === 0 ? (
          <div className="opacity-70">
            You’re not in any pools yet. Ask your commissioner for an invite link.
          </div>
        ) : (
          <div className="grid gap-3">
            {memberships.map((m) => (
              <div key={m.pool_id} className="rounded-xl border p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="font-semibold">
                    <Link className="underline" href={`/pool/${m.pool_id}`}>
                      {m.pool_id}
                    </Link>
                    {m.screen_name ? (
                      <span className="opacity-70"> — as {m.screen_name}</span>
                    ) : null}
                  </div>

                  <div className="flex gap-3 flex-wrap text-sm">
                    <Link className="underline" href={`/pool/${m.pool_id}`}>
                      Standings
                    </Link>
                    <Link className="underline" href={`/pool/${m.pool_id}/pick`}>
                      Pick
                    </Link>
                    <Link className="underline" href={`/pool/${m.pool_id}/sweat`}>
                      Sweat
                    </Link>
                    <Link className="underline" href={`/pool/${m.pool_id}/standings2`}>
                      Latest Picks
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No Create Pool link here (Join-only platform rule) */}
    </main>
  );
}