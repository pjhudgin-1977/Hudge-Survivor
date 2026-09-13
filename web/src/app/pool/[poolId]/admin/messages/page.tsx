import { createClient } from "@/lib/supabase/server";

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const supabase = await createClient();
  const { poolId } = await params;

  const { data: messages, error } = await supabase
    .from("commissioner_messages")
    .select("id, user_id, subject, message, is_read, created_at")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Private Messages</h1>
        <p className="mt-4 text-red-400">{error.message}</p>
      </main>
    );
  }

  const userIds = [...new Set((messages || []).map((m) => m.user_id))];

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds)
    : { data: [] };

  const { data: members } = userIds.length
    ? await supabase
        .from("pool_members")
        .select("user_id, screen_name")
        .eq("pool_id", poolId)
        .in("user_id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  const memberMap = new Map<string, string>();

  for (const row of members || []) {
    if (!memberMap.has(row.user_id) && row.screen_name) {
      memberMap.set(row.user_id, row.screen_name);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Private Messages</h1>

      <p className="mt-2 text-sm text-white/60">
        Messages sent privately to the commissioner.
      </p>

      {!messages?.length ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          No private messages yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {messages.map((msg) => {
            const screenName =
              memberMap.get(msg.user_id) || "Pool Member";

            const email =
              profileMap.get(msg.user_id)?.email || "";

            return (
              <article
                key={msg.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{screenName}</div>

                    {email ? (
                      <div className="text-sm text-white/50">
                        {email}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-white/40">
                    {new Date(msg.created_at).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-white/80">
                    {msg.subject || "No subject"}
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-white/80">
                    {msg.message}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
