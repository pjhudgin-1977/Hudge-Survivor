"use client";

import { useEffect, useRef, useState } from "react";

type CopiedItem = "link" | "code" | null;

export default function InviteDetails({
  inviteUrl,
  inviteCode,
}: {
  inviteUrl: string;
  inviteCode: string;
}) {
  const [copiedItem, setCopiedItem] = useState<CopiedItem>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copyText(
    text: string,
    item: Exclude<CopiedItem, null>
  ) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setCopiedItem(null);
        timerRef.current = null;
      }, 3000);
    } catch {
      setCopiedItem(null);
      window.alert("Copy failed. Please select and copy the text manually.");
    }
  }

  return (
    <section
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "#111827",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800 }}>
        Invite link
      </div>

      <p style={{ marginTop: 5, marginBottom: 0, opacity: 0.75 }}>
        Send this link by text or email. It takes the recipient directly
        to the pool join page.
      </p>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: "1 1 360px",
            color: "#fdba74",
            fontWeight: 800,
            textDecoration: "underline",
            overflowWrap: "anywhere",
          }}
        >
          {inviteUrl}
        </a>

        <button
          type="button"
          onClick={() => copyText(inviteUrl, "link")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #fb923c",
            background: "#f97316",
            color: "#000",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {copiedItem === "link" ? "Copied!" : "Copy Invite Link"}
        </button>
      </div>

      <div
        style={{
          marginTop: 20,
          paddingTop: 18,
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          Invite code
        </div>

        <p style={{ marginTop: 5, marginBottom: 0, opacity: 0.75 }}>
          Someone can enter this shorter code on the Join page instead
          of using the full link.
        </p>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.06)",
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            {inviteCode}
          </div>

          <button
            type="button"
            onClick={() => copyText(inviteCode, "code")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "#475569",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {copiedItem === "code" ? "Copied!" : "Copy Code"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 13, opacity: 0.7 }}>
        This invite stays active until the commissioner creates a new
        invite code.
      </div>
    </section>
  );
}
