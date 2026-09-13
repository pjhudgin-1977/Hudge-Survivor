import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      retired: true,
      message: "This score updater has been retired. Scores are synced through ESPN/Supabase.",
    },
    { status: 410 }
  );
}
