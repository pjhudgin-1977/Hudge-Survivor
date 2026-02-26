import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  //
  // 1️⃣ Verify logged-in user (uses app cookies automatically)
  //
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const userEmail = userRes?.user?.email ?? "";

  //
  // 2️⃣ Admin allowlist check
  //
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  if (
    !adminEmail ||
    userEmail.toLowerCase() !== adminEmail.toLowerCase()
  ) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  //
  // 3️⃣ Service-role client (bypass RLS)
  //
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("autolock_runs")
.select("id, ran_at, status, message, duration_ms, details")
    .order("ran_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    runs: data ?? [],
  });
}