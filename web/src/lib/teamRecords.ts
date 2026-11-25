import type { SupabaseClient } from "@supabase/supabase-js";

type TeamRecord = { wins: number; losses: number; ties: number };
export type TeamRecords = Record<string, TeamRecord>;

type RegularSeasonGame = {
  home_team: string | null;
  away_team: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team: string | null;
  was_tie: boolean | null;
};

export function calculateTeamRecords(games: RegularSeasonGame[]): TeamRecords {
  const records: TeamRecords = {};

  for (const game of games) {
    const home = game.home_team?.trim().toUpperCase();
    const away = game.away_team?.trim().toUpperCase();
    if (!home || !away || home === away) continue;

    const homeRecord = (records[home] ??= { wins: 0, losses: 0, ties: 0 });
    const awayRecord = (records[away] ??= { wins: 0, losses: 0, ties: 0 });
    if (game.status?.trim().toLowerCase() !== "final") continue;

    const { home_score, away_score } = game;
    const hasScores = home_score !== null && away_score !== null;
    if (game.was_tie || (hasScores && home_score === away_score)) {
      homeRecord.ties++;
      awayRecord.ties++;
      continue;
    }

    const winner = hasScores
      ? (home_score > away_score ? home : away)
      : game.winner_team?.trim().toUpperCase();

    if (winner === home) {
      homeRecord.wins++;
      awayRecord.losses++;
    } else if (winner === away) {
      awayRecord.wins++;
      homeRecord.losses++;
    }
  }

  return records;
}

export async function loadTeamRecords(
  supabase: SupabaseClient,
  seasonYear: number | null | undefined
): Promise<TeamRecords> {
  if (!seasonYear) return {};

  const { data, error } = await supabase
    .from("games")
    .select("home_team, away_team, status, home_score, away_score, winner_team, was_tie")
    .eq("season_year", seasonYear)
    .eq("phase", "regular");

  if (error) {
    console.error("Could not load NFL team records", error.message);
    return {};
  }

  return calculateTeamRecords(data ?? []);
}

export async function loadPoolTeamRecords(
  supabase: SupabaseClient,
  poolId: string,
  fallbackSeason?: number
): Promise<TeamRecords> {
  const { data } = await supabase
    .from("pool_state")
    .select("season_year")
    .eq("pool_id", poolId)
    .maybeSingle();

  return loadTeamRecords(supabase, data?.season_year ?? fallbackSeason);
}

export function formatTeamRecord(team: string, records: TeamRecords): string;
export function formatTeamRecord<T extends string | null | undefined>(
  team: T,
  records: TeamRecords
): T | string;
export function formatTeamRecord(
  team: string | null | undefined,
  records: TeamRecords
): string | null | undefined {
  const key = team?.trim().toUpperCase();
  if (!key || !Object.hasOwn(records, key)) return team;

  const { wins, losses, ties } = records[key];
  const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  return `${team} (${record})`;
}
