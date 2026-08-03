import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: poolMembers } = await supabase
    .from("pool_members")
    .select("screen_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const firstPoolMember = poolMembers?.[0] ?? null;

  async function saveProfile(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const fullName = String(formData.get("full_name") ?? "").trim();
    const screenName = String(formData.get("screen_name") ?? "").trim();

    if (!fullName || !screenName) {
      redirect("/profile?error=Full name and screen name are required.");
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: fullName,
          email: user.email ?? null,
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      redirect(`/profile?error=${encodeURIComponent(profileError.message)}`);
    }

    const { error: memberError } = await supabase
      .from("pool_members")
      .update({ screen_name: screenName })
      .eq("user_id", user.id);

    if (memberError) {
      redirect(`/profile?error=${encodeURIComponent(memberError.message)}`);
    }

    redirect("/profile?saved=1");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 16,
    background: "rgba(0,0,0,0.22)",
    color: "white",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 850,
    fontSize: 15,
  };

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 18px 44px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 950 }}>
            Profile
          </h1>

          <p style={{ margin: "8px 0 0", opacity: 0.74, lineHeight: 1.5 }}>
            Update the name shown on your account and in pools.
          </p>
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 850,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </header>

      {sp?.error ? (
        <div
          style={{
            marginTop: 20,
            padding: "12px 14px",
            borderRadius: 11,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(127,29,29,0.22)",
            color: "#fecaca",
            fontWeight: 750,
          }}
        >
          {sp.error}
        </div>
      ) : null}

      {sp?.saved ? (
        <div
          style={{
            marginTop: 20,
            padding: "12px 14px",
            borderRadius: 11,
            border: "1px solid rgba(134,239,172,0.4)",
            background: "rgba(22,101,52,0.24)",
            color: "#bbf7d0",
            fontWeight: 800,
          }}
        >
          ✓ Profile saved.
        </div>
      ) : null}

      <section
        style={{
          marginTop: 22,
          padding: 20,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(10,12,18,0.58)",
        }}
      >
        <form action={saveProfile} style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="full_name" style={labelStyle}>
              Full name
            </label>

            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={profile?.full_name ?? ""}
              placeholder="Patrick Hudgin"
              autoComplete="name"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="screen_name" style={labelStyle}>
              Screen name
            </label>

            <input
              id="screen_name"
              name="screen_name"
              type="text"
              defaultValue={firstPoolMember?.screen_name ?? ""}
              placeholder="Paddy"
              autoComplete="nickname"
              required
              style={inputStyle}
            />

            <div style={{ fontSize: 13, opacity: 0.68, lineHeight: 1.4 }}>
              This is the name other players see in your pools.
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>Email</label>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.78)",
                fontSize: 16,
                fontWeight: 700,
                overflowWrap: "anywhere",
              }}
            >
              {profile?.email ?? user.email ?? ""}
            </div>

            <div style={{ fontSize: 13, opacity: 0.62, lineHeight: 1.4 }}>
              Your email is tied to your sign-in account and can’t be changed here.
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: 4,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 11,
              border: "1px solid #fb923c",
              background: "#f97316",
              color: "#000",
              fontSize: 16,
              fontWeight: 950,
              cursor: "pointer",
            }}
          >
            Save Profile
          </button>
        </form>
      </section>
    </main>
  );
}
