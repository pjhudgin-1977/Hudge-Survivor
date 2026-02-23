export const dynamic = "force-dynamic";

import { Suspense } from "react";
import JoinPoolClient from "./JoinPoolClient";

export default function JoinPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading join link…</main>}>
      <JoinPoolClient />
    </Suspense>
  );
}