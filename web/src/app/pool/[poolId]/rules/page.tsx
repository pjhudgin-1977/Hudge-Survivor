import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { poolId } = await params;

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

      <h1 style={{ marginTop: 6, marginBottom: 8, fontSize: 30, fontWeight: 950 }}>
        Pool Rules
      </h1>

      <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.5 }}>
        Everything you need to know for making picks, surviving each week, and
        winning the pool.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.25)",
          fontWeight: 800,
        }}
      >
        💳 Entry fee: <strong>$20</strong>
      </div>

      <section style={section()}>
        <h2 style={h2()}>🏈 How to Play</h2>
        <ul style={ul()}>
          <li style={li()}>
            Each week, pick <strong>one team</strong> to win.
          </li>
          <li style={li()}>
            Win = you advance. Loss = you receive a strike.
          </li>
          <li style={li()}>
            <strong>Double elimination:</strong> you’re eliminated after{" "}
            <strong>2 losses</strong>.
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>🔒 Pick Locking</h2>
        <ul style={ul()}>
          <li style={li()}>
            Picks lock at the <strong>kickoff time</strong> of your selected
            team’s game, or <strong>1:00 PM ET Sunday</strong>, whichever comes
            first.
          </li>
          <li style={li()}>
            After lock, picks can’t be changed.
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>🤖 Autopicks</h2>
        <ul style={ul()}>
          <li style={li()}>
            If you do not submit a pick before lock, the system may assign an{" "}
            <strong>autopick</strong>.
          </li>
          <li style={li()}>
            The autopick will use the largest point-spread favorite available
            that you have not used yet.
          </li>
          <li style={li()}>
            Autopicks are graded normally and count as your official pick for
            the week.
          </li>
          <li style={li()}>
            <strong>Maximum of 3 autopicks</strong> per entry for the season.
          </li>
          <li style={li()}>
            After that, missing a pick will result in a <strong>loss</strong>{" "}
            for that week.
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>🚫 Team Restrictions</h2>
        <ul style={ul()}>
          <li style={li()}>
            You can pick each team <strong>only once</strong> during the regular
            season.
          </li>
          <li style={li()}>
            If the pool reaches the playoffs, restrictions{" "}
            <strong>reset for playoffs</strong>.
          </li>
          <li style={li()}>
            That means each team becomes available once again in the playoffs.
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>🏆 Playoffs</h2>
        <ul style={ul()}>
          <li style={li()}>
            If <strong>2+ players</strong> survive the regular season, the pool
            continues into the playoffs.
          </li>
          <li style={li()}>
            <strong>Teams reset for playoffs</strong> with a fresh set of
            eligible teams.
          </li>
          <li style={li()}>
            If you have <strong>no eligible team</strong> to select in a playoff
            round, you receive a <strong>loss</strong> for that round.
          </li>
          <li style={li()}>
            If multiple players survive through the playoffs:
            <ul style={{ ...ul(), marginTop: 8 }}>
              <li style={li()}>
                <strong>Undefeated</strong> players receive{" "}
                <strong>2 shares</strong>.
              </li>
              <li style={li()}>
                Players with <strong>one loss</strong> receive{" "}
                <strong>1 share</strong>.
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>💰 Prizes</h2>
        <div style={{ opacity: 0.9, marginTop: 8, fontWeight: 800 }}>
          PRIZES (less hosting fees)
        </div>
        <ul style={ul()}>
          <li style={li()}>
            1st Place: <strong>60%</strong> of pool
          </li>
          <li style={li()}>
            2nd Place: <strong>25%</strong> of pool
          </li>
          <li style={li()}>
            3rd Place: <strong>10%</strong> of pool
          </li>
          <li style={li()}>
            4th Place: <strong>5%</strong> of pool
          </li>
        </ul>
      </section>

      <section style={section()}>
        <h2 style={h2()}>⚖️ Edge Cases</h2>
        <ul style={ul()}>
          <li style={li()}>
            Ties, cancellations, postponements, and stat corrections may require
            commissioner decisions to keep the pool fair and moving.
          </li>
          <li style={li()}>
            Automated results are used whenever possible, but commissioner
            decisions are final.
          </li>
        </ul>
      </section>
    </div>
  );
}

function section(): React.CSSProperties {
  return {
    marginTop: 22,
    padding: "16px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
  };
}

function h2(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: 0.2,
  };
}

function ul(): React.CSSProperties {
  return {
    marginTop: 10,
    marginBottom: 0,
    paddingLeft: 20,
    lineHeight: 1.65,
    opacity: 0.94,
  };
}

function li(): React.CSSProperties {
  return { marginBottom: 8 };
}