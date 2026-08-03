"use client";

import { useEffect, useRef, useState } from "react";

export default function PaymentActions({
  venmoLink,
  note,
}: {
  venmoLink: string;
  note: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2500);
    } catch {
      window.alert("Copy failed. Please select and copy the note manually.");
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            padding: "11px 13px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            fontWeight: 800,
            overflowWrap: "anywhere",
          }}
        >
          {note}
        </div>

        <button
          type="button"
          onClick={copyNote}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "#475569",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied!" : "Copy Note"}
        </button>
      </div>

      {venmoLink ? (
        <a
          href={venmoLink}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "11px 16px",
            borderRadius: 11,
            border: "1px solid #fb923c",
            background: "#f97316",
            color: "#000",
            textDecoration: "none",
            fontWeight: 950,
          }}
        >
          Open Venmo →
        </a>
      ) : null}
    </div>
  );
}
