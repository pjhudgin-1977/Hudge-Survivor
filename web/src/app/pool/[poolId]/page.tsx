"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type PickRow = {
  user_id: string;
  entry_no: number;
  week_number: number;
  phase: string;
  picked_team: string | null;
  was_autopick: boolean | null;
  result: string | null;
  counted_in_losses: boolean | null;
};

type MemberRow = {
  user_id: string;
  entry_no: number;
  screen_name: string | null;
  losses: number | null;
  is_eliminated: boolean | null;
  entry_fee_paid: boolean | null;
};

type ProfileRow = {
  user_id: string;
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
  const [commissionerNote, setCommissionerNote] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
    {}
  );
  const [picks, setPicks] = useState<PickRow[]>([]);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
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
        const { data: auth } = await supabase.auth.getUser();
        setMyUserId(auth?.user?.id ?? null);

        try {
          const { data: poolRow } = await supabase
            .from("pools")
            .select("commissioner_note")
            .eq("id", poolId)
            .maybeSingle();

          setCommissionerNote((poolRow as any)?.commissioner_note ?? null);
        } catch {
          setCommissionerNote(null);
        }

        const { data: m, error: mErr } = await supabase
          .from("pool_members")
          .select(
            "user_id, entry_no, screen_name, losses, is_eliminated, entry_fee_paid"
          )
          .eq("pool_id", poolId)
          .order("entry_no", { ascending: true });

        if (mErr) throw mErr;

        const mem = (m ?? []) as MemberRow[];

        const ids = Array.from(new Set(mem.map((x) => x.user_id).filter(Boolean)));
        const profMap: Record<string, ProfileRow> = {};

        if (ids.length > 0) {
          const { data: p, error: pErr } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", ids);

          if (!pErr && p) {
            for (const row of p as ProfileRow[]) profMap[row.user_id] = row;
          }
        }

        const { data: pk, error: pkErr } = await supabase
          .from("picks")
          .select(
            "user_id, entry_no, week_number, phase, picked_team, was_autopick, result, counted_in_losses"
          )
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
    const cols: {
      key: string;
      label: string;
      phase: "regular" | "playoffs";
      week: number;
    }[] = [];

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
      const entryNo = Number(p.entry_no ?? 1);

      if (!p.user_id || !Number.isFinite(week) || !Number.isFinite(entryNo)) {
        continue;
      }

      map[`${p.user_id}|${entryNo}|${phase}|${week}`] = p;
    }

    return map;
  }, [picks]);

  const rows = useMemo(() => {
    const norm = (s: string) => s.toLowerCase();

    const list = members.map((m) => {
      const losses = Number(m.losses ?? 0);
      const eliminated = Boolean(m.is_eliminated) || losses >= 2;
      const entryNo = Number(m.entry_no ?? 1);

      const baseScreen = String(m.screen_name ?? "").trim() || "—";
      const screen = `${baseScreen} #${entryNo}`;
      const fullLine = nameInitialLine(profilesById[m.user_id]?.full_name);

      const section = eliminated ? 2 : losses === 0 ? 0 : 1;

      return {
        row_key: `${m.user_id}|${entryNo}`,
        user_id: m.user_id,
        entry_no: entryNo,
        screen_name: screen,
        full_name_line: fullLine,
        losses,
        eliminated,
        section,
        sortName: `${norm(baseScreen)}|${String(entryNo).padStart(3, "0")}`,
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

  const totalEntries = rows.length;
  const aliveEntries = rows.filter((r) => !r.eliminated).length;
  const lastLifeEntries = rows.filter(
    (r) => !r.eliminated && r.losses === 1
  ).length;
  const eliminatedEntries = rows.filter((r) => r.eliminated).length;
  const paidEntries = rows.filter((r) => r.entry_fee_paid).length;

  const myEntries = rows.filter((r) => r.user_id === myUserId);
  const myPaidCount = myEntries.filter((r) => r.entry_fee_paid).length;
  const canAddEntry = Boolean(myUserId) && myEntries.length < 3;

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
    width: 260,
    minWidth: 260,
    maxWidth: 260,
    overflow: "hidden",
  };

  async function togglePaid(targetUserId: string, targetEntryNo: number) {
    if (!confirm("Toggle paid status?")) return;

    const key = `${targetUserId}|${targetEntryNo}`;
    const current = members.find(
      (m) => m.user_id === targetUserId && Number(m.entry_no ?? 1) === targetEntryNo
    );
    const nextVal = !Boolean(current?.entry_fee_paid);

    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId && Number(m.entry_no ?? 1) === targetEntryNo
          ? { ...m, entry_fee_paid: nextVal }
          : m
      )
    );

    setSavingKey(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pool_members")
        .update({ entry_fee_paid: nextVal })
        .eq("pool_id", poolId)
        .eq("user_id", targetUserId)
        .eq("entry_no", targetEntryNo);

      if (error) throw error;
    } catch (e: any) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetUserId && Number(m.entry_no ?? 1) === targetEntryNo
            ? { ...m, entry_fee_paid: !nextVal }
            : m
        )
      );
      alert(e?.message ?? "Update failed (permission/RLS).");
    } finally {
      setSavingKey(null);
    }
  }

  async function addEntry() {
    if (!myUserId) return;
    if (myEntries.length >= 3) return;

    setAddingEntry(true);

    try {
      const supabase = createClient();
      const nextEntryNo =
        Math.max(...myEntries.map((e) => Number(e.entry_no ?? 1)), 0) + 1;

      const baseMember = members.find((m) => m.user_id === myUserId);
      const nextScreenName =
        String(baseMember?.screen_name ?? "").trim() || "Player";

      const { error } = await supabase.from("pool_members").insert({
        pool_id: poolId,
        user_id: myUserId,
        entry_no: nextEntryNo,
        screen_name: nextScreenName,
        losses: 0,
        is_eliminated: false,
        entry_fee_paid: false,
      });

      if (error) throw error;

      window.location.reload();
    } catch (e: any) {
      alert(e?.message ?? "Could not add entry.");
    } finally {
      setAddingEntry(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: 0.2 }}>
          Dashboard
        </div>
        <div style={{ opacity: 0.8 }}>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
          Dashboard
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
            Dashboard
          </div>
          <div style={{ opacity: 0.7, marginTop: 2, fontSize: 13 }}>
            Grid view • 17 Regular + 4 Playoffs • A = autopick • Strike-through =
            counted loss
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
              background: showNames
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.25)",
              color: "white",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showNames ? "Hide names" : "Show names"}
          </button>
        </div>
      </div>

      {myEntries.length > 0 && (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              opacity: 0.75,
              marginBottom: 10,
            }}
          >
            YOUR ENTRIES
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {myEntries.map((entry) => {
              const entryPicks = picks
                .filter(
                  (p) =>
                    p.user_id === entry.user_id &&
                    Number(p.entry_no ?? 1) === entry.entry_no
                )
                .sort(
                  (a, b) => Number(b.week_number ?? 0) - Number(a.week_number ?? 0)
                );

              const latestPick = entryPicks[0];
              const latestTeam = String(latestPick?.picked_team ?? "").trim() || "—";

              const statusText = entry.eliminated
                ? "❌ Eliminated"
                : entry.losses === 1
                ? "⚠️ Last Life"
                : "🐻 Alive";

              return (
                <div
                  key={`my-entry-${entry.user_id}-${entry.entry_no}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px, 1fr) 140px 140px 140px",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 950 }}>{entry.screen_name}</div>
                    {showNames && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {entry.full_name_line || "—"}
                      </div>
                    )}
                  </div>

                  <div style={{ fontWeight: 900, opacity: 0.92 }}>{statusText}</div>

                  <div style={{ fontWeight: 900, opacity: 0.92 }}>
                    Pick: {latestTeam}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <Link
                      href={`/pool/${poolId}/pick?entry=${entry.entry_no}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 10,
                        textDecoration: "none",
                        fontWeight: 900,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,128,0,0.18)",
                        color: "white",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Make Pick
                    </Link>
                  </div>
                </div>
              );
            })}

            {canAddEntry && (
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={addingEntry}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 900,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(0,128,255,0.18)",
                    color: "white",
                    cursor: addingEntry ? "default" : "pointer",
                    opacity: addingEntry ? 0.65 : 1,
                  }}
                >
                  {addingEntry ? "Adding..." : "+ Add Entry"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {myEntries.length > 0 && (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            padding: "14px 16px",
            marginTop: 32,
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
              PAYMENT STATUS
            </div>

            <div style={{ fontSize: 18, fontWeight: 950, marginTop: 4 }}>
              {myPaidCount} / {myEntries.length} Entries Paid
            </div>
          </div>

          <Link
            href={`/pool/${poolId}/payment`}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(0,128,255,0.18)",
              fontWeight: 900,
              textDecoration: "none",
              color: "white",
              whiteSpace: "nowrap",
            }}
          >
            {myPaidCount >= myEntries.length ? "Paid" : "Pay Now"}
          </Link>
        </div>
      )}

      {commissionerNote && commissionerNote.trim() !== "" && (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            padding: "14px 16px",
            marginTop: 32,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              opacity: 0.75,
              marginBottom: 6,
            }}
          >
            COMMISSIONER MESSAGE
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.4,
              opacity: 0.95,
            }}
          >
            {commissionerNote}
          </div>
        </div>
      )}

      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          marginTop: 32,
          marginBottom: 12,
        }}
      >
        Overall Standings
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={snapshotCardStyle}>
          <div style={snapshotLabelStyle}>Alive</div>
          <div style={snapshotValueStyle}>🐻 {aliveEntries}</div>
        </div>

        <div style={snapshotCardStyle}>
          <div style={snapshotLabelStyle}>Last Life</div>
          <div style={snapshotValueStyle}>⚠️ {lastLifeEntries}</div>
        </div>

        <div style={snapshotCardStyle}>
          <div style={snapshotLabelStyle}>Eliminated</div>
          <div style={snapshotValueStyle}>❌ {eliminatedEntries}</div>
        </div>

        <div style={snapshotCardStyle}>
          <div style={snapshotLabelStyle}>Paid</div>
          <div style={snapshotValueStyle}>💵 {paidEntries}</div>
        </div>

        <div style={snapshotCardStyle}>
          <div style={snapshotLabelStyle}>Total Entries</div>
          <div style={snapshotValueStyle}>{totalEntries}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
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

              const isSaving = savingKey === `${r.user_id}|${r.entry_no}`;

              return (
                <tr key={r.row_key} style={{ background: rowBg }}>
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

                    <div style={{ marginTop: 8 }}>
                      <Link
                        href={`/pool/${poolId}/pick?entry=${r.entry_no}`}
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: 10,
                          textDecoration: "none",
                          fontWeight: 900,
                          fontSize: 12,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: "rgba(255,128,0,0.18)",
                          color: "white",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Pick Entry {r.entry_no}
                      </Link>
                    </div>
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
                      onClick={() => togglePaid(r.user_id, r.entry_no)}
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
                    const k = `${r.user_id}|${r.entry_no}|${c.phase}|${c.week}`;
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

      <div style={{ marginTop: 32, opacity: 0.65, fontSize: 12 }}>
        Sorting: 0-loss section → 1-loss section → Eliminated, and within each
        section by user name + entry number.
      </div>
    </div>
  );
}

const snapshotCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  padding: "14px 16px",
};

const snapshotLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.72,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const snapshotValueStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 24,
  fontWeight: 950,
};