import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// BEST-EFFORT admin check with common patterns:
// - pools.owner_id or pools.created_by
// - pool_members.role = 'admin'
// - pool_members.is_admin = true
async function isPoolAdmin(
  supabase: any,
  poolId: string,
  userId: string
): Promise<boolean> {
  // 1) pools table owner/creator pattern
  const { data: poolRow } = await supabase
    .from("pools")
    .select("owner_id, created_by")
    .eq("id", poolId)
    .maybeSingle();

  if (poolRow?.owner_id === userId || poolRow?.created_by === userId) return true;

  // 2) pool_members role/is_admin pattern
  const { data: memberRow } = await supabase
    .from("pool_members")
    .select("role, is_admin")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!memberRow) return false;

  const role = String(memberRow.role ?? "").toLowerCase();
  if (role === "admin" || role === "owner") return true;
  if (memberRow.is_admin === true) return true;

  return false;
}

export async function POST(
  _req: Request,
  { params }: { params: { poolId: string } }
) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const poolId = params.poolId;
  const userId = auth.user.id;

  const okAdmin = await isPoolAdmin(supabase, poolId, userId);
  if (!okAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Call DB function
  const { data, error } = await supabase.rpc("force_autopick_now", {
    p_pool_id: poolId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Check DB function force_autopick_now(uuid)" },
      { status: 400 }
    );
  }

  return NextResponse.json(data ?? { ok: true });
}