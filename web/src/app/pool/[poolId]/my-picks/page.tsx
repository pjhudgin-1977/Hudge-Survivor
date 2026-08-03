import { redirect } from "next/navigation";
import Link from "next/link";
import React from "react";
import { createClient } from "@/lib/supabase/server";

type PickRow = {
  pool_id: string;
  entry_no: number | null;
  week_number: number | null;
  phase: string | null;
  week_type: string | null;
  picked_team: string | null;
  submitted_at: string | null;
  locked: boolean | null;
  result: string | null;
  counted_in_losses: boolean | null;
  was_autopick: boolean | null;
};

function AutoPill() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 8,
        padding: "2px 7px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(0,0,0,0.25)",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.5,
        verticalAlign: "middle",
      }}
      title="This pick was automatically made by the system."
    >
      AUTO
    </span>
  );
}

function weekLabel(row: PickRow) {
  const phase = String(row.phase ?? "").toLowerCase();
  const week = row.week_number;

  if (week == null) return "Week —";
  if (phase === "playoffs") return `Playoff Week ${week}`;

  return `Week ${week}`;
}

function submittedLabel(row: PickRow) {
  if (!row.submitted_at) return "—";

  const date = new Date(row.submitted_at);
  if (Number.isNaN(date.getTime())) return "—";

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} ET`;
}

function resultMeta(result: string | null) {
  const normalized = String(result ?? "pending").toLowerCase();

  if (normalized === "win") {
    return {
      label: "Win",
      color: "#bbf7d0",
      background: "rgba(22,101,52,0.28)",
      border: "1px solid rgba(134,239,172,0.45)",
    };
  }

  if (normalized === "loss") {
    return {
      label: "Loss",
      color: "#fecaca",
      background: "rgba(127,29,29,0.28)",
      border: "1px solid rgba(248,113,113,0.45)",
    };
  }

  return {
    label: "Pending",
    color: "#fde68a",
    background: "rgba(120,53,15,0.28)",
    border: "1px solid rgba(251,191,36,0.45)",
  };
}

export default async function MyPicksPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: picksInPool, error } = await supabase
    .from("picks")
    .select(
      "pool_id, entry_no, week_number, phase, week_type, picked_team, submitted_at, locked, result, counted_in_losses, was_autopick"
    )
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .order("week_number", { ascending: false })
    .order("entry_no", { ascending: true })
    .order("submitted_at", { ascending: false });

  const picks = (picksInPool ?? []) as PickRow[];

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1050,
        margin: "0 auto",
        padding: "22px 18px 40px",
        boxSizing: "border-box",
      }}
    >
      <header
        className="pick-history-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950 }}>
            Pick History
          </h1>

          <p style={{ marginTop: 7, marginBottom: 0, opacity: 0.72 }}>
            Your saved picks for this pool.
          </p>
        </div>

        <div
          className="pick-history-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <Link
            href={`/pool/${poolId}/pick`}
            style={{
              display: "inline-block",
              padding: "10px 13px",
              borderRadius: 11,
              fontWeight: 900,
              textDecoration: "none",
              border: "1px solid #f97316",
              background: "#f97316",
              color: "#000",
            }}
          >
            Back to Pick
          </Link>

          <Link
            href={`/pool/${poolId}`}
            style={{
              display: "inline-block",
              padding: "10px 13px",
              borderRadius: 11,
              fontWeight: 800,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {error ? (
        <div style={errorBoxStyle}>
          <strong>Could not load your picks:</strong>{" "}
          <span style={{ opacity: 0.9 }}>{error.message}</span>
        </div>
      ) : null}

      <section
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(10,12,18,0.55)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontSize: 18,
            fontWeight: 900,
            background: "rgba(0,0,0,0.3)",
          }}
        >
          Your picks ({picks.length})
        </div>

        {picks.length === 0 ? (
          <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 850 }}>No picks saved yet.</div>

            <div style={{ marginTop: 5, opacity: 0.72 }}>
              Your pick history will appear here after you save a pick.
            </div>
          </div>
        ) : (
          <>
            <div className="pick-history-desktop">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 100px 150px 1fr 120px",
                  padding: "12px 16px",
                  fontWeight: 900,
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <div>Week</div>
                <div>Entry</div>
                <div>Pick</div>
                <div>Submitted</div>
                <div>Status</div>
              </div>

              {picks.map((row, index) => {
                const status = resultMeta(row.result);

                return (
                  <div
                    key={`${row.pool_id}-${row.entry_no}-${row.week_number}-${row.phase}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 100px 150px 1fr 120px",
                      alignItems: "center",
                      padding: "14px 16px",
                      borderTop:
                        "1px solid rgba(255,255,255,0.09)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {weekLabel(row)}
                    </div>

                    <div>Entry {row.entry_no ?? 1}</div>

                    <div style={{ fontWeight: 950 }}>
                      {row.picked_team ?? "—"}
                      {row.was_autopick ? <AutoPill /> : null}
                    </div>

                    <div style={{ opacity: 0.82 }}>
                      {submittedLabel(row)}
                    </div>

                    <div>
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: 76,
                          padding: "5px 9px",
                          borderRadius: 999,
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 900,
                          color: status.color,
                          background: status.background,
                          border: status.border,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pick-history-mobile">
              {picks.map((row, index) => {
                const status = resultMeta(row.result);

                return (
                  <article
                    key={`mobile-${row.pool_id}-${row.entry_no}-${row.week_number}-${row.phase}-${index}`}
                    style={{
                      padding: 15,
                      borderTop:
                        index === 0
                          ? "none"
                          : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 950 }}>
                          {weekLabel(row)} · Entry {row.entry_no ?? 1}
                        </div>

                        <div style={{ marginTop: 7 }}>
                          Pick:{" "}
                          <strong style={{ color: "#fdba74" }}>
                            {row.picked_team ?? "—"}
                          </strong>

                          {row.was_autopick ? <AutoPill /> : null}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "5px 9px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          color: status.color,
                          background: status.background,
                          border: status.border,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        opacity: 0.72,
                      }}
                    >
                      Submitted: {submittedLabel(row)}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <style>{`
        .pick-history-mobile {
          display: none;
        }

        @media (max-width: 700px) {
          .pick-history-header {
            display: grid !important;
          }

          .pick-history-actions {
            justify-content: flex-start !important;
          }

          .pick-history-desktop {
            display: none;
          }

          .pick-history-mobile {
            display: block;
          }
        }
      `}</style>
    </main>
  );
}

const errorBoxStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(127,29,29,0.18)",
  color: "#fecaca",
};
