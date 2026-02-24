// /src/app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  // Not logged in -> go to login
  if (!user) redirect("/login");

  // Fetch pool memberships for this user (simple + reliable)
  const { data: memberships, error } = await supabase
    .from("pool_members")
    .select("pool_id, screen_name")
    .eq("user_id", user.id)
    .order("pool_id", { ascending: false });

  // Smart redirect if only one pool
  if (memberships && memberships.length === 1) {
    redirect(`/pool/${memberships[0].pool_id}`);
  }

  const poolIds = (memberships ?? []).map((m: any) => m.pool_id);

  return (
    <main className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="opacity-80">
        Signed in as <strong>{user.email}</strong>
      </p>

      <div className="flex gap-4 flex-wrap">
        <Link className="underline" href="/create-pool">
          Create Pool
        </Link>
        <Link className="underline" href="/join">
          Join Pool
        </Link>
      </div>

      <h2 className="text-lg font-semibold pt-2">Your Pools</h2>

      {error ? (
        <div className="rounded-xl border p-3">
          Error loading pools: <span className="opacity-70">{error.message}</span>
        </div>
      ) : poolIds.length ? (
        <ul className="list-disc pl-5 space-y-2">
          {memberships!.map((m: any) => (
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
      ) : (
        <p className="opacity-80">You’re not in any pools yet.</p>
      )}
    </main>
  );
}