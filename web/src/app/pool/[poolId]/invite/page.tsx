import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/pool/${poolId}/invite`);

  // Create / rotate invite code with no expiration and no use limit
  const { data: code, error: codeError } = await supabase.rpc(
    "create_invite_code",
    {
      p_pool_id: poolId,
      p_max_uses: null,
      p_expires_in: null,
    }
  );

  if (codeError) {
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
          {codeError.message}
        </pre>

        <div style={{ marginTop: 14 }}>
          <Link href={`/pool/${poolId}`} style={{ textDecoration: "underline" }}>
            Back to pool
          </Link>
        </div>
      </main>
    );
  }

  const inviteUrl = `https://hudge-survivor.vercel.app/join/${code}`;

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>Invite</h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Share this link to invite someone to your pool.
      </p>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.75 }}>Invite link</div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontWeight: 900,
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            {inviteUrl}
          </a>

          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(0,0,0,0.25)",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            Code: {code}
          </span>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
          This invite code stays active until you create a new one.
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href={`/pool/${poolId}`} style={{ textDecoration: "underline" }}>
          Back to pool
        </Link>
      </div>
    </main>
  );
}