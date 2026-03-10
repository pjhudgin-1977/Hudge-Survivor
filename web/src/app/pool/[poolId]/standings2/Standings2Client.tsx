"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type Phase = "regular" | "playoffs";

type MemberRow = {
  user_id: string;
  entry_no: number;
  screen_name: string | null;
  entry_fee_paid: boolean | null;
  autopicks_used: number | null;

  latest_pick_team?: string | null;
  latest_pick_week?: number | null;
  latest_pick_phase?: string | null;
  latest_pick_result?: string | null;
  latest_pick_locked?: boolean | null;
  latest_pick_was_autopick?: boolean | null;

  latest_pick_submitted_at?: string | null;
};

function AutoBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(0,0,0,0.25)",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.4,
      }}
      title="Autopick"
    >
      AUTO
    </span>
  );
}

function fmtPhase(p: string | null | undefined) {
  if (!p) return "—";
  return p === "regular" ? "REG" : "PO";
}

function fmtBool(v: boolean | null | undefined) {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

function safeStr(v: any) {
  return v == null || v === "" ? "—" : String(v);
}

function rowKey(userId: string, entryNo: number) {
  return `${userId}|${entryNo}`;
}

export default function Standings2Client(props: {
  poolId: string;
  isCommissioner: boolean;
  rows: MemberRow[];
}) {
  const { poolId, isCommissioner, rows } = props;

  const [forceOpen, setForceOpen] = useState(false);
  const [forceUserId, setForceUserId] = useState<string | null>(null);
  const [forceEntryNo, setForceEntryNo] = useState<number | null>(null);
  const [forceTeams, setForceTeams] = useState<string[]>([]);
  const [forceTeam, setForceTeam] = useState<string>("");
  const [forceBusy, setForceBusy] = useState(false);

  const [currentWeek, setCurrentWeek] = useState<{
    week_number: number;
    phase: Phase;
  } | null>(null);

  async function loadCurrentWeek(supabase: ReturnType<typeof createClient>) {
    const nowIso = new Date().toISOString();

    const { data: nextGame, error: nextErr } = await supabase
      .from("games")
      .select("week_number, phase, kickoff_at")
      .gte("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextErr) throw nextErr;

    if (nextGame?.week_number != null && nextGame?.phase) {
      return {
        week_number: Number(nextGame.week_number),
        phase: nextGame.phase as Phase,
      };
    }

    const { data: lastGame, error: lastErr } = await supabase
      .from("games")
      .select("week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw lastErr;

    if (lastGame?.week_number != null && lastGame?.phase) {
      return {
        week_number: Number(lastGame.week_number),
        phase: lastGame.phase as Phase,
      };
    }

    return null;
  }

  async function togglePaid(
    userId: string,
    entryNo: number,
    nextPaid: boolean
  ) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pool_members")
        .update({
          entry_fee_paid: nextPaid,
          entry_fee_paid_at: nextPaid ? new Date().toISOString() : null,
        })
        .eq("pool_id", poolId)
        .eq("user_id", userId)
        .eq("entry_no", entryNo);

      if (error) throw error;

      window.location.reload();
    } catch (e: any) {
      alert(`Mark Paid failed: ${e?.message || String(e)}`);
    }
  }

  async function resetAutopicks(userId: string, entryNo: number) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pool_members")
        .update({ autopicks_used: 0 })
        .eq("pool_id", poolId)
        .eq("user_id", userId)
        .eq("entry_no", entryNo);

      if (error) throw error;

      window.location.reload();
    } catch (e: any) {
      alert(`Reset Autopicks failed: ${e?.message || String(e)}`);
    }
  }

  async function fetchEligibleTeams(
    userId: string,
    entryNo: number,
    cw: { week_number: number; phase: Phase }
  ) {
    const qs = new URLSearchParams({
      userId,
      entryNo: String(entryNo),
      week: String(cw.week_number),
      phase: String(cw.phase),
    });

    const res = await fetch(
      `/api/pool/${poolId}/members/${userId}/eligible-teams?${qs.toString()}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Eligible teams failed: ${txt || res.statusText}`);
    }

    const json = await res.json();
    return (json?.teams || []) as string[];
  }

  async function forcePickSubmit() {
    if (!forceUserId || forceEntryNo == null) return;

    try {
      setForceBusy(true);
      const supabase = createClient();

      let cw = currentWeek;
      if (!cw) {
        cw = await loadCurrentWeek(supabase);
        setCurrentWeek(cw);
      }
      if (!cw) {
        alert("No current week found.");
        return;
      }

      const basePayload = {
        pool_id: poolId,
        user_id: forceUserId,
        entry_no: forceEntryNo,
        week_number: cw.week_number,
        phase: cw.phase,
        picked_team: forceTeam,
        submitted_at: new Date().toISOString(),
        was_autopick: false,
      };

      const { data: existing, error: existingErr } = await supabase
        .from("picks")
        .select("pool_id, user_id, entry_no, week_number, phase")
        .eq("pool_id", poolId)
        .eq("user_id", forceUserId)
        .eq("entry_no", forceEntryNo)
        .eq("week_number", cw.week_number)
        .eq("phase", cw.phase)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing) {
        const { error: updateErr } = await supabase
          .from("picks")
          .update({
            picked_team: forceTeam,
            submitted_at: new Date().toISOString(),
            was_autopick: false,
          })
          .eq("pool_id", poolId)
          .eq("user_id", forceUserId)
          .eq("entry_no", forceEntryNo)
          .eq("week_number", cw.week_number)
          .eq("phase", cw.phase);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("picks")
          .insert(basePayload as any);

        if (insertErr) throw insertErr;
      }

      setForceOpen(false);
      setForceUserId(null);
      setForceEntryNo(null);
      setForceTeams([]);
      setForceTeam("");

      window.location.reload();
    } catch (e: any) {
      alert(`Force Pick failed: ${e?.message || String(e)}`);
    } finally {
      setForceBusy(false);
    }
  }

  async function openForcePick(userId: string, entryNo: number) {
    try {
      const supabase = createClient();

      let cw = currentWeek;
      if (!cw) {
        cw = await loadCurrentWeek(supabase);
        setCurrentWeek(cw);
      }
      if (!cw) {
        alert("No current week found yet.");
        return;
      }

      setForceUserId(userId);
      setForceEntryNo(entryNo);
      setForceTeam("");
      setForceTeams([]);
      setForceOpen(true);

      const teams = await fetchEligibleTeams(userId, entryNo, cw);
      setForceTeams(teams);
      if (teams.length === 1) setForceTeam(teams[0]);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  const headerWeekLabel = useMemo(() => {
    if (!currentWeek) return "current week";
    return `${fmtPhase(currentWeek.phase)} W${currentWeek.week_number}`;
  }, [currentWeek]);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
            Latest Picks
          </h1>
          <div style={{ opacity: 0.85, marginTop: 4, fontSize: 13 }}>
            Shows the most recent pick per entry (prefers <b>{headerWeekLabel}</b>{" "}
            if that entry picked this week).
            {isCommissioner ? " Commissioner actions are enabled." : ""}
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.2)",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 980,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "rgba(255,255,255,0.06)",
                textAlign: "left",
              }}
            >
              <th style={{ padding: 10 }}>Player</th>
              <th style={{ padding: 10 }}>Paid</th>
              <th style={{ padding: 10 }}>Autopicks Used</th>
              <th style={{ padding: 10 }}>Latest Pick</th>
              <th style={{ padding: 10 }}>Pick Week/Phase</th>
              <th style={{ padding: 10 }}>Result</th>
              <th style={{ padding: 10 }}>Locked</th>
              {isCommissioner && (
                <th style={{ padding: 10, textAlign: "right" }}>Actions</th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={isCommissioner ? 8 : 7}
                  style={{ padding: 12, opacity: 0.8 }}
                >
                  No members found.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const latestTeam = r.latest_pick_team;
                const latestTitle = r.latest_pick_submitted_at
                  ? `Submitted: ${r.latest_pick_submitted_at}`
                  : "";

                return (
                  <tr
                    key={rowKey(r.user_id, Number(r.entry_no ?? 1))}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <td style={{ padding: 10, fontWeight: 900 }}>
                      {safeStr(r.screen_name)} #{Number(r.entry_no ?? 1)}
                    </td>

                    <td style={{ padding: 10 }}>
                      <Link
                        href={`/pool/${poolId}/payment`}
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: r.entry_fee_paid
                            ? "rgba(34,197,94,0.18)"
                            : "rgba(255,255,255,0.10)",
                          color: "white",
                          fontWeight: 800,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.entry_fee_paid ? "Paid" : "Pay Now"}
                      </Link>
                    </td>

                    <td style={{ padding: 10 }}>
                      {safeStr(r.autopicks_used ?? 0)}
                    </td>

                    <td
                      style={{ padding: 10, fontWeight: 900 }}
                      title={latestTitle}
                    >
                      {latestTeam ? (
                        <>
                          {latestTeam}
                          {r.latest_pick_was_autopick ? <AutoBadge /> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {r.latest_pick_week != null && r.latest_pick_phase ? (
                        <>
                          {fmtPhase(r.latest_pick_phase)} W{r.latest_pick_week}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {safeStr(r.latest_pick_result)}
                    </td>

                    <td style={{ padding: 10 }}>
                      {fmtBool(r.latest_pick_locked ?? null)}
                    </td>

                    {isCommissioner && (
                      <td style={{ padding: 10, textAlign: "right" }}>
                        <details style={{ display: "inline-block" }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              listStyle: "none",
                              userSelect: "none",
                              fontWeight: 900,
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.2)",
                              background: "rgba(0,0,0,0.2)",
                              display: "inline-block",
                            }}
                            title="Actions"
                          >
                            ⚙️
                          </summary>

                          <div
                            style={{
                              position: "absolute",
                              marginTop: 8,
                              right: 18,
                              minWidth: 220,
                              padding: 10,
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.18)",
                              background: "rgba(15,15,15,0.95)",
                              boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                              zIndex: 50,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.8,
                                marginBottom: 8,
                              }}
                            >
                              Entry #{Number(r.entry_no ?? 1)}
                            </div>

                            <button
                              style={menuBtnStyle}
                              onClick={() =>
                                togglePaid(
                                  r.user_id,
                                  Number(r.entry_no ?? 1),
                                  !r.entry_fee_paid
                                )
                              }
                            >
                              {r.entry_fee_paid ? "Mark Unpaid" : "Mark Paid"}
                            </button>

                            <button
                              style={menuBtnStyle}
                              onClick={() =>
                                resetAutopicks(r.user_id, Number(r.entry_no ?? 1))
                              }
                            >
                              Reset Autopicks
                            </button>

                            <button
                              style={menuBtnStyle}
                              onClick={() =>
                                openForcePick(r.user_id, Number(r.entry_no ?? 1))
                              }
                            >
                              Force Pick
                            </button>
                          </div>
                        </details>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {forceOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100,
          }}
          onClick={() => {
            if (!forceBusy) setForceOpen(false);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "rgba(20,20,20,0.98)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 16,
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Force Pick</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                  Entry #{forceEntryNo ?? "—"}
                </div>
              </div>

              <button
                onClick={() => setForceOpen(false)}
                disabled={forceBusy}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 6,
                }}
              >
                Eligible teams
              </label>
              <select
                value={forceTeam}
                onChange={(e) => setForceTeam(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.2)",
                  color: "inherit",
                  fontWeight: 900,
                }}
              >
                <option value="">Select…</option>
                {forceTeams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setForceOpen(false)}
                  disabled={forceBusy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={forcePickSubmit}
                  disabled={forceBusy || !forceTeam}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.10)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {forceBusy ? "Saving…" : "Save Pick"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              If eligible teams don’t load, we’ll adjust the endpoint next step.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.15)",
  cursor: "pointer",
  fontWeight: 900,
  marginTop: 8,
};