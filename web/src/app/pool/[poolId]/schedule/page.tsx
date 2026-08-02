import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    poolId: string;
  }>;
  searchParams?: Promise<{
    week?: string;
  }>;
};

type Game = {
  id: string;
  week_number: number;
  kickoff_at: string;
  away_team: string;
  home_team: string;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team: string | null;
  was_tie: boolean | null;
  favorite_team: string | null;
  point_spread: number | null;
  spread_last_updated: string | null;
};

function formatKickoff(kickoffAt: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(kickoffAt));

  return `${formatted} ET`;
}

function formatSpread(game: Game) {
  if (game.point_spread === null) {
    return "Spread: TBD";
  }

  if (game.point_spread === 0 || !game.favorite_team) {
    return "Spread: Pick'em";
  }

  return `Spread: ${game.favorite_team} ${game.point_spread}`;
}

function formatResult(game: Game) {
  if (game.was_tie) {
    return "Tie";
  }

  if (game.winner_team) {
    return `Winner: ${game.winner_team}`;
  }

  return null;
}

export default async function SchedulePage({
  params,
  searchParams,
}: PageProps) {
  const { poolId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createClient();

  const { data: poolState } = await supabase
    .from("pool_state")
    .select("week_number")
    .eq("pool_id", poolId)
    .maybeSingle();

  const currentPoolWeek = Number(poolState?.week_number ?? 1);

  const requestedWeek = resolvedSearchParams.week
    ? Number(resolvedSearchParams.week)
    : currentPoolWeek;

  const selectedWeek =
    Number.isInteger(requestedWeek) &&
    requestedWeek >= 1 &&
    requestedWeek <= 18
      ? requestedWeek
      : currentPoolWeek;

  const { data: games, error } = await supabase
    .from("games")
    .select(
      `
        id,
        week_number,
        kickoff_at,
        away_team,
        home_team,
        status,
        home_score,
        away_score,
        winner_team,
        was_tie,
        favorite_team,
        point_spread,
        spread_last_updated
      `
    )
    .eq("season_year", 2026)
    .eq("phase", "regular")
    .eq("week_number", selectedWeek)
    .order("kickoff_at", { ascending: true })
    .order("away_team", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-slate-900">
        <h1 className="text-2xl font-bold">NFL Schedule</h1>

        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          Could not load schedule: {error.message}
        </p>
      </main>
    );
  }

  const safeGames = (games ?? []) as Game[];

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6 pt-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">NFL Schedule</h1>

        <p className="mt-2 text-sm text-slate-300">
          All times ET. Point spreads are informational only.
        </p>
      </div>

      <div className="mb-5">
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-900">
            Week {selectedWeek} ▾
          </summary>

          <div className="absolute left-0 right-0 z-20 mt-2 grid grid-cols-3 gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-xl">
            {Array.from({ length: 18 }, (_, index) => {
              const week = index + 1;
              const isActive = week === selectedWeek;

              return (
                <Link
                  key={week}
                  href={`/pool/${poolId}/schedule?week=${week}`}
                  className={[
                    "rounded-lg border px-2 py-2 text-center text-sm font-semibold",
                    isActive
                      ? "border-[#c83803] bg-[#c83803] text-white"
                      : "border-slate-300 bg-slate-50 text-slate-800",
                  ].join(" ")}
                >
                  Week {week}
                </Link>
              );
            })}
          </div>
        </details>

        <div className="hidden flex-wrap gap-2 md:flex">
          {Array.from({ length: 18 }, (_, index) => {
            const week = index + 1;
            const isActive = week === selectedWeek;

            return (
              <Link
                key={week}
                href={`/pool/${poolId}/schedule?week=${week}`}
                className={[
                  "rounded-full border px-3 py-1 text-sm font-medium",
                  isActive
                    ? "border-[#c83803] bg-[#c83803] text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
                ].join(" ")}
              >
                Week {week}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-xl font-semibold">Week {selectedWeek}</h2>
          <p className="text-sm text-gray-600">
            {safeGames.length} games
          </p>
        </div>

        {safeGames.length === 0 ? (
          <p className="p-4 text-gray-600">
            No games found for this week.
          </p>
        ) : (
          <div className="divide-y">
            {safeGames.map((game) => {
              const result = formatResult(game);

              return (
                <div
                  key={game.id}
                  className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="text-lg font-semibold">
                      {game.away_team} at {game.home_team}
                    </div>

                    <div className="mt-1 text-sm text-gray-600">
                      {formatKickoff(game.kickoff_at)}
                    </div>

                    <div className="mt-1 text-sm font-medium text-slate-700">
                      {formatSpread(game)}
                    </div>
                  </div>

                  <div className="text-left md:text-right">
                    {game.status &&
                    game.status.toLowerCase() !== "scheduled" ? (
                      <div className="text-sm font-medium uppercase text-gray-500">
                        {game.status}
                      </div>
                    ) : null}

                    {game.home_score !== null &&
                    game.away_score !== null ? (
                      <div className="mt-1 text-sm">
                        {game.away_team} {game.away_score} —{" "}
                        {game.home_team} {game.home_score}
                      </div>
                    ) : null}

                    {result ? (
                      <div className="mt-1 text-sm font-semibold text-gray-800">
                        {result}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}