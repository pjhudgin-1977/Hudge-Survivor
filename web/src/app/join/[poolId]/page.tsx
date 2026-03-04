import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export default async function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId: raw } = await params;

  // Must be signed in (same behavior you already had)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/join/${raw}`);
  const userId = auth.user.id;

  // ✅ Resolve join token -> actual pool UUID
  // - If it's already a UUID, use it
  // - Otherwise treat it as an invite code and redeem it (increments uses)
  let poolId = raw;

  if (!isUuid(raw)) {
    const { data: resolved, error: redeemErr } = await supabase.rpc(
      "redeem_invite_code",
      { p_code: raw }
    );

    if (redeemErr) {
      return (
        <main style={{ padding: 24, maxWidth: 720 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>
          <p style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
            Invite code error: {redeemErr.message}
          </p>
          <p style={{ marginTop: 12, opacity: 0.85 }}>
            Ask the commissioner for a fresh invite link.
          </p>
        </main>
      );
    }

    if (!resolved) {
      return (
        <main style={{ padding: 24, maxWidth: 720 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>
          <p style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
            Invalid or expired invite code.
          </p>
          <p style={{ marginTop: 12, opacity: 0.85 }}>
            Ask the commissioner for a fresh invite link.
          </p>
        </main>
      );
    }

    poolId = String(resolved);
  }

  // 1) Check if already a member
  const { data: existing, error: existingError } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>
        <p style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
          Error checking membership: {existingError.message}
        </p>
      </main>
    );
  }

  if (existing) {
    redirect(`/pool/${poolId}`);
  }

  // 2) Insert membership
  const { error: insertError } = await supabase.from("pool_members").insert({
    pool_id: poolId,
    user_id: userId,
    screen_name: auth.user.email?.split("@")[0] ?? "Player",
  });

  if (insertError) {
    return (
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Join Pool</h1>
        <p style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
          Error joining: {insertError.message}
        </p>

        <p style={{ marginTop: 12 }}>
          <Link href={`/pool/${poolId}`} style={{ color: "white" }}>
            Go back to pool
          </Link>
        </p>
      </main>
    );
  }

  // 3) Success -> go to pool
  redirect(`/pool/${poolId}`);
}