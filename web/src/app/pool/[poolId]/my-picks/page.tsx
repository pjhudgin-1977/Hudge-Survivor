import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function AutoPill() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 10,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(0,0,0,0.25)",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.6,
        verticalAlign: "middle",
      }}
      title="This pick was automatically made by the system (Autopick)."
      aria-label="Autopick"
    >
      <span aria-hidden="true">⚙️</span>
      AUTO
    </span>
  );
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
  const userId = auth.user.id;

  const { data: picksInPool, error: poolErr } = await supabase
    .from("picks")
    .select(
      "pool_id, week_number, phase, week_type, picked_team, submitted_at, locked, result, counted_in_losses, was_autopick"
    )
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .order("week_number", { ascending: false })
    .order("submitted_at", { ascending: false });

  const inPool: any[] = Array.isArray(picksInPool) ? picksInPool : [];

  // If none found in this pool, fetch recent picks across all pools for this user
  const { data: recentAnyPool, error: anyErr } = inPool.length
    ? { data: null, error: null }
    : await supabase
        .from("picks")
        .select("pool_id, week_number, phase, picked_team, submitted_at, was_autopick")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(10);

  const anyPool: any[] = Array.isArray(recentAnyPool) ? recentAnyPool : [];

  const weekLabel = (r: any) => {
    const phase = String(r?.phase ?? "").toLowerCase();
    const wn = r?.week_number;
    if (wn == null) return "Week ?";
    if (phase === "playoffs") return `Playoff W${Number(wn)}`;
    return `Week ${Number(wn)}`;
  };

  const submittedLabel = (r: any) =>
    r?.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—";

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>My Picks</h1>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Signed in as: <strong>{auth.user.email ?? "user"}</strong>
            <br />
            PoolId (from URL): <strong>{poolId}</strong>
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <Link
            href={`/pool/${poolId}/pick`}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,128,0,0.18)",
            }}
          >
            Go Make / Edit Pick →
          </Link>
          <div style={{ marginTop: 10 }}>
            <Link href={`/pool/${poolId}`} style={{ textDecoration: "none" }}>
              ← Back to Pool Dashboard
            </Link>
          </div>
        </div>
      </div>

      {poolErr ? (
        <div style={errBox()}>
          <strong>Pool picks query error:</strong>{" "}
          <span style={{ opacity: 0.9 }}>{poolErr.message}</span>
        </div>
      ) : null}

      <div style={card()}>
        <div style={cardHeader()}>Picks in this pool ({inPool.length})</div>

        {inPool.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.85 }}>
            No picks found yet for this pool.
          </div>
        ) : (
          <div>
            <RowHeader />
            {inPool.map((r: any, idx: number) => (
              <Row
                key={`${r.pool_id}|${r.week_number}|${r.phase}|${idx}`}
                week={weekLabel(r)}
                pick={r?.picked_team ?? "—"}
                wasAutopick={Boolean(r?.was_autopick)}
                submitted={submittedLabel(r)}
                result={r?.result ? String(r.result) : "—"}
              />
            ))}
          </div>
        )}
      </div>

      {!inPool.length ? (
        <div style={{ marginTop: 18 }}>
          {anyErr ? (
            <div style={errBox()}>
              <strong>Recent picks query error:</strong>{" "}
              <span style={{ opacity: 0.9 }}>{anyErr.message}</span>
            </div>
          ) : null}

          <div style={card()}>
            <div style={cardHeader()}>
              Recent picks across ANY pool ({anyPool.length})
            </div>

            {anyPool.length === 0 ? (
              <div style={{ padding: 14, opacity: 0.85 }}>
                No picks found anywhere for this user.
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "360px 140px 200px 1fr",
                    padding: "12px 14px",
                    fontWeight: 900,
                    background: "rgba(0,0,0,0.35)",
                  }}
                >
                  <div>pool_id</div>
                  <div>Week</div>
                  <div>Pick</div>
                  <div>Submitted</div>
                </div>

                {anyPool.map((r: any, idx: number) => (
                  <div
                    key={`${r.pool_id}|${idx}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "360px 140px 200px 1fr",
                      padding: "12px 14px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      opacity: 0.95,
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {String(r.pool_id)}
                    </div>
                    <div style={{ fontWeight: 900 }}>{weekLabel(r)}</div>

                    <div style={{ fontWeight: 900 }}>
                      {r?.picked_team ? String(r.picked_team) : "—"}
                      {r?.was_autopick ? <AutoPill /> : null}
                    </div>

                    <div>{submittedLabel(r)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function cardHeader(): React.CSSProperties {
  return {
    padding: "12px 14px",
    fontWeight: 900,
    background: "rgba(0,0,0,0.35)",
  };
}

function errBox(): React.CSSProperties {
  return {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,0,0,0.25)",
    background: "rgba(255,0,0,0.10)",
  };
}

function RowHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 200px 180px 1fr",
        padding: "12px 14px",
        fontWeight: 900,
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div>Week</div>
      <div>Pick</div>
      <div>Submitted</div>
      <div>Result</div>
    </div>
  );
}

function Row({
  week,
  pick,
  wasAutopick,
  submitted,
  result,
}: {
  week: string;
  pick: string;
  wasAutopick: boolean;
  submitted: string;
  result: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 200px 180px 1fr",
        padding: "12px 14px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontWeight: 900 }}>{week}</div>

      <div style={{ fontWeight: 900 }}>
        {pick}
        {wasAutopick ? <AutoPill /> : null}
      </div>

      <div style={{ opacity: 0.9 }}>{submitted}</div>
      <div style={{ opacity: 0.9 }}>{result}</div>
    </div>
  );
}