import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  poolId: string;
  userId: string;
  action: "reset_losses" | "set_eliminated" | "kick_member" | "set_commissioner";
  value?: boolean; // used for set_eliminated, set_commissioner
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const poolId = String(body.poolId ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    const action = body.action;

    if (!poolId || !userId || !action) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    // Commissioner-only gate
    const { data: gate, error: gateErr } = await supabase
      .from("pool_members")
      .select("is_commissioner")
      .eq("pool_id", poolId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (gateErr) return NextResponse.json({ ok: false, error: gateErr.message }, { status: 403 });
    if (!gate?.is_commissioner) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    // Prevent self-kick (easy foot-gun)
    if (action === "kick_member" && userId === auth.user.id) {
      return NextResponse.json({ ok: false, error: "You can't kick yourself." }, { status: 400 });
    }

    if (action === "reset_losses") {
      const { error: upErr } = await supabase
        .from("pool_members")
        .update({ losses: 0, eliminated: false, is_eliminated: false })
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_eliminated") {
      const value = Boolean(body.value);
      const { error: upErr } = await supabase
        .from("pool_members")
        .update({ eliminated: value, is_eliminated: value })
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_commissioner") {
      const value = Boolean(body.value);

      // prevent removing commissioner from yourself (optional safety)
      if (userId === auth.user.id && value === false) {
        return NextResponse.json(
          { ok: false, error: "You can't remove commissioner from yourself here." },
          { status: 400 }
        );
      }

      const { error: upErr } = await supabase
        .from("pool_members")
        .update({ is_commissioner: value })
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "kick_member") {
      // If you have other pool-scoped tables keyed by (pool_id, user_id),
      // we can cascade later. For now, simplest: remove membership.
      const { error: delErr } = await supabase
        .from("pool_members")
        .delete()
        .eq("pool_id", poolId)
        .eq("user_id", userId);

      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}