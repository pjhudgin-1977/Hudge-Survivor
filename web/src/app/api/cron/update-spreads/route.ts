import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === secret) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing ODDS_API_KEY" },
      { status: 500 }
    );
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
  );

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();

    return NextResponse.json(
      {
        ok: false,
        error: "Odds API request failed",
        status: res.status,
        body: text,
      },
      { status: 500 }
    );
  }

  const data = await res.json();

  return NextResponse.json({
    ok: true,
    count: Array.isArray(data) ? data.length : null,
    sample: Array.isArray(data) ? data.slice(0, 3) : data,
  });
}