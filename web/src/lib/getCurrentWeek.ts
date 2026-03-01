import { createClient } from "@/lib/supabase/server";

export type CurrentWeek = {
  season_year: number;
  week_number: number;
  phase: "regular" | "playoffs";
  locked: boolean;
  label: string;
};

export async function getCurrentWeek(): Promise<CurrentWeek | null> {
  const supabase = await createClient();

  const nowIso = new Date().toISOString();

  // Find next upcoming game
  const { data: nextGame } = await supabase
    .from("games")
    .select("season_year, week_number, phase, kickoff_at")
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let g = nextGame;

  // Fallback → earliest game
  if (!g) {
    const { data: firstGame } = await supabase
      .from("games")
      .select("season_year, week_number, phase, kickoff_at")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    g = firstGame;
  }

  if (!g) return null;

  const phase =
    String(g.phase).toLowerCase().includes("play")
      ? "playoffs"
      : "regular";

  const label =
    phase === "regular"
      ? `Week ${g.week_number}`
      : `Playoff W${g.week_number}`;

  const locked =
    g.kickoff_at &&
    new Date(g.kickoff_at).getTime() <= Date.now();

  return {
    season_year: Number(g.season_year),
    week_number: Number(g.week_number),
    phase,
    locked,
    label,
  };
}