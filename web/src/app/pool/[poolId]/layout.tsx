import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/app/_components/NavBar";

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const userId = auth.user.id;
  const { poolId } = await params;

  // ✅ Use is_commissioner boolean
  const { data: member } = await supabase
    .from("pool_members")
    .select("is_commissioner")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  const isCommissioner = !!member?.is_commissioner;

  return (
    <div>
      <NavBar poolId={poolId} isCommissioner={isCommissioner} />
      <main>{children}</main>
    </div>
  );
}