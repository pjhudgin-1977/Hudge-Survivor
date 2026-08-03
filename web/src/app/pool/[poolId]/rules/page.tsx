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

type RuleSection = {
  heading: string;
  body: string[];
};

function isRuleHeading(line: string) {
  const trimmed = line.trim();

  // Bullets are rule text, never section headings.
  if (/^[•*-]\s+/.test(trimmed)) {
    return false;
  }

  // Remove leading emojis or symbols before checking capitalization.
  const headingText = trimmed
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();

  return (
    headingText.length > 0 &&
    headingText === headingText.toUpperCase()
  );
}

function parseRules(rulesText: string): RuleSection[] {
  const blocks = rulesText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: RuleSection[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const lines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);

    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const looksLikeHeading = isRuleHeading(firstLine);

    if (looksLikeHeading) {
      const nextBlock = blocks[index + 1];
      const bodyLines = lines.slice(1);

      if (bodyLines.length > 0) {
        sections.push({
          heading: firstLine,
          body: bodyLines,
        });
        continue;
      }

      if (nextBlock) {
        const nextLines = nextBlock
          .split("\n")
          .map((line) => line.trimEnd())
          .filter((line) => line.trim().length > 0);

        const nextFirstLine = nextLines[0] ?? "";
        const nextLooksLikeHeading =
          isRuleHeading(nextFirstLine);

        if (!nextLooksLikeHeading) {
          sections.push({
            heading: firstLine,
            body: nextLines,
          });

          index += 1;
          continue;
        }
      }

      sections.push({
        heading: firstLine,
        body: [],
      });

      continue;
    }

    if (sections.length === 0) {
      sections.push({
        heading: "Pool Rules",
        body: lines,
      });
    } else {
      sections[sections.length - 1].body.push(...lines);
    }
  }

  return sections;
}

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

  const sections = parseRules(rulesText);

  const entryFeeSection = sections.find(
    (section) => section.heading.trim().toUpperCase() === "ENTRY FEE"
  );

  const regularSections = sections.filter(
    (section) => section !== entryFeeSection
  );

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 18px 48px",
      }}
    >
      <Link
        href={`/pool/${poolId}`}
        style={{
          display: "inline-block",
          marginBottom: 12,          color: "white",
          textDecoration: "none",
          fontWeight: 900,
          opacity: 0.9,
        }}
      >
        ← Back to Dashboard
      </Link>

      <header style={{ marginBottom: 22 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 950,
            letterSpacing: 0.2,
          }}
        >
          Pool Rules
        </h1>

        <p
          style={{
            margin: "8px 0 0",
            maxWidth: 720,
            fontSize: 16,
            lineHeight: 1.6,
            opacity: 0.74,
          }}
        >
          Everything you need to know for making picks, surviving each week,
          and winning the pool.
        </p>
      </header>

      {entryFeeSection ? (
        <section
          style={{
            marginBottom: 26,
            padding: "16px 18px",
            borderRadius: 14,
            border: "1px solid rgba(249,115,22,0.45)",
            background:
              "linear-gradient(180deg, rgba(249,115,22,0.16), rgba(249,115,22,0.06))",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 950,
              letterSpacing: 0.6,
              color: "#fdba74",
            }}
          >
            ENTRY FEE
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: 950,
              lineHeight: 1.35,
            }}
          >
            {entryFeeSection.body.join(" ")}
          </div>
        </section>
      ) : null}

      <article
        style={{
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.035)",
          padding: "4px 20px",
        }}
      >
        {regularSections.map((section, index) => (
          <section
            key={`${section.heading}-${index}`}
            style={{
              padding: "22px 0",
              borderTop:
                index === 0
                  ? "none"
                  : "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 950,
                letterSpacing: 0.2,
              }}
            >
              {section.heading}
            </h2>

            {section.body.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  whiteSpace: "pre-wrap",
                  fontSize: 16,
                  lineHeight: 1.75,
                  opacity: 0.92,
                }}
              >
                {section.body.join("\n")}
              </div>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}
