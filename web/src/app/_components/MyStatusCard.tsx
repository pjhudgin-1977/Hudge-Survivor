"use client";

type Props = {
  screenName?: string;
  strikesLeft?: number;
  losses?: number;
  status?: string;
  latestPick?: string | null;
  autopicksUsed?: number;
  isPaid?: boolean;
  lockLabel?: string;
};

export default function MyStatusCard({
  screenName,
  strikesLeft = 2,
  losses = 0,
  status = "SAFE",
  latestPick,
  autopicksUsed = 0,
  isPaid = false,
  lockLabel,
}: Props) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.30)",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900 }}>
        🧭 My Status
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
        }}
      >
        <Stat label="Player" value={screenName || "—"} />
        <Stat label="Status" value={status} />
        <Stat label="Strikes Left" value={String(strikesLeft)} />
        <Stat label="Losses" value={String(losses)} />
        <Stat label="Last Pick" value={latestPick || "None"} />
        <Stat label="Autopicks" value={`${autopicksUsed} / 3`} />
        <Stat label="Entry Fee" value={isPaid ? "PAID ✅" : "UNPAID 💳"} />
        <Stat label="Next Lock" value={lockLabel || "TBD"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}