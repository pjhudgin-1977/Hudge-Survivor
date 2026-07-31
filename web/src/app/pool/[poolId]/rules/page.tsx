import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_RULES = `ENTRY FEE

$20 per entry.


🏈 HOW TO PLAY

• Each week, pick one team to win.
• Win and you advance.
• A loss gives your entry one strike.
• This is a double-elimination pool. An entry is eliminated after 2 losses.


🔒 PICK LOCKING

• Your pick locks at the kickoff time of your selected team’s game or 1:00 PM ET Sunday, whichever comes first.
• Once a pick is locked, it cannot be changed.


🤖 AUTOPICKS

• When no pick is submitted before the deadline, the system may assign an autopick.
• The autopick uses the largest available point-spread favorite that the entry has not previously used.
• Autopicks are graded normally and count as the official pick for that week.
• Each entry may use a maximum of 3 autopicks during the season.
• After all 3 autopicks have been used, failing to make a pick results in a loss for that week.


🚫 TEAM RESTRICTIONS

• A team may be selected only once during the regular season.
• Team restrictions reset when the playoffs begin.
• Each team becomes available once again during the playoffs.


🏆 PLAYOFFS

• When 2 or more players survive the regular season, the pool continues into the playoffs.
• Eligible teams reset at the beginning of the playoffs.
• When an entry has no eligible team available in a playoff round, that entry receives a loss.
• If multiple players survive through the playoffs, undefeated players receive 2 shares and players with one loss receive 1 share.


💰 PRIZES

Prizes are paid after hosting fees:

• 1st Place: 60%
• 2nd Place: 25%
• 3rd Place: 10%
• 4th Place: 5%


⚖️ EDGE CASES

• Ties, cancellations, postponements, and statistical corrections may require a commissioner decision to keep the pool fair and moving.
• Automated results are used whenever possible.
• Commissioner decisions are final.`;

export default async function RulesPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect("/login");
  }

  const { poolId } = await params;

  const { data: pool } = await supabase
    .from("pools")
    .select("rules_text")
    .eq("id", poolId)
    .maybeSingle();

  const rulesText =
    String(pool?.rules_text ?? "").trim() || DEFAULT_RULES;

  const sections = rulesText
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 40px" }}>
      <Link
        href={`/pool/${poolId}`}
        style={{
          textDecoration: "none",
          fontWeight: 900,
          display: "inline-block",
          marginBottom: 10,
        }}
      >
        ← Back to Dashboard
      </Link>

      <h1
        style={{
          marginTop: 6,
          marginBottom: 8,
          fontSize: 30,
          fontWeight: 950,
        }}
      >
        Pool Rules
      </h1>

      <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.5 }}>
        Everything you need to know for making picks, surviving each week, and
        winning the pool.
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {sections.map((section, index) => {
          const lines = section
            .split("\n")
            .map((line) => line.trimEnd())
            .filter((line) => line.trim().length > 0);

          if (lines.length === 0) return null;

          const firstLine = lines[0];
          const remainingLines = lines.slice(1);

          const looksLikeHeading =
            firstLine === firstLine.toUpperCase() ||
            /^[^\w\s]/u.test(firstLine);

          return (
            <section
              key={`${firstLine}-${index}`}
              style={{
                padding: "16px 16px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              }}
            >
              {looksLikeHeading ? (
                <h2
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 950,
                    letterSpacing: 0.2,
                  }}
                >
                  {firstLine}
                </h2>
              ) : (
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    lineHeight: 1.6,
                  }}
                >
                  {firstLine}
                </div>
              )}

              {remainingLines.length > 0 ? (
                <div
                  style={{
                    marginTop: looksLikeHeading ? 10 : 8,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    opacity: 0.94,
                  }}
                >
                  {remainingLines.join("\n")}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
