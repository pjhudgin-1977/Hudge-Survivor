import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>{title}</h1>
      <p style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
        {message}
      </p>
      <p style={{ marginTop: 12, opacity: 0.85 }}>
        Ask the commissioner for a fresh invite link.
      </p>
    </main>
  );
}

export default async function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId: raw } = await params;

  // Must be signed in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/join/${raw}`);
  const userId = auth.user.id;

  // Resolve join token -> actual pool UUID
  let poolId = raw;

  if (!isUuid(raw)) {
    // 1) Lookup without incrementing uses
    const { data: invite, error: lookupErr } = await supabase.rpc(
      "get_invite_by_code",
      { p_code: raw }
    );

    if (lookupErr) {
      return (
        <ErrorBox title="Join Pool" message={`Invite code error: ${lookupErr.message}`} />
      );
    }

    if (!invite || !invite[0]?.pool_id) {
      return <ErrorBox title="Join Pool" message="Invalid or expired invite code." />;
    }

    poolId = String(invite[0].pool_id);

    // 2) If already a member, don't redeem / increment uses
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

    // 3) Now redeem (increment uses) only for a real new join
    const { data: redeemedPoolId, error: redeemErr } = await supabase.rpc(
      "redeem_invite_code",
      { p_code: raw }
    );

    if (redeemErr) {
      return (
        <ErrorBox title="Join Pool" message={`Invite redeem error: ${redeemErr.message}`} />
      );
    }

    if (!redeemedPoolId) {
      return <ErrorBox title="Join Pool" message="Invite code is no longer valid." />;
    }

    poolId = String(redeemedPoolId);
  }

  // UUID join path (or post-redeem): Check membership
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

  if (existing) redirect(`/pool/${poolId}`);

  // Insert membership
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

  redirect(`/pool/${poolId}`);
}