"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatTeamRecord, type TeamRecords } from "@/lib/teamRecords";
import TeamRecordLabel from "./TeamRecordLabel";
import styles from "./GameScorePopup.module.css";

export type GameScorePick = {
  week: number;
  phase: "regular" | "playoffs";
  result?: string | null;
};

type Game = {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  status: string | null;
};

const kickoffFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "short",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function GameScore({
  season, team, pick, records,
}: {
  season: number;
  team: string;
  pick: GameScorePick;
  records: TeamRecords;
}) {
  const { week, phase, result } = pick;
  const [game, setGame] = useState<Game | null>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const supabase = createClient();
    let refresh: ReturnType<typeof setTimeout>;

    async function load() {
      const { data, error } = await supabase
        .from("games")
        .select("home_team, away_team, home_score, away_score, kickoff_at, status")
        .eq("season_year", season)
        .eq("phase", phase)
        .eq("week_number", week)
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;
      const matches = (data ?? []).filter((row) =>
        [row.home_team, row.away_team].some(
          (code) => code?.trim().toUpperCase() === team.trim().toUpperCase()
        )
      );
      const match = matches.length === 1 ? matches[0] : null;
      setFailed(Boolean(error));
      if (!error) setGame(match);
      if (error || (match && match.status?.trim().toLowerCase() !== "final")) {
        refresh = setTimeout(load, 30_000);
      }
    }

    void load();
    return () => {
      controller.abort();
      clearTimeout(refresh);
    };
  }, [season, phase, week, team]);

  const status = game?.status?.trim().toLowerCase();
  const kickoff = game?.kickoff_at ? Date.parse(game.kickoff_at) : NaN;
  const upcoming = status === "scheduled" || (!status && kickoff > Date.now());

  return (
    <section className={styles.game}>
      <h3>{phase === "playoffs" ? "Playoffs" : "Regular season"} · Week {week}</h3>
      <div aria-live="polite">
        {failed && <p>{game ? "Score refresh unavailable." : "Game details could not be loaded."}</p>}
        {game === undefined && !failed && <p>Loading game details…</p>}
        {game === null && !failed && <p>Game details unavailable.</p>}
        {game && (
          <>
            <p className={styles.status}>
              {status === "live" ? "Live" : status === "final" ? "Final" : upcoming ? "Upcoming" : status || "Status unavailable"}
            </p>
            {upcoming && Number.isFinite(kickoff) && <p>Kickoff · {kickoffFormat.format(kickoff)}</p>}
            <dl className={styles.score}>
              {[
                { code: game.away_team, score: game.away_score, venue: "Away" },
                { code: game.home_team, score: game.home_score, venue: "Home" },
              ].map(({ code, score, venue }) => (
                <div key={venue}>
                  <dt>{formatTeamRecord(code, records)} <small>{venue}</small></dt>
                  {!upcoming && <dd>{score ?? "—"}</dd>}
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {result?.trim() && <p className={styles.result}>Pick result · {result.trim().replaceAll("_", " ")}</p>}
    </section>
  );
}

export default function GameScorePopup({
  team, season, pick, records, children, variant, stacked,
}: {
  team: string;
  season: number | null | undefined;
  pick: GameScorePick | GameScorePick[];
  records: TeamRecords;
  children?: ReactNode;
  stacked?: boolean;
  variant?: "chip";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  const picks = Array.isArray(pick) ? pick : [pick];
  const isChip = variant === "chip";
  const chipPick = isChip && picks.length === 1 ? picks[0] : undefined;
  const weekPrefix = chipPick?.week
    ? `${chipPick.phase === "playoffs" ? "P" : "W"}${chipPick.week} `
    : "";
  const hasLoss = isChip && picks.some(({ result }) => result?.trim().toLowerCase() === "loss");

  const label = stacked
    ? <TeamRecordLabel team={team} records={records} prefix={weekPrefix} />
    : <>{weekPrefix}{children}</>;

  if (!season || !team.trim()) return label;

  return (
    <>
      <button
        type="button"
        className={[
          styles.trigger,
          isChip && styles.chip,
          isChip && stacked && styles.stackedChip,
          hasLoss && styles.lossChip,
        ].filter(Boolean).join(" ")}
        aria-haspopup="dialog"
        aria-label={`View game score for ${weekPrefix}${team}${hasLoss ? ", loss" : ""}`}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        {label}
        {hasLoss && <span className={styles.lossLabel}>Loss</span>}
      </button>
      {open && createPortal(
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          className={styles.dialog}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
        >
          <div className={styles.content}>
            <header>
              <h2 id={titleId}>{team} · {season} season</h2>
              <form method="dialog">
                <button type="submit">Close</button>
              </form>
            </header>
            {picks.length === 0 && <p className={styles.game}>Game details unavailable.</p>}
            {picks.map((gamePick) => (
              <GameScore
                key={`${season}-${gamePick.phase}-${gamePick.week}-${team}`}
                season={season}
                team={team}
                pick={gamePick}
                records={records}
              />
            ))}
          </div>
        </dialog>,
        document.body
      )}
    </>
  );
}
