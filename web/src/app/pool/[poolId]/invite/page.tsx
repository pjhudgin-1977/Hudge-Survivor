"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function InvitePage() {
  const params = useParams();
  const poolId = (params.poolId as string) || "";

  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const inviteUrl = useMemo(() => {
    if (!code) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${code}`;
  }, [code]);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!poolId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/pool/${poolId}/invite`, {
          method: "GET",
          cache: "no-store",
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErr(body?.error || "Failed to load invite code");
          setCode("");
          return;
        }

        setCode(String(body.code || ""));
      } catch (e: any) {
        setErr(e?.message || "Failed to load invite code");
        setCode("");
      } finally {
        setLoading(false);
      }
    })();
  }, [poolId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Invite</h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Share this link to invite someone to your pool.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>
          Invite link
        </div>

        {loading ? (
          <div style={{ marginTop: 10, opacity: 0.85 }}>Loading…</div>
        ) : err ? (
          <div style={{ marginTop: 10, color: "#ffb4b4", fontWeight: 800 }}>
            {err}
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: 10,
                fontSize: 16,
                fontWeight: 900,
                wordBreak: "break-all",
              }}
            >
              {inviteUrl}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button
                onClick={copy}
                disabled={!inviteUrl}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(0,0,0,0.35)",
                  color: "white",
                  fontWeight: 900,
                  cursor: inviteUrl ? "pointer" : "not-allowed",
                }}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>

              <div style={{ alignSelf: "center", opacity: 0.8, fontSize: 12 }}>
                Code: <span style={{ fontWeight: 900 }}>{code}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}