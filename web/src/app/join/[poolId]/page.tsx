import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ poolId: string }>;
  searchParams?: Promise<{ screen_name?: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/join/${poolId}`);

  const userId = auth.user.id;

  // If already a member, go straight to pool
  const { data: existing, error: existingError } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return (
      <main style={{ padding: 24, maxWidth: 560, color: "white" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>
        <div style={{ marginTop: 10, color: "#ff6b6b", fontWeight: 800 }}>
          Error checking membership: {existingError.message}
        </div>
      </main>
    );
  }

  if (existing) {
    redirect(`/pool/${poolId}`);
  }

  const sp = (await Promise.resolve(searchParams)) ?? {};
  const screenNameFromQuery = String(sp.screen_name ?? "").trim();

  // If they submitted the form (GET submit), join them now.
  if (screenNameFromQuery) {
    const safeName = screenNameFromQuery.slice(0, 40);

    const { error: insertError } = await supabase.from("pool_members").insert({
      pool_id: poolId,
      user_id: userId,
      screen_name: safeName,
    });

    if (!insertError) {
      redirect(`/pool/${poolId}`);
    }

    // If insert failed, fall through to show the form + error
    return (
      <main style={{ padding: 24, maxWidth: 560 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,0,0,0.08)",
            color: "white",
          }}
        >
          <div style={{ fontWeight: 900 }}>Could not join</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{insertError.message}</div>
        </div>

        <JoinForm poolId={poolId} defaultName={screenNameFromQuery} />
      </main>
    );
  }

  // Otherwise show the form
  const defaultName = auth.user.email?.split("@")[0] ?? "";
  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>

      <div style={{ marginTop: 8, opacity: 0.85 }}>
        Pick a screen name for this pool. You can change it later.
      </div>

      <JoinForm poolId={poolId} defaultName={defaultName} />
    </main>
  );
}

function JoinForm({ poolId, defaultName }: { poolId: string; defaultName: string }) {
  return (
    <form action={`/join/${poolId}`} method="get" style={{ marginTop: 16 }}>
      <label style={{ display: "block", fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
        Screen name
      </label>

      <input
        name="screen_name"
        defaultValue={defaultName}
        placeholder="e.g. patrickh"
        maxLength={40}
        required
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.25)",
        }}
      />

      <button
        type="submit"
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.35)",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        Join Pool
      </button>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Pool ID: <code>{poolId}</code>
      </div>
    </form>
  );
}