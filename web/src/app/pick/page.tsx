"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PickRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // TEMP: send user to your main pool’s pick page
    router.replace("/pool/4931be58-aa45-4c89-aa36-2f0aa1061f45/pick");
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <p>Redirecting…</p>
    </main>
  );
}
