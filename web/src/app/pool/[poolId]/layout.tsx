import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/app/_components/NavBar";
import { getCurrentWeek } from "@/lib/getCurrentWeek";

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  // Screen name (optional)
  const { data: me } = await supabase
    .from("pool_members")
    .select("screen_name")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // ✅ Current week (global brain)
  const week = await getCurrentWeek();
  const status: "OPEN" | "LOCKED" = week?.locked ? "LOCKED" : "OPEN";
  const label = week?.label;

  // ✅ Live counters
  const { count: aliveCount } = await supabase
    .from("pool_members")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("is_eliminated", false);

  const { count: dangerCount } = await supabase
    .from("v_danger_zone")
    .select("user_id", { count: "exact", head: true })
    .eq("pool_id", poolId);

  const { count: eliminatedCount } = await supabase
    .from("pool_members")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("is_eliminated", true);

  const countersText = `${aliveCount ?? 0} Alive • ${dangerCount ?? 0} Danger • ${
    eliminatedCount ?? 0
  } Eliminated`;

  return (
    <div>
      <NavBar
        poolId={poolId}
        status={status}
        label={label}
        screenName={me?.screen_name ?? undefined}
        // NEW: show counters under the nav (we’ll add support next)
        countersText={countersText}
      />
      {children}
    </div>
  );
}