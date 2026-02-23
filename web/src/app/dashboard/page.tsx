// /src/app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

// 👇 Use the SAME supabase client helper you already use elsewhere.
// Examples you might already have:
// import { createClient } from "@/lib/supabase/server";
// import { createClient } from "@/lib/supabase/client";
// import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server"; // <-- adjust to match your project

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in -> go to login
  if (!user) redirect("/login");

  // Fetch pools the user is a member of
  // Assumes a table like: pool_members (pool_id, user_id, screen_name, ...)
  // and pools (id, name, created_at, ...)
  const { data: memberships, error } = await supabase
    .from("pool_members")
    .select("pool_id, screen_name, pools:pool_id ( id, name )")
    .eq("user_id", user.id)
    .order("pool_id", { ascending: false });
  // Smart redirect
if (memberships && memberships.length === 1) {
  const only = memberships[0];
  redirect(`/pool/${(only as any).pools?.id ?? only.pool_id}`);
}

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Dashboard</h1>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        Signed in as <strong>{user.email}</strong>
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/create-pool">Create Pool</Link>
        <Link href="/join">Join Pool</Link>
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>
        Your Pools
      </h2>

      {error ? (
        <p style={{ marginTop: 10, color: "#b00" }}>
          Error loading pools: {error.message}
        </p>
      ) : memberships && memberships.length ? (
        <ul style={{ marginTop: 10, paddingLeft: 18 }}>
          {memberships.map((m) => (
            <li key={m.pool_id} style={{ marginBottom: 8 }}>
              <Link href={`/app/pool/${m.pool_id}`}>
                {m.pools?.name ?? m.pool_id}
              </Link>
              {m.screen_name ? (
                <span style={{ opacity: 0.75 }}> — as {m.screen_name}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          You’re not in any pools yet.
        </p>
      )}
    </main>
  );
}