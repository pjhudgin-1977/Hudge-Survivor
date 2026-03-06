import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/profile");

  const user = auth.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: firstPoolMember } = await supabase
    .from("pool_members")
    .select("screen_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  async function saveProfile(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) redirect("/login?next=/profile");

    const fullName = String(formData.get("full_name") ?? "").trim();
    const screenName = String(formData.get("screen_name") ?? "").trim();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user.id);

    if (error) {
      redirect(`/profile?error=${encodeURIComponent(error.message)}`);
    }

    const nextScreenName =
      screenName ||
      fullName ||
      auth.user.email?.split("@")[0]?.trim() ||
      "Player";

    const { error: poolMembersError } = await supabase
      .from("pool_members")
      .update({ screen_name: nextScreenName })
      .eq("user_id", auth.user.id);

    if (poolMembersError) {
      redirect(
        `/profile?error=${encodeURIComponent(poolMembersError.message)}`
      );
    }

    redirect("/profile?saved=1");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
        Profile
      </h1>

      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Update your display details. Full name is your account name. Screen
        name is how you appear in pools.
      </p>

      {sp?.error ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#3b0d0d",
            color: "#ffd7d7",
            fontWeight: 700,
          }}
        >
          Error: {sp.error}
        </div>
      ) : null}

      {sp?.saved ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#0f3b24",
            color: "#d7ffe8",
            fontWeight: 700,
          }}
        >
          Profile saved.
        </div>
      ) : null}

      <form action={saveProfile} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label htmlFor="full_name" style={{ fontWeight: 700 }}>
            Full Name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile?.full_name ?? ""}
            placeholder="Patrick Hudgin"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 16,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label htmlFor="screen_name" style={{ fontWeight: 700 }}>
            Screen Name
          </label>
          <input
            id="screen_name"
            name="screen_name"
            type="text"
            defaultValue={firstPoolMember?.screen_name ?? ""}
            placeholder="Paddy3"
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 16,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label htmlFor="email" style={{ fontWeight: 700 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="text"
            value={user.email ?? ""}
            disabled
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 16,
              background: "#f5f5f5",
              opacity: 0.8,
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: 8,
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Save Profile
        </button>
      </form>
    </main>
  );
}