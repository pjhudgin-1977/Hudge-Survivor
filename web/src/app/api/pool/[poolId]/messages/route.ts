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