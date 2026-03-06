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

  // =========================
  // Survivor status counts
  // =========================
  const [zeroLoss, setZeroLoss] = useState<number | null>(null);
  const [oneLoss, setOneLoss] = useState<number | null>(null);
  const [outCount, setOutCount] = useState<number | null>(null);

  // =========================
  // Notification badges
  // =========================
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [missingPickCount, setMissingPickCount] = useState<number | null>(null);
  const [currentWeekLabel, setCurrentWeekLabel] = useState<string>("");

  // =========================
  // Player badge
  // =========================
  const [playerBadgeName, setPlayerBadgeName] = useState<string>("Profile");

  const items = useMemo(() => {
    if (!base) return [{ href: "/dashboard", label: "Dashboard" }];

    return [
      { href: `${base}`, label: "Standings" },
      { href: `${base}/payment`, label: "Pay", badge: isCommissioner ? unpaidCount : null },
      { href: `${base}/pick`, label: "Pick", badge: isCommissioner ? missingPickCount : null },
      { href: `${base}/my-picks`, label: "My Picks" },
      { href: `${base}/sweat`, label: "Sweat" },
      { href: `${base}/invite`, label: "Invite" },
      ...(isCommissioner ? [{ href: `${base}/admin`, label: "Admin" }] : []),
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

  async function loadCounts(pid: string) {
    const supabase = createClient();

    // 1) pool members (for 0L/1L/out + unpaid + alive list)
    const { data: memData, error: memErr } = await supabase
      .from("pool_members")
      .select("user_id, losses, is_eliminated, entry_fee_paid")
      .eq("pool_id", pid);

    if (memErr) {
      // Don’t break nav if RLS blocks for non-commissioner
      setZeroLoss(null);
      setOneLoss(null);
      setOutCount(null);
      setUnpaidCount(null);
      setMissingPickCount(null);
      setCurrentWeekLabel("");
      return;
    }

    const members = (memData ?? []) as MemberLite[];

    // Survivor buckets
    let z = 0;
    let o = 0;
    let out = 0;

    // unpaid
    let unpaid = 0;

    const aliveUserIds: string[] = [];

    for (const m of members) {
      const losses = Number(m.losses ?? 0);
      const eliminated = Boolean(m.is_eliminated) || losses >= 2;

      if (eliminated) out++;
      else if (losses === 1) o++;
      else z++;

      if (!Boolean(m.entry_fee_paid)) unpaid++;

      if (!eliminated) aliveUserIds.push(m.user_id);
    }

    setZeroLoss(z);
    setOneLoss(o);
    setOutCount(out);

    // Unpaid badge: commissioner only (but harmless to compute)
    setUnpaidCount(unpaid);

    // 2) determine “current week” = next upcoming game (fallback earliest)
    const nowIso = new Date().toISOString();

    const { data: nextGame, error: nextErr } = await supabase
      .from("games")
      .select("week_number, phase, kickoff_at")
      .gte("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextErr) {
      setMissingPickCount(null);
      setCurrentWeekLabel("");
      return;
    }

    let week_number: number | null =
      nextGame?.week_number != null ? Number(nextGame.week_number) : null;
    let phase: Phase | null = nextGame?.phase ? normalizePhase(nextGame.phase) : null;

    if (week_number == null || !phase) {
      const { data: firstGame, error: firstErr } = await supabase
        .from("games")
        .select("week_number, phase, kickoff_at")
        .order("kickoff_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstErr) {
        setMissingPickCount(null);
        setCurrentWeekLabel("");
        return;
      }

      week_number = firstGame?.week_number != null ? Number(firstGame.week_number) : null;
      phase = firstGame?.phase ? normalizePhase(firstGame.phase) : null;
    }

    if (week_number == null || !phase) {
      setMissingPickCount(null);
      setCurrentWeekLabel("");
      return;
    }

    setCurrentWeekLabel(`${fmtPhase(phase)} W${week_number}`);

    // 3) missing picks among ALIVE users for current week/phase
    const { data: pickData, error: pickErr } = await supabase
      .from("picks")
      .select("user_id")
      .eq("pool_id", pid)
      .eq("week_number", week_number)
      .eq("phase", phase);

    if (pickErr) {
      setMissingPickCount(null);
      return;
    }

    const pickedSet = new Set<string>((pickData ?? []).map((r: any) => String(r.user_id)));
    const missing = aliveUserIds.filter((uid) => !pickedSet.has(uid)).length;

    setMissingPickCount(missing);
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await loadPlayerBadge(poolId);
      if (poolId) {
        await loadCounts(poolId);
      }
    };

    run();
    const t = window.setInterval(run, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
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
        {/* Brand + Status Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={base ?? "/dashboard"}
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: 900,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            🐻 Hudge Survivor Pool
          </Link>

          {label ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                opacity: 0.9,
                whiteSpace: "nowrap",
              }}
            >
              {label}
              {status ? ` • ${status}` : ""}
            </span>
          ) : null}

          {base && zeroLoss != null ? (
            <>
              <StatusPill color="rgba(34,197,94,0.9)" label={`0L: ${zeroLoss}`} />
              <StatusPill color="rgba(245,158,11,0.9)" label={`1L: ${oneLoss ?? 0}`} />
              <StatusPill color="rgba(239,68,68,0.9)" label={`Out: ${outCount ?? 0}`} />
              {isCommissioner && currentWeekLabel ? (
                <StatusPill
                  color="rgba(255,255,255,0.70)"
                  label={currentWeekLabel}
                  title="Missing Pick badge is based on this week"
                />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Nav + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <nav style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
          </nav>

          <button
            onClick={onLogout}
            style={{
              cursor: "pointer",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 950,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              whiteSpace: "nowrap",
            }}
            title="Log out"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusPill({
  label,
  color,
  title,
}: {
  label: string;
  color: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        background: "rgba(255,255,255,0.06)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color, fontWeight: 950 }}>{label}</span>
    </span>
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
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "rgba(255,255,255,0.92)",
        textDecoration: "none",
        fontWeight: 900,
        fontSize: 13,
        padding: "6px 10px",
        borderRadius: 10,
        border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>

      {showBadge ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 950,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
          }}
          title={`${badge}`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}