  "use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

function getPoolIdFromPath(path: string) {
  const match = path.match(/^\/pool\/([^\/?#]+)/);
  return match ? match[1] : null;
}

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  // ✅ correct poolId detection for /pool/:id/*
  const poolId = (() => {
    const parts = pathname.split("/").filter(Boolean);
    const i = parts.indexOf("pool");
    return i >= 0 ? parts[i + 1] ?? null : null;
  })();

  const [poolName, setPoolName] = useState<string | null>(null);

  useEffect(() => {
    setPoolName(null);
    if (!poolId) return;

    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const { data } = await supabase
        .from("pools")
        .select("name")
        .eq("id", poolId)
        .maybeSingle();

      if (!cancelled) setPoolName(data?.name ?? null);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [poolId]);

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }
 const linkStyle = (href: string) => ({
    padding: "8px 10px",
    borderRadius: 8,
    textDecoration: "none",
    border: pathname === href ? "1px solid #333" : "1px solid transparent",
  });

  return (

 
    <header
      style={{
        borderBottom: "1px solid #e5e5e5",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong>Hudge</strong>
          {poolId ? (
            <span style={{ opacity: 0.8 }}>
              /{" "}
              <Link href={`/pool/${poolId}`} style={{ textDecoration: "none" }}>
                {poolName ?? "Loading pool..."}
              </Link>
            </span>
          ) : null}
        </div>

        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={linkStyle("/dashboard")}>
            Dashboard
          </Link>
          <Link href="/join" style={linkStyle("/join")}>
            Join
          </Link>

          {/* ✅ only show these when inside a pool */}
         {poolId ? (
  <>
    <Link
      href={`/pool/${poolId}/pick`}
      style={linkStyle(`/pool/${poolId}/pick`)}
    >
      Pick
    </Link>

    <Link
      href={`/pool/${poolId}/standings`}
      style={linkStyle(`/pool/${poolId}/standings`)}
    >
      Standings
    </Link>

    <Link
      href={`/pool/${poolId}/sweat`}
      style={linkStyle(`/pool/${poolId}/sweat`)}
    >
      Sweat
    </Link>
  </>
) : null}
        </nav>
      </div>

      <button
        onClick={onLogout}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #333",
          cursor: "pointer",
          background: "white",
        }}
      >
        Logout
      </button>
    </header>
  );
}