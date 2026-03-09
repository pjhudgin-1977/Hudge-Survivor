import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DangerRow = {
  user_id: string;
  entry_no: number;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
};

export default async function DangerPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("pool_members")
    .select("user_id, entry_no")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .limit(1);

  if (membershipError || !memberships || memberships.length === 0) {
    redirect(`/join/${poolId}`);
  }

  const { data: rows, error } = await supabase
    .from("pool_members")
    .select("user_id, entry_no, screen_name, losses, is_eliminated")
    .eq("pool_id", poolId)
    .eq("losses", 1)
    .eq("is_eliminated", false)
    .order("screen_name", { ascending: true })
    .order("entry_no", { ascending: true });

  const players = ((rows ?? []) as DangerRow[]).filter(
    (r) => !r.is_eliminated && Number(r.losses ?? 0) === 1
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Link href={`/pool/${poolId}/gameday`}>← Back to Game Day</Link>

      <h1 style={{ marginTop: 18, fontSize: 32, fontWeight: 900 }}>
        ⚠️ Danger Zone
      </h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Entries on their last life.
      </p>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Failed to load Danger Zone.
        </div>
      ) : players.length === 0 ? (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Nobody is in the Danger Zone right now.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {players.map((player) => (
            <div
              key={`${player.user_id}-${player.entry_no}`}
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.08)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {player.screen_name || "Player"}{" "}
                <span style={{ opacity: 0.7, fontWeight: 700 }}>
                  • Entry {player.entry_no}
                </span>
              </div>

              <div style={{ marginTop: 6, opacity: 0.8 }}>
                1 loss • last life
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}