import React from "react";

type Props = {
  // Minimal inputs (works even if you don't have spreads / win prob yet)
  status?: string | null; // e.g. "scheduled" | "in_progress" | "final"
  kickoffAt?: string | null; // ISO string
  homeTeam?: string | null;
  awayTeam?: string | null;
  pickTeam?: string | null; // the team the user picked for this game
  homeScore?: number | null;
  awayScore?: number | null;

  // Optional live-game context
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

  if (
    s.includes("in_progress") ||
    s.includes("live") ||
    s.includes("playing")
  ) {
    return true;
  }

  if (isFinal(status)) return true;

  const k = parseDate(kickoffAt);
  if (!k) return false;

  return Date.now() >= k.getTime();
}

function computeLevel(p: Props): Level {
  // Final game: no sweat
  if (isFinal(p.status)) {
    return {
      key: "DONE",
      label: "Done",
      value: 0,
      hint: "Game complete",
    };
  }

  const started = hasStarted(p.status, p.kickoffAt);

  const haveScores =
    typeof p.homeScore === "number" &&
    typeof p.awayScore === "number";

  // Pre-game: always chill until the game actually starts
  if (!started || !haveScores) {
    return {
      key: "CHILL",
      label: "Chill",
      value: 20,
      hint: "Game has not started",
    };
  }

  // Live: determine picked-team margin
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

  const quarter = p.quarter ?? 1;

  // If we cannot map the pick to home/away,
  // still avoid overreacting early in the game.
  if (pickScore == null || oppScore == null) {
    const diff = Math.abs(
      (p.homeScore ?? 0) - (p.awayScore ?? 0)
    );

    if (quarter <= 1) {
      return {
        key: "CHILL",
        label: "Chill",
        value: 35,
        hint: "Early game",
      };
    }

    if (quarter === 2) {
      if (diff <= 10) {
        return {
          key: "SWEAT",
          label: "Sweat",
          value: 55,
          hint: "Close game",
        };
      }

      return {
        key: "CHILL",
        label: "Chill",
        value: 30,
        hint: "Comfortable margin",
      };
    }

    if (quarter === 3) {
      if (diff <= 7) {
        return {
          key: "SWEAT",
          label: "Sweat",
          value: 65,
          hint: "Close game",
        };
      }

      return {
        key: "CHILL",
        label: "Chill",
        value: 30,
        hint: "Comfortable margin",
      };
    }

    // Q4 fallback
    if (diff <= 3) {
      return {
        key: "PANIC",
        label: "Panic",
        value: 85,
        hint: "Very close late",
      };
    }

    if (diff <= 10) {
      return {
        key: "SWEAT",
        label: "Sweat",
        value: 65,
        hint: "Close late",
      };
    }

    return {
      key: "CHILL",
      label: "Chill",
      value: 30,
      hint: "Comfortable margin",
    };
  }

  const margin = pickScore - oppScore;

  // Q1: never Panic
  if (quarter <= 1) {
    if (margin <= -7) {
      return {
        key: "SWEAT",
        label: "Sweat",
        value: 60,
        hint: "Trailing early",
      };
    }

    if (margin <= 7) {
      return {
        key: "CHILL",
        label: "Chill",
        value: 35,
        hint: "Early close game",
      };
    }

    return {
      key: "CHILL",
      label: "Chill",
      value: 20,
      hint: "Early lead",
    };
  }

  // Q2: Panic only for a meaningful deficit
  if (quarter === 2) {
    if (margin <= -14) {
      return {
        key: "PANIC",
        label: "Panic",
        value: 85,
        hint: "Down two scores",
      };
    }

    if (margin <= 7) {
      return {
        key: "SWEAT",
        label: "Sweat",
        value: 60,
        hint: "Close game",
      };
    }

    return {
      key: "CHILL",
      label: "Chill",
      value: 25,
      hint: "Comfortable lead",
    };
  }

  // Q3: tighter thresholds
  if (quarter === 3) {
    if (margin <= -10) {
      return {
        key: "PANIC",
        label: "Panic",
        value: 90,
        hint: "Trailing late",
      };
    }

    if (margin <= 7) {
      return {
        key: "SWEAT",
        label: "Sweat",
        value: 70,
        hint: "Close game",
      };
    }

    return {
      key: "CHILL",
      label: "Chill",
      value: 30,
      hint: "Lead",
    };
  }

  // Q4: current score matters most
  if (margin <= 0) {
    return {
      key: "PANIC",
      label: "Panic",
      value: 95,
      hint: margin === 0 ? "Tied late" : "Behind late",
    };
  }

  if (margin <= 7) {
    return {
      key: "SWEAT",
      label: "Sweat",
      value: 75,
      hint: "One-score lead late",
    };
  }

  return {
    key: "CHILL",
    label: "Chill",
    value: 30,
    hint: "Multi-score lead",
  };
}

export default function SweatIntensityMeter(props: Props) {
  const level = computeLevel(props);

  const icon =
    level.key === "DONE"
      ? "✅"
      : level.key === "CHILL"
      ? "😌"
      : level.key === "SWEAT"
      ? "😅"
      : "😱";

  const barColor =
    level.key === "CHILL"
      ? "#22c55e"
      : level.key === "SWEAT"
      ? "#f59e0b"
      : level.key === "PANIC"
      ? "#ef4444"
      : "#64748b";

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
      <span
        style={{
          width: 22,
          textAlign: "center",
        }}
      >
        {icon}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          width: 150,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            alignItems: "center",
          }}
        >
          <strong>{level.label}</strong>

          {props.quarter ? (
            <span style={{ opacity: 0.75 }}>
              Q{props.quarter}
              {props.clock ? ` ${props.clock}` : ""}
            </span>
          ) : (
            <span style={{ opacity: 0.75 }}>
              {level.key === "DONE" ? "" : ""}
            </span>
          )}
        </div>

        <div
          style={{
            height: 12,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            overflow: "hidden",
            background: "rgba(255,255,255,0.14)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(
                0,
                Math.min(100, level.value)
              )}%`,
              background: barColor,
              borderRadius: 999,
              boxShadow: `0 0 10px ${barColor}`,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}