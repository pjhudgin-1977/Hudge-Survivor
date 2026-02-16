"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase...");
  const [poolNames, setPoolNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pools")
        .select("name");

      if (error) {
        setStatus("Error: " + error.message);
        return;
      }

      setStatus("Connected to Supabase ✅");
      setPoolNames((data ?? []).map((r) => r.name));
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Hudge Survivor</h1>
      <p>{status}</p>

      <ul>
        {poolNames.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </main>
  );
}
