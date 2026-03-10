import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayersTable from "./PlayersTable";

export default async function AdminPlayersPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { data: members, error } = await supabase
    .from("pool_members")
    .select(
      `
      user_id,
      entry_no,
      screen_name,
      role,
      is_commissioner,
      entry_fee_paid,
      entry_fee_amount,
      losses,
      is_eliminated
    `
    )
    .eq("pool_id", poolId)
    .order("screen_name", { ascending: true })
    .order("entry_no", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin — Players</h1>
        <p style={{ marginTop: 12, color: "#f99" }}>
          Error loading players: {error.message}
        </p>
      </main>
    );
  }

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id).filter(Boolean)));

  let profilesByUserId = new Map<string, { full_name: string | null; email: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
.select("user_id, full_name, email")
.in("user_id", userIds);

    profilesByUserId = new Map(
      (profiles ?? []).map((p: any) => [
  p.user_id,
  {
    full_name: p.full_name ?? null,
    email: p.email ?? null,
  },
])
    );
  }

  const mergedMembers = (members ?? []).map((m) => {
    const profile = profilesByUserId.get(m.user_id) ?? {
      full_name: null,
      email: null,
    };

    return {
      ...m,
      profiles: profile,
    };
  });

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin — Players</h1>
      <p style={{ marginTop: 8, opacity: 0.85 }}>
        View and manage player details for this pool.
      </p>

      <div style={{ marginTop: 16 }}>
        <PlayersTable poolId={poolId} initialMembers={mergedMembers} />
      </div>
    </main>
  );
}