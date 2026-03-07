"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";

type Props = {
  poolId?: string;
  status?: "OPEN" | "LOCKED";
  label?: string;
  isCommissioner?: boolean;
};

type MemberLite = {
  user_id: string;
  losses: number | null;
  is_eliminated: boolean | null;
  entry_fee_paid: boolean | null;
  screen_name?: string | null;
};

type Phase = "regular" | "playoffs";

function normalizePhase(p: any): Phase {
  const s = String(p ?? "").toLowerCase();
  return s.includes("play") ? "playoffs" : "regular";
}

function fmtPhase(p: Phase) {
  return p === "regular" ? "REG" : "PO";
}

export default function NavBar({ poolId, status, label, isCommissioner }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("hudge_is_commissioner", isCommissioner ? "1" : "0");
    } catch {}
  }, [isCommissioner]);

  const base = poolId ? `/pool/${poolId}` : null;

  const [zeroLoss, setZeroLoss] = useState<number | null>(null);
  const [oneLoss, setOneLoss] = useState<number | null>(null);
  const [outCount, setOutCount] = useState<number | null>(null);

  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [missingPickCount, setMissingPickCount] = useState<number | null>(null);
  const [currentWeekLabel, setCurrentWeekLabel] = useState<string>("");

  const [playerBadgeName, setPlayerBadgeName] = useState<string>("Profile");

  const items = useMemo(() => {
    if (!base) return [{ href: "/dashboard", label: "Dashboard" }];

    return [
      { href: `${base}`, label: "Standings" },
      { href: `${base}/board`, label: "Board" },   // ✅ Added Board correctly
            { href: `${base}/danger`, label: "Danger" },
      { href: `${base}/payment`, label: "Pay", badge: isCommissioner ? unpaidCount : null },
      { href: `${base}/pick`, label: "Pick", badge: isCommissioner ? missingPickCount : null },
      { href: `${base}/my-picks`, label: "My Picks" },
      { href: `${base}/sweat`, label: "Sweat" },
      { href: `${base}/invite`, label: "Invite" },
      { href: `${base}/rules`, label: "Rules" },

    ];
  }, [base, unpaidCount, missingPickCount, isCommissioner]);

  async function loadPlayerBadge(pid?: string) {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPlayerBadgeName("Profile");
      return;
    }

    if (pid) {
      const { data: member } = await supabase
        .from("pool_members")
        .select("screen_name")
        .eq("pool_id", pid)
        .eq("user_id", user.id)
        .maybeSingle();

      const memberScreenName = String(member?.screen_name ?? "").trim();
      if (memberScreenName) {
        setPlayerBadgeName(memberScreenName);
        return;
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const fallbackName =
      String(profile?.full_name ?? "").trim() ||
      user.email?.split("@")[0]?.trim() ||
      "Profile";

    setPlayerBadgeName(fallbackName);
  }

  useEffect(() => {
    loadPlayerBadge(poolId);
  }, [poolId]);

  async function onLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(10px)",
        background: "rgba(10, 10, 10, 0.85)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href={base ?? "/dashboard"}
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            🐻 Hudge Survivor Pool
          </Link>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {items.map((it: any) => (
            <NavLink
              key={it.href}
              href={it.href}
              label={it.label}
              badge={typeof it.badge === "number" ? it.badge : null}
              active={pathname === it.href}
            />
          ))}

          <NavLink
            href="/profile"
            label={`👤 ${playerBadgeName}`}
            active={pathname === "/profile"}
          />

          {base && isCommissioner ? (
            <NavLink href={`${base}/admin`} label="Admin" active={pathname?.includes("/admin")} />
          ) : null}

          <button
            onClick={onLogout}
            style={{
              cursor: "pointer",
              color: "white",
              fontWeight: 900,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: number | null;
}) {
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "white",
        textDecoration: "none",
        fontWeight: 900,
        padding: "6px 10px",
        borderRadius: 10,
        border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
      }}
    >
      <span>{label}</span>

      {showBadge ? (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 900,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.10)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}