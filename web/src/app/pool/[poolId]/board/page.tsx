"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Message = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  screen_name?: string;
};

export default function BoardPage() {
  const params = useParams();
  const poolId = params.poolId as string;
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [commissionerNote, setCommissionerNote] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  async function loadBoard() {
    const { data: noteData } = await supabase
      .from("pool_notes")
      .select("note")
      .eq("pool_id", poolId)
      .maybeSingle();

    setCommissionerNote(noteData?.note ?? null);
    setNoteDraft(noteData?.note ?? "");

    const { data: msgs, error } = await supabase
      .from("pool_messages")
      .select("id,user_id,message,created_at")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Load board error:", error);
      return;
    }

    const userIds = [...new Set((msgs || []).map((m) => m.user_id))];

    let nameMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from("pool_members")
        .select("user_id,screen_name")
        .eq("pool_id", poolId)
        .in("user_id", userIds);

      (members || []).forEach((m) => {
        nameMap[m.user_id] = m.screen_name || "Player";
      });
    }

    const withNames = (msgs || []).map((m) => ({
      ...m,
      screen_name: nameMap[m.user_id] || "Player",
    }));

    setMessages(withNames);
  }

  async function postMessage() {
    if (!message.trim()) return;

    setLoading(true);

    await fetch(`/api/pool/${poolId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    setMessage("");
    await loadBoard();
    setLoading(false);
  }

  async function saveNote() {
    await supabase.from("pool_notes").upsert({
      pool_id: poolId,
      note: noteDraft,
    });

    setCommissionerNote(noteDraft);
    setEditingNote(false);
  }

  useEffect(() => {
    loadBoard();

    const intervalId = window.setInterval(() => {
      console.log("Polling board...");
      loadBoard();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [poolId]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <Link href={`/pool/${poolId}`}>← Back to Dashboard</Link>

      <h1 style={{ marginTop: 18, fontSize: 32, fontWeight: 900 }}>
        Pool Message Board
      </h1>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          📌 Commissioner Note
        </div>

        {editingNote ? (
          <>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.3)",
                color: "white",
              }}
            />

            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                onClick={saveNote}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid white",
                  fontWeight: 800,
                }}
              >
                Save
              </button>

              <button
                onClick={() => setEditingNote(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>
              {commissionerNote || "No commissioner note yet."}
            </div>

            <button
              onClick={() => setEditingNote(true)}
              style={{
                marginTop: 8,
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.3)",
                fontSize: 12,
              }}
            >
              Edit
            </button>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>Post a Message</div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.3)",
            color: "white",
          }}
        />

        <button
          onClick={postMessage}
          disabled={loading}
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid white",
            fontWeight: 800,
          }}
        >
          {loading ? "Posting..." : "Post Message"}
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
          Recent Messages
        </div>

        {messages.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            No messages yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{msg.screen_name}</div>

                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {new Date(msg.created_at).toLocaleString()}
                </div>

                <div style={{ marginTop: 6 }}>{msg.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}