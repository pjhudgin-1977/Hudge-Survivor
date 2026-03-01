import Link from "next/link";

export default function NavBar({
  poolId,
  status,
  label,
  screenName,
  countersText,
  showLogout = true,
}: {
  poolId: string;
  status?: "OPEN" | "LOCKED";
  label?: string;
  screenName?: string;
  countersText?: string;
  showLogout?: boolean;
}) {
  return (
    <header
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Hudge</div>
          <div style={{ opacity: 0.75 }}>/ Hudge Survivor Pool 2025</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {status ? (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontWeight: 900,
                border: "1px solid rgba(255,255,255,0.18)",
                background:
                  status === "LOCKED"
                    ? "rgba(255,0,0,0.16)"
                    : "rgba(0,255,0,0.12)",
              }}
            >
              {status === "LOCKED" ? "🔒 LOCKED" : "✅ OPEN"}
              {label ? ` — ${label}` : ""}
            </span>
          ) : null}

          {screenName ? (
            <span style={{ opacity: 0.85, fontWeight: 800 }}>
              👤 {screenName}
            </span>
          ) : null}

          {showLogout ? (
            <Link href="/logout" style={{ textDecoration: "none", fontWeight: 900 }}>
              Logout
            </Link>
          ) : null}
        </div>
      </div>

      <nav style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/pool/${poolId}`} style={pill()}>
          🏠 Dashboard
        </Link>

        <Link href={`/pool/${poolId}/join`} style={pill()}>
          🤝 Join
        </Link>

        <Link href={`/pool/${poolId}/pick`} style={pill()}>
          ✅ Pick
        </Link>

        <Link href={`/pool/${poolId}/my-picks`} style={pill()}>
          🧾 My Picks
        </Link>

        <Link href={`/pool/${poolId}/standings`} style={pill()}>
          📊 Standings
        </Link>

        <Link href={`/pool/${poolId}/sweat`} style={pill()}>
          🔥 Sweat
        </Link>
      </nav>

      {countersText ? (
        <div style={{ marginTop: 10, opacity: 0.85, fontWeight: 800 }}>
          {countersText}
        </div>
      ) : null}
    </header>
  );
}

function pill(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    fontWeight: 900,
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.20)",
  };
}