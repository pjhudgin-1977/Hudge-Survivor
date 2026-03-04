import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type InviteRow = {
  id: string;
  pool_id: string;
  code: string;
  uses: number | null;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string | null;
};

function siteUrl() {
  // Prefer an explicit env var for clean links
  const a =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    "";
  if (!a) return "";
  if (a.startsWith("http")) return a;
  return `https://${a}`;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (needed for invite admin actions)."
    );
  }

  return createAdminClient(url, key, { auth: { persistSession: false } });
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `HUDGE-${s}`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.22)",
        fontWeight: 900,
        opacity: 0.92,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function isExpired(inv: InviteRow) {
  if (!inv.expires_at) return false;
  const dt = new Date(inv.expires_at);
  if (isNaN(dt.getTime())) return false;
  return Date.now() > dt.getTime();
}

function isMaxed(inv: InviteRow) {
  if (inv.max_uses == null) return false;
  return Number(inv.uses ?? 0) >= Number(inv.max_uses);
}

export default async function InviteDashboardPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/pool/${poolId}/invite`);

  const userId = auth.user.id;

  // ✅ Commissioner gate
  const { data: member, error: memErr } = await supabase
    .from("pool_members")
    .select("is_commissioner, role, screen_name")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memErr) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Invites</h1>
        <p style={{ marginTop: 10, color: "crimson" }}>{memErr.message}</p>
      </main>
    );
  }

  const isComm =
    !!member?.is_commissioner || String(member?.role ?? "").toLowerCase() === "commissioner";

  if (!isComm) {
    return (
      <main style={{ padding: 24, maxWidth: 900 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Invites</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          This page is commissioner-only.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href={`/pool/${poolId}`} style={{ fontWeight: 900 }}>
            ← Back to Pool
          </Link>
        </p>
      </main>
    );
  }

  async function createInviteAction() {
    "use server";

    const a = admin();

    // Retry a few times in case code collision
    let code = genCode();
    for (let i = 0; i < 6; i++) {
      const { data: exists } = await a
        .from("pool_invites")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!exists) break;
      code = genCode();
    }

    const { error } = await a.from("pool_invites").insert({
      pool_id: poolId,
      code,
      // uses defaults to 0 if you set that in schema; otherwise it's fine as null/0
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/pool/${poolId}/invite`);
  }

  async function disableInviteAction(formData: FormData) {
    "use server";

    const inviteId = String(formData.get("invite_id") ?? "");
    if (!inviteId) redirect(`/pool/${poolId}/invite`);

    const a = admin();
    const { error } = await a
      .from("pool_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("pool_id", poolId);

    if (error) throw new Error(error.message);

    redirect(`/pool/${poolId}/invite`);
  }

  const { data: invites, error: invErr } = await supabase
    .from("v_pool_invites_manage")
    .select("id,pool_id,code,uses,max_uses,expires_at,created_at")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false });

  if (invErr) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Invites</h1>
        <p style={{ marginTop: 10, color: "crimson" }}>{invErr.message}</p>
      </main>
    );
  }

  const list = (invites ?? []) as InviteRow[];
  const base = siteUrl();
  const joinPrefix = base ? `${base}/join/` : `/join/`;

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>Invite Codes</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Share a short link like <Badge>{joinPrefix}HUDGE-7K9P</Badge>
          </div>
          {!base ? (
            <div style={{ marginTop: 6, opacity: 0.65, fontSize: 12 }}>
              Tip: set <code>NEXT_PUBLIC_SITE_URL</code> in Vercel env for full links.
            </div>
          ) : null}
        </div>

        <form action={createInviteAction}>
          <button
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background:
                "linear-gradient(180deg, rgba(255,95,0,0.95), rgba(255,95,0,0.75))",
              color: "white",
              fontWeight: 950,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            + Create New Invite
          </button>
        </form>
      </div>

      <div style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.10)", fontWeight: 900 }}>
          Active & Past Invites
        </div>

        {list.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.8 }}>No invites yet. Create one above.</div>
        ) : (
          <div style={{ display: "grid" }}>
            {list.map((inv) => {
              const expired = isExpired(inv);
              const maxed = isMaxed(inv);
              const disabled = expired || maxed;

              const url = `${joinPrefix}${inv.code}`;

              return (
                <div
                  key={inv.id}
                  style={{
                    padding: 14,
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    display: "grid",
                    gap: 10,
                    opacity: disabled ? 0.65 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge>{inv.code}</Badge>
                      {expired ? <Badge>Expired</Badge> : null}
                      {maxed ? <Badge>Maxed</Badge> : null}
                      {!expired && !maxed ? <Badge>Active</Badge> : null}
                    </div>

                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      Created: <strong>{fmtDate(inv.created_at)}</strong>
                      {" · "}
                      Expires: <strong>{fmtDate(inv.expires_at)}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ opacity: 0.85 }}>
                      Link:{" "}
                      <a href={base ? url : `/join/${inv.code}`} style={{ fontWeight: 900 }}>
                        {url}
                      </a>
                    </div>

                    <div style={{ opacity: 0.85 }}>
                      Uses:{" "}
                      <strong>
                        {Number(inv.uses ?? 0)}
                        {inv.max_uses != null ? ` / ${inv.max_uses}` : ""}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        // Client-side copy (works in modern browsers)
                        // This is a server component, but this inline handler runs on the client
                        // only when hydrated; if it doesn't, users can copy manually.
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        navigator.clipboard?.writeText(url);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "rgba(0,0,0,0.04)",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Copy link
                    </button>

                    <form action={disableInviteAction}>
                      <input type="hidden" name="invite_id" value={inv.id} />
                      <button
                        disabled={disabled}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: disabled ? "rgba(0,0,0,0.03)" : "rgba(220,38,38,0.10)",
                          color: disabled ? "rgba(0,0,0,0.45)" : "rgb(153,27,27)",
                          fontWeight: 950,
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                        title={disabled ? "Already expired/maxed" : "Disable this invite now"}
                      >
                        Disable
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href={`/pool/${poolId}`} style={{ fontWeight: 900 }}>
          ← Back to Pool
        </Link>
      </div>
    </main>
  );
}