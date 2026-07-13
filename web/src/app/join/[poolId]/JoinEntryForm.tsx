"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinEntryForm({
  poolId,
  entryNo,
}: {
  poolId: string;
  entryNo: number;
}) {
  const router = useRouter();

  const [screenName, setScreenName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = screenName.trim();

    if (trimmed.length < 2) {
      setError("Screen name must be at least 2 characters.");
      return;
    }

    if (trimmed.length > 30) {
      setError("Screen name must be 30 characters or fewer.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/pool/${poolId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          screen_name: trimmed,
          entry_no: entryNo,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Could not join pool.");
      }

      router.replace(`/pool/${poolId}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Could not join pool.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 18, maxWidth: 420 }}>
      <label
        htmlFor="screen-name"
        style={{ display: "block", fontWeight: 800, marginBottom: 8 }}
      >
        Choose your screen name
      </label>

      <input
        id="screen-name"
        type="text"
        value={screenName}
        onChange={(e) => setScreenName(e.target.value)}
        placeholder="Example: RyanH"
        maxLength={30}
        autoFocus
        disabled={submitting}
        style={{
          width: "100%",
          padding: "11px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(0,0,0,0.2)",
          color: "white",
          fontSize: 16,
        }}
      />

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
        This name will appear in standings and pool activity.
      </div>

      {error ? (
        <div style={{ marginTop: 10, color: "#fca5a5", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || screenName.trim().length < 2}
        style={{
          marginTop: 14,
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background:
            submitting || screenName.trim().length < 2 ? "#666" : "#f97316",
          color: "#000",
          fontWeight: 900,
          cursor:
            submitting || screenName.trim().length < 2
              ? "not-allowed"
              : "pointer",
        }}
      >
        {submitting ? "Joining..." : `Join Pool as Entry ${entryNo}`}
      </button>
    </form>
  );
}
