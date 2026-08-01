import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import PlayersTable from "./PlayersTable";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function AdminPlayersPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const adminSupabase = getAdminSupabase();
  const { poolId } = await params;

  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes?.user) {
    redirect("/login");
  }

  const { data: commissionerRows, error: commissionerError } =
    await adminSupabase
      .from("pool_members")
      .select("is_commissioner, role")
      .eq("pool_id", poolId)
      .eq("user_id", userRes.user.id);

  const isCommissioner = (commissionerRows ?? []).some(
    (row) =>
      Boolean(row.is_commissioner) ||
      String(row.role ?? "").toLowerCase() === "commissioner" ||
      String(row.role ?? "").toLowerCase() === "admin"
  );

  if (commissionerError || !isCommissioner) {
    redirect(`/pool/${poolId}`);
  }

  const { data: members, error: membersError } = await adminSupabase
    .from("pool_members")
    .select(
      `
        user_id,
        entry_no,
        screen_name,
        role,
        is_commissioner,
        entry_fee_paid,
        entry_fee_amount,
        losses,
        is_eliminated
      `
    )
    .eq("pool_id", poolId)
    .order("screen_name", { ascending: true })
    .order("entry_no", { ascending: true });

  if (membersError) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin — Players</h1>

        <p style={{ marginTop: 12, color: "#f99" }}>
          Error loading players: {membersError.message}
        </p>
      </main>
    );
  }

  const userIds = Array.from(
    new Set(
      (members ?? [])
        .map((member) => String(member.user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const profilesByUserId = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    if (!profilesError) {
      for (const profile of profiles ?? []) {
        profilesByUserId.set(profile.user_id, {
          full_name:
            String(profile.full_name ?? "").trim() || null,
          email:
            String(profile.email ?? "").trim().toLowerCase() || null,
        });
      }
    }
  }

  const authUsersById = new Map<string, { email: string | null }>();

  await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } =
        await adminSupabase.auth.admin.getUserById(userId);

      if (!error && data?.user) {
        authUsersById.set(userId, {
          email:
            String(data.user.email ?? "").trim().toLowerCase() || null,
        });
      }
    })
  );

  const mergedMembers = (members ?? []).map((member) => {
    const profile = profilesByUserId.get(member.user_id);
    const authUser = authUsersById.get(member.user_id);

    return {
      ...member,
      profiles: {
        full_name: profile?.full_name ?? null,
        email: authUser?.email ?? profile?.email ?? null,
      },
    };
  });

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Admin — Players</h1>

      <p style={{ marginTop: 8, opacity: 0.85 }}>
        View and manage player details for this pool.
      </p>

      <div style={{ marginTop: 16 }}>
        <PlayersTable poolId={poolId} initialMembers={mergedMembers} />
      </div>
    </main>
  );
}
