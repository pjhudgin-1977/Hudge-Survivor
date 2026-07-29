"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function ResetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Mode A: request reset email
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Mode B: set new password
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  const emailFromQuery = useMemo(() => sp.get("email") ?? "", [sp]);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      setHasSession(Boolean(data.session));
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const emailAddress = email.trim();

    if (!emailAddress) {
      setMsg("Please enter your email.");
      return;
    }

    setSending(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        emailAddress,
        {
          redirectTo,
        }
      );

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg(
        "✅ Reset email sent. Check your inbox and spam folder. Open the link to set a new password."
      );
    } finally {
      setSending(false);
    }
  }

  async function setNewPassword(e: React.FormEvent) {
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

      setMsg("✅ Password updated. Redirecting to login…");

      window.setTimeout(() => {
        router.push("/login");
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,92,0,0.18), transparent 60%), radial-gradient(900px 500px at 100% 10%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(180deg, #050A14 0%, #050812 45%, #04060F 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(10, 14, 28, 0.72)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(255,92,0,0.14), rgba(255,92,0,0.02))",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 950,
              letterSpacing: 0.2,
            }}
          >
            Reset Password
          </div>

          <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
            {hasSession
              ? "Set a new password for your account."
              : "Enter your email and we’ll send you a reset link."}
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {!ready ? (
            <div style={{ opacity: 0.8, fontWeight: 800 }}>Loading…</div>
          ) : hasSession ? (
            <form onSubmit={setNewPassword}>
              <label style={labelStyle}>New password</label>

              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 46 }}
                  type={showPasswords ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPasswords((value) => !value)}
                  aria-label={
                    showPasswords ? "Hide passwords" : "Show passwords"
                  }
                  title={showPasswords ? "Hide passwords" : "Show passwords"}
                  style={passwordToggleStyle}
                >
                  {showPasswords ? "🙈" : "👁️"}
                </button>
              </div>

              <div style={{ height: 12 }} />

              <label style={labelStyle}>Confirm password</label>

              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 46 }}
                  type={showPasswords ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPasswords((value) => !value)}
                  aria-label={
                    showPasswords ? "Hide passwords" : "Show passwords"
                  }
                  title={showPasswords ? "Hide passwords" : "Show passwords"}
                  style={passwordToggleStyle}
                >
                  {showPasswords ? "🙈" : "👁️"}
                </button>
              </div>

              {msg ? <div style={msgStyle}>{msg}</div> : null}

              <button
                type="submit"
                disabled={saving}
                style={primaryButtonStyle(saving)}
              >
                {saving ? "Saving…" : "Set new password"}
              </button>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  style={linkButtonStyle}
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={sendResetEmail}>
              <label style={labelStyle}>Email</label>

              <input
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />

              {msg ? <div style={msgStyle}>{msg}</div> : null}

              <button
                type="submit"
                disabled={sending}
                style={primaryButtonStyle(sending)}
              >
                {sending ? "Sending…" : "Send reset link"}
              </button>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  style={linkButtonStyle}
                >
                  Back to login
                </button>
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  opacity: 0.75,
                  lineHeight: 1.4,
                }}
              >
                If you don’t see the email within a minute, check spam or junk.
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.25,
  opacity: 0.85,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const passwordToggleStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  width: 32,
  height: 32,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.20)",
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  lineHeight: 1,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 14,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.12)"
      : "linear-gradient(180deg, rgba(255,92,0,0.95), rgba(255,92,0,0.72))",
    color: "white",
    fontWeight: 950,
    letterSpacing: 0.2,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled
      ? "none"
      : "0 12px 30px rgba(255,92,0,0.22)",
  };
}

const msgStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.90)",
  fontSize: 13,
  fontWeight: 800,
};

const linkButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.78)",
  textDecoration: "underline",
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
};
