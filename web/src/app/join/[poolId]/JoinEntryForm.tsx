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

  const [fullName, setFullName] = useState("");
  const [screenName, setScreenName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedFullName = fullName.trim();
    const trimmedScreenName = screenName.trim();

    if (trimmedFullName.length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    if (trimmedFullName.length > 100) {
      setError("Full name must be 100 characters or fewer.");
      return;
    }

    if (trimmedScreenName.length < 2) {
      setError("Screen name must be at least 2 characters.");
      return;
    }

    if (trimmedScreenName.length > 30) {
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
          full_name: trimmedFullName,
          screen_name: trimmedScreenName,
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

  const canSubmit =
    fullName.trim().length >= 2 &&
    screenName.trim().length >= 2 &&
    !submitting;

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 18, maxWidth: 420 }}>
      <label
        htmlFor="full-name"
        style={{ display: "block", fontWeight: 800, marginBottom: 8 }}
      >
        Full name
      </label>

      <input
        id="full-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Example: Ryan Hudgin"
        maxLength={100}
        autoFocus
        disabled={submitting}
        autoComplete="name"
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

      <label
        htmlFor="screen-name"
        style={{
          display: "block",
          fontWeight: 800,
          marginTop: 16,
          marginBottom: 8,
        }}
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
        Your screen name will appear in standings and pool activity.
      </div>

      {error ? (
        <div style={{ marginTop: 10, color: "#fca5a5", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          marginTop: 14,
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background: canSubmit ? "#f97316" : "#666",
          color: "#000",
          fontWeight: 900,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {submitting ? "Joining..." : `Join Pool as Entry ${entryNo}`}
      </button>
    </form>
  );
}
