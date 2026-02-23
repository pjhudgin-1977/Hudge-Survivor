import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  // Get logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Read body
  const body = await req.json().catch(() => ({}));
  const poolId = (body?.poolId ?? "").toString().trim();

  if (!poolId) {
    return NextResponse.json(
      { error: "Missing poolId" },
      { status: 400 }
    );
  }

  // Check if already a member
  const { data: existing, error: existingError } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  // Insert membership
  const { error: insertError } = await supabase
    .from("pool_members")
    .insert({
      pool_id: poolId,
      user_id: user.id,
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, alreadyMember: false });
}