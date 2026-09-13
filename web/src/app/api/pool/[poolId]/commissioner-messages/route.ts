import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
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
  const subject = String(body?.subject || "").trim();
  const message = String(body?.message || "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .limit(1);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (!memberRows?.length) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("commissioner_messages")
    .insert({
      pool_id: poolId,
      user_id: userId,
      subject: subject || null,
      message,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
