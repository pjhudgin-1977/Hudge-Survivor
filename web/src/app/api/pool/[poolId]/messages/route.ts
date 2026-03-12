import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  context: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    console.log("❌ Not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = auth.user.id;
  const { poolId } = await context.params;

  const body = await req.json();
  const message = (body?.message || "").trim();

  if (!message) {
    console.log("❌ Empty message");
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  console.log("📨 Insert attempt:", { poolId, userId, message });

  const { data, error } = await supabase
    .from("pool_messages")
    .insert({
      pool_id: poolId,
      user_id: userId,
      message,
    })
    .select();

  if (error) {
    console.log("❌ Insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("✅ Insert success:", data);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ poolId: string }> }
) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = auth.user.id;
  const { poolId } = await context.params;

  const body = await req.json();
  const messageId = String(body?.messageId || "").trim();

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  
  const { data: memberRows, error: memberError } = await supabase
    .from("pool_members")
    .select("is_commissioner")
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const isCommissioner =
    Array.isArray(memberRows) &&
    memberRows.some((row) => !!row.is_commissioner);

  if (!isCommissioner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }


  const { error: deleteError } = await supabase
    .from("pool_messages")
    .delete()
    .eq("id", messageId)
    .eq("pool_id", poolId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}