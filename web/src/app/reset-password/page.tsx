"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
export default function ResetPasswordPage() {
  const router = useRouter();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState<boolean>(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Password updated. Redirecting to login…");
      setTimeout(() => router.push("/login"), 1000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        Reset Password
      </h1>

      {!ready ? (
        <p style={{ marginTop: 12 }}>Loading…</p>
      ) : !hasSession ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#b00", fontWeight: 600 }}>
            This reset link is missing or expired.
          </p>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Go back to login and request a new reset link.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #333",
              marginBottom: 14,
              background: "transparent",
              color: "inherit",
            }}
          />

          <label style={{ display: "block", marginBottom: 8 }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #333",
              marginBottom: 14,
              background: "transparent",
              color: "inherit",
            }}
          />

          {msg && (
            <div style={{ marginBottom: 12 }}>
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "black",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </main>
  );
}
