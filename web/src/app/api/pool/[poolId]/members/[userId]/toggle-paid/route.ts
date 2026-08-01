import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This payment-status endpoint has been retired. Use Admin → Players.",
    },
    { status: 410 }
  );
}
