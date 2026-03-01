import React from "react";

type Props = {
  // Minimal inputs (works even if you don't have spreads / win prob yet)
  status?: string | null; // e.g. "scheduled" | "in_progress" | "final" (whatever your DB uses)
  kickoffAt?: string | null; // ISO string
  homeTeam?: string | null;
  awayTeam?: string | null;
  pickTeam?: string | null; // the team the user picked for this game
  homeScore?: number | null;
  awayScore?: number | null;

  // Optional: if you have these later, we can plug them in
  quarter?: number | null;
  clock?: string | null;
};

type Level = {
  key: "CHILL" | "SWEAT" | "PANIC" | "DONE";
  label: string;
  value: number; // 0..100
  hint: string;
};

// Helper: safe parse date
function parseDate(d?: string | null) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

function isFinal(status?: string | null) {
  const s = String(status ?? "").toLowerCase();
  return s.includes("final") || s === "finished" || s === "complete";
}

function hasStarted(status?: string | null, kickoffAt?: string | null) {
  const s = String(status ?? "").toLowerCase();
  if (s.includes("in_progress") || s.includes("live") || s.includes("playing")) return true;
  if (isFinal(status)) return true;

  const k = parseDate(kickoffAt);
  if (!k) return false;
  return Date.now() >= k.getTime();
}

function computeLevel(p: Props): Level {
  // If game is final: no sweat
  if (isFinal(p.status)) {
    return { key: "DONE", label: "Done", value: 0, hint: "Game complete" };
  }

  const started = hasStarted(p.status, p.kickoffAt);
  const haveScores =
    typeof p.homeScore === "number" && typeof p.awayScore === "number";

  // Pre-game: intensity based on time-to-kickoff (simple + reliable)
  if (!started || !haveScores) {
    const k = parseDate(p.kickoffAt);
    if (!k) {
      return { key: "SWEAT", label: "Sweat", value: 55, hint: "Kickoff time unknown" };
    }
    const mins = Math.round((k.getTime() - Date.now()) / 60000);

    if (mins > 180) return { key: "CHILL", label: "Chill", value: 20, hint: "Plenty of time" };
    if (mins > 60) return { key: "SWEAT", label: "Sweat", value: 50, hint: "Getting close" };
    if (mins >= 0) return { key: "PANIC", label: "Panic", value: 75, hint: "Almost kickoff" };

    // If kickoff passed but scores not present yet
    return { key: "SWEAT", label: "Sweat", value: 60, hint: "Kickoff passed" };
  }

  // Live: intensity based on picked-team margin (also simple + reliable)
  const pick = String(p.pickTeam ?? "");
  const home = String(p.homeTeam ?? "");
  const away = String(p.awayTeam ?? "");

  let pickScore: number | null = null;
  let oppScore: number | null = null;

  if (pick && home && pick === home) {
    pickScore = p.homeScore ?? null;
    oppScore = p.awayScore ?? null;
  } else if (pick && away && pick === away) {
    pickScore = p.awayScore ?? null;
    oppScore = p.homeScore ?? null;
  }

  // If we can't map pickTeam to home/away, fall back to close-game logic
  if (pickScore == null || oppScore == null) {
    const diff = Math.abs((p.homeScore ?? 0) - (p.awayScore ?? 0));
    if (diff <= 3) return { key: "PANIC", label: "Panic", value: 85, hint: "One-score game" };
    if (diff <= 10) return { key: "SWEAT", label: "Sweat", value: 55, hint: "Close game" };
    return { key: "CHILL", label: "Chill", value: 25, hint: "Comfortable margin" };
  }

  const margin = pickScore - oppScore;

  // Losing or tied = panic (tie counts as loss in your rules, so panic is correct)
  if (margin <= 0) return { key: "PANIC", label: "Panic", value: 95, hint: margin === 0 ? "Tied (counts as loss)" : "Behind" };
  if (margin <= 7) return { key: "SWEAT", label: "Sweat", value: 65, hint: "One-score lead" };
  return { key: "CHILL", label: "Chill", value: 30, hint: "Multi-score lead" };
}

export default function SweatIntensityMeter(props: Props) {
  const level = computeLevel(props);

  // Color-blind friendly: label + icon + bar width (not color-dependent)
  const icon =
    level.key === "DONE" ? "✅" :
    level.key === "CHILL" ? "😌" :
    level.key === "SWEAT" ? "😅" : "😱";

  // Keep styling simple (works with or without Tailwind)
  return (
    <div
      title={level.hint}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minWidth: 180,
      }}
    >
      <span style={{ width: 22, textAlign: "center" }}>{icon}</span>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 140 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <strong>{level.label}</strong>
          {props.quarter ? (
            <span style={{ opacity: 0.75 }}>
              Q{props.quarter}{props.clock ? ` ${props.clock}` : ""}
            </span>
          ) : (
            <span style={{ opacity: 0.75 }}>{level.key === "DONE" ? "" : ""}</span>
          )}
        </div>

        <div
          style={{
            height: 10,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.25)",
            overflow: "hidden",
            background: "rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, level.value))}%`,
              background: "rgba(0,0,0,0.65)",
            }}
          />
        </div>
      </div>
    </div>
  );
}