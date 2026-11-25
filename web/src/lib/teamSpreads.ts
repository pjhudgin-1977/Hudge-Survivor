type GameSpread = {
  favorite_team: string | null;
  point_spread: number | null;
};

export function getTeamPointSpread(team: string, game: GameSpread): number | null {
  const { favorite_team: favorite, point_spread: spread } = game;
  if (spread === null || !Number.isFinite(spread)) return null;
  if (spread === 0 || !favorite) return 0;

  return favorite === team ? -Math.abs(spread) : Math.abs(spread);
}

export function formatSignedSpread(spread: number): string {
  return spread > 0 ? `+${spread}` : String(spread);
}
