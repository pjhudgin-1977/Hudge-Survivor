import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(900px 500px at 30% 10%, rgba(255,95,0,0.28), transparent 55%), radial-gradient(900px 500px at 70% 80%, rgba(5,160,255,0.14), transparent 55%), #070A10",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1.05 }}>
            {title}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <Card title="Join Pool">
      <div style={{ color: "#ffb4b4", fontWeight: 900 }}>{message}</div>
      <div style={{ marginTop: 10, opacity: 0.85 }}>
        Ask the commissioner for a fresh invite link.
      </div>
      <div style={{ marginTop: 14 }}>
        <Link href="/login" style={{ color: "white", fontWeight: 900 }}>
          Go to login
        </Link>
      </div>
    </Card>
  );
}

export default async function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId: raw } = await params;

  // ✅ If not logged in, show a public pool preview instead of forcing login blindly
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    // Use the new RPC (works for anon)
    const { data: preview, error: previewErr } = await supabase.rpc(
      "get_pool_preview_by_code",
      { p_code: raw }
    );

    if (previewErr) {
      return <ErrorBox message={`Preview error: ${previewErr.message}`} />;
    }

    const p = preview?.[0];
    if (!p?.pool_id) {
      return <ErrorBox message="Invalid or expired invite link." />;
    }

    return (
      <Card title="You’ve been invited 🎟️">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            {p.pool_name ?? "Survivor Pool"}
          </div>
          <div style={{ opacity: 0.85 }}>
            Commissioner: <strong>{p.commissioner_name ?? "Commissioner"}</strong>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.22)",
              opacity: 0.92,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            Next step: create an account (or log in) and we’ll add you to the pool
            automatically.
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href={`/login?next=/join/${raw}`}
              style={{
                display: "inline-block",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  "linear-gradient(180deg, rgba(255,95,0,0.9), rgba(255,95,0,0.65))",
                color: "white",
                fontSize: 18,
                fontWeight: 950,
                textDecoration: "none",
              }}
            >
              Log in / Create account to join
            </Link>

            <div style={{ alignSelf: "center", opacity: 0.75, fontSize: 13 }}>
              Invite: <strong>{raw}</strong>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Logged in → join flow
  const userId = auth.user.id;

  // Resolve join token -> actual pool UUID
  let poolId = raw;

  if (!isUuid(raw)) {
    // 1) Lookup without incrementing uses
    const { data: invite, error: lookupErr } = await supabase.rpc(
      "get_invite_by_code",
      { p_code: raw }
    );

    if (lookupErr) return <ErrorBox message={`Invite code error: ${lookupErr.message}`} />;
    if (!invite || !invite[0]?.pool_id) return <ErrorBox message="Invalid or expired invite code." />;

    poolId = String(invite[0].pool_id);

    // 2) If already a member, don't redeem / increment uses
    const { data: existing, error: existingError } = await supabase
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) return <ErrorBox message={`Error checking membership: ${existingError.message}`} />;
    if (existing) redirect(`/pool/${poolId}`);

    // 3) Redeem (increment uses) only for a real new join
    const { data: redeemedPoolId, error: redeemErr } = await supabase.rpc(
      "redeem_invite_code",
      { p_code: raw }
    );

    if (redeemErr) return <ErrorBox message={`Invite redeem error: ${redeemErr.message}`} />;
    if (!redeemedPoolId) return <ErrorBox message="Invite code is no longer valid." />;

    poolId = String(redeemedPoolId);
  }

  // UUID join path (or post-redeem): Check membership
  const { data: existing, error: existingError } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) return <ErrorBox message={`Error checking membership: ${existingError.message}`} />;
  if (existing) redirect(`/pool/${poolId}`);

  // ✅ Prefer nickname from Auth metadata (set at signup), fallback to email prefix
  const meta = (auth.user.user_metadata || {}) as Record<string, any>;
  const screenName =
    (typeof meta.screen_name === "string" && meta.screen_name.trim()) ||
    (auth.user.email?.split("@")[0] ?? "Player");

  // Insert membership
  const { error: insertError } = await supabase.from("pool_members").insert({
    pool_id: poolId,
    user_id: userId,
    screen_name: screenName,
  });

  if (insertError) return <ErrorBox message={`Error joining: ${insertError.message}`} />;

  redirect(`/pool/${poolId}`);
}