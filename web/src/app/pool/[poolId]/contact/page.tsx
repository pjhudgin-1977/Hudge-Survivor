"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ContactCommissionerPage() {
  const params = useParams<{ poolId: string }>();
  const router = useRouter();
  const poolId = params.poolId;

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submitMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) return;

    setSending(true);
    setError("");

    const res = await fetch(`/api/pool/${poolId}/commissioner-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        message,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data?.error || "Unable to send message.");
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
    setSubject("");
    setMessage("");
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-bold">Message Sent</h1>
          <p className="mt-3 text-white/70">
            Your private message has been sent to the commissioner.
          </p>

          <button
            onClick={() => router.push(`/pool/${poolId}`)}
            className="mt-6 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">Contact Commissioner</h1>

      <p className="mt-2 text-sm text-white/60">
        Send a private message to the commissioner. Your account identity will
        be included automatically.
      </p>

      <form onSubmit={submitMessage} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Subject
          </label>

          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="Optional"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Message
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={3000}
            rows={7}
            placeholder="Type your message..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Private Message"}
        </button>
      </form>
    </main>
  );
}
