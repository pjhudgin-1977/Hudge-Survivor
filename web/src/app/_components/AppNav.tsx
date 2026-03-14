"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AppNav({ poolId }: { poolId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabaseClient");
    const supabase = createClient();

    await supabase.auth.signOut();
    router.push("/login");
  }

  const base = poolId ? `/pool/${poolId}` : "";

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", gap: 18, fontWeight: 800 }}>
        <Link href={base || "/dashboard"} style={linkStyle}>
          Dashboard
        </Link>

        {poolId && (
          <>
            <Link href={`${base}/pick`} style={linkStyle}>
              Pick
            </Link>

            <Link href={`${base}/sweat`} style={linkStyle}>
              GameDay
            </Link>

            <Link href={`${base}/standings`} style={linkStyle}>
              Standings
            </Link>
          </>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          MORE ▾
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 40,
              width: 180,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0b0f1a",
              overflow: "hidden",
              boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
              zIndex: 20,
            }}
          >
            <Link href="/profile" style={menuItem}>
              Profile
            </Link>

            {poolId && (
              <Link href={`${base}/rules`} style={menuItem}>
                Rules
              </Link>
            )}

            <button
              onClick={handleLogout}
              style={{
                ...menuItem,
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              🚪 Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "white",
  opacity: 0.9,
};

const menuItem: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  textDecoration: "none",
  color: "white",
  fontWeight: 700,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};