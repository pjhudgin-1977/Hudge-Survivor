import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/join/${poolId}`);

  // Try to add user to pool_members (idempotent via unique constraint ideally)
  const { error } = await supabase.from("pool_members").upsert(
  {
    pool_id: poolId,
    user_id: auth.user.id,
    screen_name: auth.user.email?.split("@")[0] ?? "player",
  },
  { onConflict: "pool_id,user_id" }
);

  // If already a member, Supabase may error depending on constraints.
  // We'll ignore duplicate errors later if needed.
  if (error) {
    // keep it simple for now: still route to pool home
  }

  redirect(`/pool/${poolId}`);
}