import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// If your navbar component path/name differs, adjust this import.
// Common examples: "@/components/GlobalNavBar" or "@/components/NavBar"
import NavBar from "@/app/_components/NavBar";export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  // Require login for all /pool/* pages
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect("/login");

  // Fetch THIS user's pool_members row for payment status
  const { data: member, error: memberErr } = await supabase
    .from("pool_members")
    .select("screen_name, entry_fee_paid, entry_fee_amount")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  // If not in the pool, send them to join (or wherever you want)
  // (If your app auto-joins, this usually shouldn't happen.)
  if (memberErr) {
    // Keep it simple: still render, but without payment status
    // You can choose to redirect instead:
    // redirect(`/join/${poolId}`);
    console.warn("pool_members lookup error:", memberErr.message);
  }

  const paid = !!member?.entry_fee_paid;
  const amount =
    member?.entry_fee_amount === null || member?.entry_fee_amount === undefined
      ? null
      : Number(member.entry_fee_amount);

  return (
    <div style={{ minHeight: "100vh", background: "#0b1f3a", color: "white" }}>
      {/* Header / Nav Area */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "#081a33",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {/* Left: your existing NavBar */}
<NavBar status={status} label={label} />          {/* Right: username + entry fee status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              opacity: 0.95,
            }}
          >
            <div style={{ opacity: 0.9 }}>
              {member?.screen_name ? (
                <>
                  Signed in as <strong>{member.screen_name}</strong>
                </>
              ) : (
                <>Signed in</>
              )}
            </div>

            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: paid ? "rgba(0,200,120,0.16)" : "rgba(255,140,0,0.18)",
                color: "white",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
              title={
                paid
                  ? amount !== null
                    ? `Entry fee received: $${amount.toFixed(2)}`
                    : "Entry fee marked as paid"
                  : "Entry fee not paid"
              }
            >
              {paid ? (
                <>
                  ✅ Paid{amount !== null ? ` ($${amount.toFixed(2)})` : ""}
                </>
              ) : (
                <>⚠️ Entry fee not paid</>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
        {children}
      </main>
    </div>
  );
}