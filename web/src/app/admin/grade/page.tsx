import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type GradeRun = {
  id: string;
  ran_at: string;
  status: string;
  message: string | null;
  duration_ms: number | null;
  details: any | null;
};

export default async function AdminGradePage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  // NOTE: If you already have an admin check helper/pattern, swap it in here.
  // For now we simply require login (same as many of your early admin pages).
  // You can tighten later with a commissioner/admin flag.

  const { data: runs, error } = await supabase
    .from("grade_runs")
    .select("id, ran_at, status, message, duration_ms, details")
    .order("ran_at", { ascending: false })
    .limit(25);

  const list = (runs ?? []) as GradeRun[];
  const lastRun = list[0] ?? null;

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Admin • Grading</h1>
        <Link href="/admin" style={{ opacity: 0.8, textDecoration: "underline" }}>
          Back to Admin
        </Link>
      </div>

      {error ? (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error loading grade_runs: {error.message}
        </p>
      ) : null}

      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Last run</h2>

        {!lastRun ? (
          <p style={{ marginTop: 8, opacity: 0.85 }}>No runs yet.</p>
        ) : (
          <div style={{ marginTop: 10, lineHeight: 1.6 }}>
            <div>
              <strong>Status:</strong> {lastRun.status}
            </div>
            <div>
              <strong>Ran at:</strong>{" "}
              {new Date(lastRun.ran_at).toLocaleString()}
            </div>
            <div>
              <strong>Duration:</strong>{" "}
              {lastRun.duration_ms != null ? `${lastRun.duration_ms}ms` : "—"}
            </div>
            <div>
              <strong>Message:</strong> {lastRun.message ?? "—"}
            </div>

            {lastRun.details ? (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>Details</summary>
                <pre
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.25)",
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(lastRun.details, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <form action="/api/cron/grade" method="get">
            {/* Dev-only convenience: in production you should NOT expose CRON_SECRET in a form.
                We'll keep this button for LOCAL use only in Step 15. */}
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Run grading now (local only)
            </button>
          </form>
          <p style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            This button is intended for <strong>localhost</strong>. In production,
            grading should run via Vercel Cron with the secret.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recent runs</h2>
        <div style={{ marginTop: 10 }}>
          {list.length === 0 ? (
            <p style={{ opacity: 0.85 }}>No runs to show.</p>
          ) : (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {list.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.status}</div>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      {new Date(r.ran_at).toLocaleString()}
                      {r.duration_ms != null ? ` • ${r.duration_ms}ms` : ""}
                    </div>
                    {r.message ? (
                      <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>
                        {r.message}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ opacity: 0.85, fontSize: 13, textAlign: "right" }}>
                    {r.details?.updated_count != null ? (
                      <div>
                        <strong>updated:</strong> {r.details.updated_count}
                      </div>
                    ) : (
                      <div>—</div>
                    )}
                    {r.details?.phase && r.details?.week_number != null ? (
                      <div>
                        {String(r.details.phase)} • W{String(r.details.week_number)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}