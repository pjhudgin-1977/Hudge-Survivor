import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

// GET  -> returns an existing valid invite code for the pool (or creates one)
// POST -> force-create a brand new invite code (commissioner only)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json(401, { error: "Not signed in" });

  // Ensure user is at least a member of this pool (so members can see/share link)
  const { data: member, error: memberErr } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memberErr) return json(500, { error: memberErr.message });
  if (!member) return json(403, { error: "Not a member of this pool" });

  // 1) Try to reuse an existing valid invite
  const { data: existing, error: existingErr } = await supabase
    .from("pool_invites")
    .select("code, is_active, expires_at, max_uses, uses, created_at")
    .eq("pool_id", poolId)
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(10);

  if (existingErr) return json(500, { error: existingErr.message });

  const valid =
    (existing ?? []).find((i) => i.max_uses == null || (i.uses ?? 0) < i.max_uses) ??
    null;

  if (valid?.code) return json(200, { code: valid.code });

  // 2) None found -> create one via RPC
  const { data: code, error: rpcErr } = await supabase.rpc("create_pool_invite", {
    p_pool_id: poolId,
    p_created_by: auth.user.id,
    p_prefix: "HUDGE",
    p_suffix_len: 4,
    p_expires_at: null,
    p_max_uses: null,
  });

  if (rpcErr) return json(500, { error: rpcErr.message });
  return json(200, { code });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json(401, { error: "Not signed in" });

  // POST is "force new code" -> commissioner only
  const { data: member, error: memberErr } = await supabase
    .from("pool_members")
    .select("is_commissioner, role")
    .eq("pool_id", poolId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memberErr) return json(500, { error: memberErr.message });

  const isCommissioner =
    !!member && (member.is_commissioner === true || member.role === "commissioner");

  if (!isCommissioner) return json(403, { error: "Commissioner only" });

  const { data: code, error: rpcErr } = await supabase.rpc("create_pool_invite", {
    p_pool_id: poolId,
    p_created_by: auth.user.id,
    p_prefix: "HUDGE",
    p_suffix_len: 4,
    p_expires_at: null,
    p_max_uses: null,
  });

  if (rpcErr) return json(500, { error: rpcErr.message });
  return json(200, { code });
}