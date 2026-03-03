import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();

  // If already logged in, send to dashboard (or pool redirect will happen there)
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) redirect("/dashboard?onboarding=joinonly");

  return <LoginClient />;
}