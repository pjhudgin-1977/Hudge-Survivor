"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type PickRow = {
  user_id: string;
  week_number: number;
  phase: string;
  picked_team: string | null;
  was_autopick: boolean | null;
  result: string | null;
  counted_in_losses: boolean | null;
};

type MemberRow = {
  user_id: string;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
  entry_fee_paid: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

function normalizePhase(p: string | null | undefined) {
  const s = String(p ?? "").toLowerCase();
  if (s.includes("play")) return "playoffs";
  return "regular";
}

function nameInitialLine(fullName: string | null | undefined) {
  const s = String(fullName ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].slice(0, 1).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export default function PoolStandingsGridPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showNames, setShowNames] = useState(false);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [picks, setPicks] = useState<PickRow[]>([]);

  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [isCommissioner, setIsCommissioner] = useState(false);
  useEffect(() => {
    try {
      setIsCommissioner(sessionStorage.getItem("hudge_is_commissioner") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: m, error: mErr } = await supabase
          .from("pool_members")
          .select("user_id, screen_name, losses, is_eliminated, entry_fee_paid")
          .eq("pool_id", poolId);

        if (mErr) throw mErr;

        const mem = (m ?? []) as MemberRow[];

        const ids = mem.map((x) => x.user_id).filter(Boolean);
        const profMap: Record<string, ProfileRow> = {};

        if (ids.length > 0) {
          const { data: p, error: pErr } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);

          if (!pErr && p) {
            for (const row of p as ProfileRow[]) profMap[row.id] = row;
          }
        }

        const { data: pk, error: pkErr } = await supabase
          .from("picks")
          .select("user_id, week_number, phase, picked_team, was_autopick, result, counted_in_losses")
          .eq("pool_id", poolId);

        if (pkErr) throw pkErr;

        setMembers(mem);
        setProfilesById(profMap);
        setPicks((pk ?? []) as PickRow[]);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [poolId]);

  const columns = useMemo(() => {
    const cols: { key: string; label: string; phase: "regular" | "playoffs"; week: number }[] = [];
    for (let w = 1; w <= 17; w++) {
      cols.push({ key: `REG_${w}`, label: `W${w}`, phase: "regular", week: w });
    }
    for (let w = 1; w <= 4; w++) {
      cols.push({ key: `PO_${w}`, label: `P${w}`, phase: "playoffs", week: w });
    }
    return cols;
  }, []);

  const pickMap = useMemo(() => {
    const map: Record<string, PickRow> = {};
    for (const p of picks) {
      const phase = normalizePhase(p.phase) as "regular" | "playoffs";
      const week = Number(p.week_number);
      if (!p.user_id || !Number.isFinite(week)) continue;
      map[`${p.user_id}|${phase}|${week}`] = p;
    }
    return map;
  }, [picks]);

  const rows = useMemo(() => {
    const norm = (s: string) => s.toLowerCase();

    const list = members.map((m) => {
      const losses = Number(m.losses ?? 0);
      const eliminated = Boolean(m.is_eliminated) || losses >= 2;

      const screen = String(m.screen_name ?? "").trim() || "—";
      const fullLine = nameInitialLine(profilesById[m.user_id]?.full_name);

      const section = eliminated ? 2 : losses === 0 ? 0 : 1;

      return {
        user_id: m.user_id,
        screen_name: screen,
        full_name_line: fullLine,
        losses,
        eliminated,
        section,
        sortName: norm(screen),
        entry_fee_paid: Boolean(m.entry_fee_paid),
      };
    });

    list.sort((a, b) => {
      if (a.section !== b.section) return a.section - b.section;
      if (a.sortName < b.sortName) return -1;
      if (a.sortName > b.sortName) return 1;
      return 0;
    });

    return list;
  }, [members, profilesById]);

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "rgba(10, 12, 18, 0.92)",
    backdropFilter: "blur(6px)",
  };

  const stickyNameStyle: React.CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 3,
    background: "rgba(10, 12, 18, 0.96)",
    width: 240,
    minWidth: 240,
    maxWidth: 240,
    overflow: "hidden",
  };

  async function togglePaid(targetUserId: string) {
    if (!confirm("Toggle paid status?")) return;

    const current = members.find((m) => m.user_id === targetUserId);
    const nextVal = !Boolean(current?.entry_fee_paid);

    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId ? { ...m, entry_fee_paid: nextVal } : m
      )
    );

    setSavingUserId(targetUserId);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pool_members")
        .update({ entry_fee_paid: nextVal })
        .eq("pool_id", poolId)
        .eq("user_id", targetUserId);

      if (error) throw error;
    } catch (e: any) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetUserId ? { ...m, entry_fee_paid: !nextVal } : m
        )
      );
      alert(e?.message ?? "Update failed (permission/RLS).");
    } finally {
      setSavingUserId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
          Standings
        </div>
        <div style={{ opacity: 0.8 }}>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
          Standings
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,0,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 800 }}>Error</div>
          <div style={{ opacity: 0.9, marginTop: 6 }}>{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: 0.2 }}>
            Standings
          </div>
          <div style={{ opacity: 0.7, marginTop: 2, fontSize: 13 }}>
            Grid view • 17 Regular + 4 Playoffs • A = autopick • Strike-through = counted loss
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isCommissioner ? (
            <Link
              href={`/pool/${poolId}/standings2`}
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                fontWeight: 950,
                fontSize: 13,
                border: "1px solid rgba(255,255,255,0.24)",
                background: "rgba(255,255,255,0.12)",
                color: "white",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
              title="Go to Latest Picks (commissioner actions)"
            >
              Commissioner View →
            </Link>
          ) : null}

          <button
            onClick={() => setShowNames((v) => !v)}
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 900,
              fontSize: 13,
              border: "1px solid rgba(255,255,255,0.24)",
              background: showNames ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.25)",
              color: "white",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showNames ? "Hide names" : "Show names"}
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.18)",
          overflow: "auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <table
          style={{
            width: "max-content",
            minWidth: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            background: "rgba(10, 12, 18, 0.70)",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  ...headerStyle,
                  ...stickyNameStyle,
                  textAlign: "left",
                  padding: "12px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 950,
                }}
              >
                Players
              </th>

              <th
                style={{
                  ...headerStyle,
                  textAlign: "center",
                  padding: "12px 10px",
                  minWidth: 110,
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 950,
                  zIndex: 6,
                }}
              >
                Paid
              </th>

              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    ...headerStyle,
                    textAlign: "center",
                    padding: "12px 10px",
                    minWidth: 72,
                    borderBottom: "1px solid rgba(255,255,255,0.18)",
                    fontWeight: 950,
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const rowBg = r.eliminated
                ? "rgba(255,255,255,0.04)"
                : r.losses === 1
                ? "rgba(255,165,0,0.06)"
                : "rgba(0,0,0,0.10)";

              const isSaving = savingUserId === r.user_id;

              return (
                <tr key={r.user_id} style={{ background: rowBg }}>
                  <td
                    style={{
                      ...stickyNameStyle,
                      padding: showNames ? "10px 12px" : "12px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                      verticalAlign: "top",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 950, fontSize: 14 }}>
                        {r.screen_name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          opacity: r.eliminated ? 0.65 : 0.85,
                          whiteSpace: "nowrap",
                        }}
                        title="Losses"
                      >
                        L: {r.losses}
                      </div>
                    </div>

                    {showNames && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          opacity: 0.75,
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        {r.full_name_line || "—"}
                      </div>
                    )}
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      padding: "8px 8px",
                      minWidth: 110,
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                      fontWeight: 950,
                      position: "relative",
                      zIndex: 10,
                      background: "rgba(10, 12, 18, 0.70)",
                    }}
                  >
                    <button
                      disabled={isSaving}
                      onClick={() => togglePaid(r.user_id)}
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        padding: "6px 8px",
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(0,0,0,0.25)",
                        color: "white",
                        fontWeight: 950,
                        cursor: isSaving ? "default" : "pointer",
                        opacity: isSaving ? 0.65 : 1,
                      }}
                      title={r.entry_fee_paid ? "Entry fee paid" : "Not paid"}
                    >
                      {isSaving ? "Saving…" : r.entry_fee_paid ? "✅ Yes" : "❌ No"}
                    </button>
                  </td>

                  {columns.map((c) => {
                    const k = `${r.user_id}|${c.phase}|${c.week}`;
                    const p = pickMap[k];

                    const team = String(p?.picked_team ?? "").trim();
                    const auto = Boolean(p?.was_autopick);
                    const strike = p?.counted_in_losses === true;
                    const text = team ? `${team}${auto ? " A" : ""}` : "";

                    return (
                      <td
                        key={c.key}
                        title={`result=${String(p?.result ?? "")} counted=${String(
                          p?.counted_in_losses
                        )}`}
                        style={{
                          textAlign: "center",
                          padding: "10px 8px",
                          minWidth: 72,
                          borderBottom: "1px solid rgba(255,255,255,0.10)",
                          fontWeight: 950,
                          opacity: team ? 0.95 : 0.35,
                          textDecoration: strike ? "line-through" : "none",
                        }}
                      >
                        {text || "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Sorting: 0-loss section → 1-loss section → Eliminated, and within each section by user name.
      </div>
    </div>
  );
}