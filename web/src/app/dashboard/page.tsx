"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Membership = {
  pool_id: string;
  screen_name?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        // IMPORTANT: client-side redirect (prevents the server loop)
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

     

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }

  return (
    <main className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="opacity-80">
        Signed in as <strong>{email}</strong>
      </p>

      <div className="flex gap-4 flex-wrap">
        <Link className="underline" href="/create-pool">
          Create Pool
        </Link>
        <Link className="underline" href="/join">
          Join Pool
        </Link>
      </div>

      {err ? (
        <div className="rounded-xl border p-3">
          Error loading pools: <span className="opacity-70">{err}</span>
        </div>
      ) : null}

      <div className="rounded-xl border p-4 space-y-3">
        <div className="font-semibold">Your Pools</div>

        {memberships.length === 0 ? (
          <div className="opacity-70">
            You’re not in any pools yet.{" "}
            <Link className="underline" href="/join">
              Join a pool
            </Link>
            .
          </div>
        ) : (
          <ul className="list-disc pl-5 space-y-3">
            {memberships.map((m) => (
              <li key={m.pool_id}>
                <Link className="underline" href={`/pool/${m.pool_id}`}>
                  {m.pool_id}
                </Link>
                {m.screen_name ? (
                  <span className="opacity-70"> — as {m.screen_name}</span>
                ) : null}

                <div className="mt-1 flex gap-3 flex-wrap text-sm">
                  <Link className="underline" href={`/pool/${m.pool_id}/pick`}>
                    Pick
                  </Link>
                  <Link className="underline" href={`/pool/${m.pool_id}/standings`}>
                    Standings
                  </Link>
                  <Link className="underline" href={`/pool/${m.pool_id}/sweat`}>
                    Sweat
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}