import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InviteDetails from "./InviteDetails";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect(`/login?next=/pool/${poolId}/invite`);
  }

  const { data: memberRows } = await supabase
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id);

  const isCommissioner = (memberRows ?? []).some(
    (row) =>
      Boolean(row?.is_commissioner) ||
      String(row?.role ?? "").toLowerCase() === "commissioner" ||
      String(row?.role ?? "").toLowerCase() === "admin"
  );

  if (!isCommissioner) {
    redirect(`/pool/${poolId}`);
  }

  const { data: existingInvites, error: inviteReadError } = await supabase
    .from("pool_invites")
    .select("code, expires_at, max_uses, uses, created_at")
    .eq("pool_id", poolId)
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(10);

  if (inviteReadError) {
    return (
      <main style={{ padding: 24, maxWidth: 820 }}>
        <h1 style={{ fontSize: 28, fontWeight: 950 }}>Invite</h1>

        <p style={{ marginTop: 10, opacity: 0.85 }}>
          Could not load an invite code.
        </p>

        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.18)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {inviteReadError.message}
        </pre>

        <div style={{ marginTop: 14 }}>
          <Link
            href={`/pool/${poolId}`}
            style={{ textDecoration: "underline" }}
          >
            Back to pool
          </Link>
        </div>
      </main>
    );
  }

  const validInvite =
    (existingInvites ?? []).find(
      (invite) =>
        invite.max_uses == null ||
        Number(invite.uses ?? 0) < Number(invite.max_uses)
    ) ?? null;

  let inviteCode = validInvite?.code ?? null;

  if (!inviteCode) {
    const { data: createdCode, error: createError } = await supabase.rpc(
      "create_pool_invite",
      {
        p_pool_id: poolId,
        p_created_by: auth.user.id,
        p_prefix: "HUDGE",
        p_suffix_len: 4,
        p_expires_at: null,
        p_max_uses: null,
      }
    );

    if (createError) {
      return (
        <main style={{ padding: 24, maxWidth: 820 }}>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>Invite</h1>

          <p style={{ marginTop: 10, opacity: 0.85 }}>
            Could not generate an invite code.
          </p>

          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.18)",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {createError.message}
          </pre>

          <div style={{ marginTop: 14 }}>
            <Link
              href={`/pool/${poolId}`}
              style={{ textDecoration: "underline" }}
            >
              Back to pool
            </Link>
          </div>
        </main>
      );
    }

    inviteCode = String(createdCode);
  }

  const inviteUrl =
    `https://hudge-survivor.vercel.app/join/${inviteCode}`;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 900,
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>
        Invite Players
      </h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Share the full invite link or give the player the shorter invite
        code.
      </p>

      <InviteDetails
        inviteUrl={inviteUrl}
        inviteCode={inviteCode}
      />

      <div style={{ marginTop: 18 }}>
        <Link
          href={`/pool/${poolId}`}
          style={{ textDecoration: "underline" }}
        >
          Back to pool
        </Link>
      </div>
    </main>
  );
}
