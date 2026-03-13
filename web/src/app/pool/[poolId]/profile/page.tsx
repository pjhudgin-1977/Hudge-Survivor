import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/pool/${poolId}/profile`);

  const userId = auth.user.id;

  const { data: me, error } = await supabase
    .from("pool_members")
    .select("screen_name")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Profile</h1>
        <p style={{ marginTop: 10 }}>Failed to load: {error.message}</p>
      </main>
    );
  }

  if (!me) redirect(`/join/${poolId}`);

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>Profile</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Your nickname controls how you appear in standings and the sweat board.
      </p>

      <div
        style={{
          marginTop: 14,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.22)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
          Current Nickname
        </div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950 }}>
          {me.screen_name || "—"}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/pool/${poolId}/profile/edit`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.25)",
              fontWeight: 950,
              textDecoration: "none",
            }}
          >
            ✏️ Edit Nickname
          </Link>

          <Link
            href={`/pool/${poolId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.18)",
              fontWeight: 900,
              textDecoration: "none",
              opacity: 0.9,
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}