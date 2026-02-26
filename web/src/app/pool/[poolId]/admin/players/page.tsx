import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayersTable from "./PlayersTable.tsx";
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
    .select("user_id, screen_name, entry_fee_paid, entry_fee_amount")
    .eq("pool_id", poolId)
    .order("screen_name", { ascending: true });

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

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin — Players</h1>
      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Manage entry fee status for this pool.
      </p>

      <div style={{ marginTop: 16 }}>
        <PlayersTable poolId={poolId} initialMembers={members ?? []} />
      </div>
    </main>
  );
}