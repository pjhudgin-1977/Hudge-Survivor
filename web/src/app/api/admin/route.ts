import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  // 1) Must be logged in (cookie-based session)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
    },
  });

  const { data: userRes } = await supabase.auth.getUser();
  const userEmail = userRes?.user?.email ?? "";

  // 2) Must be admin email
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  if (!adminEmail || userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // 3) Read logs using service role (bypasses RLS)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("autolock_runs")
    .select("id, ran_at, status, message, duration_ms")
    .order("ran_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, runs: data ?? [] });
}