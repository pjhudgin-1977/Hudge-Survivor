import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function Card({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.22)",
        padding: 16,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      <div style={{ opacity: 0.8, fontSize: 13 }}>{desc}</div>
      <div style={{ marginTop: 8, fontWeight: 900, opacity: 0.9 }}>
        Open →
      </div>
    </Link>
  );
}

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/pool/${poolId}/admin`);

  const userId = auth.user.id;

  // ✅ Gate: commissioners/admins only
  const { data: gate } = await supabase
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  const isCommissioner =
    Boolean(gate?.is_commissioner) ||
    String(gate?.role ?? "").toLowerCase() === "commissioner" ||
    String(gate?.role ?? "").toLowerCase() === "admin";

  if (!isCommissioner) redirect(`/pool/${poolId}`);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 980 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: 30, fontWeight: 950, margin: 0 }}>Admin</h1>
        <div style={{ opacity: 0.75 }}>
          Commissioner tools for this pool.
        </div>

        <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/pool/${poolId}`}
            style={{ textDecoration: "underline", opacity: 0.85 }}
          >
            Back to pool
          </Link>
          <span style={{ opacity: 0.35 }}>•</span>
          <Link
            href={`/pool/${poolId}/invite`}
            style={{ textDecoration: "underline", opacity: 0.85 }}
          >
            Invite page
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <Card
          title="Commissioner Dashboard"
          desc="Paid toggles, reset autopicks, force pick, standings controls."
          href={`/pool/${poolId}/standings2`}
        />
        <Card
          title="Players"
          desc="View/edit members, strikes, status, commissioner actions."
          href={`/pool/${poolId}/admin/players`}
        />
        <Card
          title="Settings"
          desc="Pool settings, rules toggles, future admin configuration."
          href={`/pool/${poolId}/admin/settings`}
        />
        <Card
          title="Runbook"
          desc="Quick links to autolock/grade and troubleshooting."
          href={`/pool/${poolId}/admin/settings`}
        />
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.18)",
          padding: 14,
          fontSize: 13,
          opacity: 0.85,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 950, marginBottom: 6 }}>
          Why you were seeing “Pool Dashboard” on /admin
        </div>
        <div>
          The file <code>web/src/app/pool/[poolId]/admin/page.tsx</code> currently
          contains the Pool Dashboard code. Replacing it restores the Admin home.
        </div>
      </div>
    </main>
  );
}