import Link from "next/link";

export default async function GameDayPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Game Day</h1>

      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Track the most important games affecting your survival.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 28,
        }}
      >
        <Link
          href={`/pool/${poolId}/sweat`}
          style={{
            padding: 24,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            textDecoration: "none",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>🔥 Sweat Games</h2>
          <p style={{ opacity: 0.8 }}>
            Games where players are actively sweating their picks.
          </p>
        </Link>

        <Link
          href={`/pool/${poolId}/danger`}
          style={{
            padding: 24,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            textDecoration: "none",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>⚠️ Danger Zone</h2>
          <p style={{ opacity: 0.8 }}>
            Players at risk of elimination this week.
          </p>
        </Link>
      </div>
    </main>
  );
}