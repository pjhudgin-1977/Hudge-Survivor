"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function EditNicknamePage() {
  const router = useRouter();
  const params = useParams();
  const poolId = params.poolId as string;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [current, setCurrent] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push(`/login?next=/pool/${poolId}/profile/edit`);
        return;
      }

      const { data: me, error } = await supabase
        .from("pool_members")
        .select("screen_name")
        .eq("pool_id", poolId)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setLoading(false);
        setErr(error.message);
        return;
      }

      if (!me) {
        router.push(`/join/${poolId}`);
        return;
      }

      const sn = me.screen_name ?? "";
      setCurrent(sn);
      setNickname(sn);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [poolId, router, supabase]);

  async function save() {
    setErr(null);

    const nick = nickname.trim();
    if (!nick) {
      setErr("Nickname is required.");
      return;
    }
    if (nick.length > 30) {
      setErr("Nickname must be 30 characters or less.");
      return;
    }

    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setSaving(false);
      router.push(`/login?next=/pool/${poolId}/profile/edit`);
      return;
    }

    const { error } = await supabase
      .from("pool_members")
      .update({ screen_name: nick })
      .eq("pool_id", poolId)
      .eq("user_id", auth.user.id);

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.push(`/pool/${poolId}/profile`);
    router.refresh();
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.22)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    padding: 18,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    color: "white",
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>Edit Nickname</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        This name shows in standings and the sweat board.
      </p>

      <div style={{ marginTop: 14, ...card }}>
        {loading ? (
          <div style={{ opacity: 0.85, fontWeight: 900 }}>Loading…</div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
              Current
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 950 }}>
              {current || "—"}
            </div>

            <div style={{ height: 14 }} />

            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
              New Nickname (required)
            </div>
            <input
              style={{ ...input, marginTop: 6 }}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. BearDown87"
              maxLength={30}
              autoComplete="nickname"
            />

            {err ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,70,70,0.35)",
                  background: "rgba(255,70,70,0.10)",
                  color: "rgba(255,210,210,0.95)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {err}
              </div>
            ) : null}

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{
                  ...btn,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: saving
                    ? "rgba(255,255,255,0.12)"
                    : "linear-gradient(180deg, rgba(255,92,0,0.95), rgba(255,92,0,0.72))",
                  boxShadow: saving ? "none" : "0 12px 30px rgba(255,92,0,0.22)",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/pool/${poolId}/profile`)}
                style={{ ...btn, background: "rgba(0,0,0,0.18)", opacity: 0.95 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}