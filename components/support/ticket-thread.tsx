import type { TicketReply } from "@/lib/support/tickets";

const BUCKET_NOTE = "Attachments are stored privately; open from the admin panel if needed.";

/** Presentational thread of replies (used by both admin and user ticket pages). */
export function TicketThread({ replies }: { replies: TicketReply[] }) {
  return (
    <div className="space-y-3">
      {replies.map((r) => {
        const isAdmin = r.author_role === "admin";
        return (
          <div
            key={r.id}
            className={`rounded-xl border p-4 shadow-sm ${
              isAdmin ? "border-[#C9A84C]/40 bg-[#FBF7EE]" : "border-neutral-200 bg-white"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className={`text-xs font-semibold ${isAdmin ? "text-[#9a7d2f]" : "text-neutral-700"}`}>
                {isAdmin ? "KDP Mafia Support" : r.author_email ?? "You"}
              </span>
              <span className="text-[10px] text-neutral-400">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{r.body}</p>
            {r.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" title={BUCKET_NOTE}>
                {r.attachments.map((a) => (
                  <span key={a.key} className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                    📎 {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
