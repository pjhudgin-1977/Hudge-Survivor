import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This join method is no longer supported. Use a valid HUDGE invite code.",
    },
    { status: 410 }
  );
}
