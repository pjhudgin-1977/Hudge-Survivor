import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
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

  // ✅ Commissioner gate
  const { data: member } = await supabase
    .from("pool_members")
    .select("is_commissioner")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member?.is_commissioner) {
    // Send them somewhere safe
    redirect(`/pool/${poolId}`);
  }

  return <>{children}</>;
}