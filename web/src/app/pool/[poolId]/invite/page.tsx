"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function InvitePage() {
  const params = useParams();
  const poolId = (params.poolId as string) || "";

  const inviteUrl = useMemo(() => {
    if (!poolId) return "";
    if (typeof window === "undefined") return "";

    const base =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    return `${base}/join/${poolId}`;
  }, [poolId]);

  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Invite Friends</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Share this link with friends to join your pool.
      </p>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.18)",
          background: "rgba(0,0,0,0.03)",
          wordBreak: "break-all",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
        }}
      >
        {inviteUrl || "Loading…"}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={copy}
          disabled={!inviteUrl}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.25)",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          {copied ? "✅ Copied" : "📋 Copy invite link"}
        </button>
      </div>

      <p style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        Anyone with this link can join your pool. If they are not logged in,
        they will be prompted to log in first.
      </p>
    </main>
  );
}
