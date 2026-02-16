import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, seasonYear, screenName, userId } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("pools")
.insert([{ name, season_year: seasonYear, commissioner_user_id: userId }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: memberErr } = await supabase.from("pool_members").insert([
      {
        pool_id: data.id,
        user_id: userId,
        screen_name: screenName,
        losses: 0,
        is_eliminated: false,
      },
    ]);

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    return NextResponse.json({ poolId: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


