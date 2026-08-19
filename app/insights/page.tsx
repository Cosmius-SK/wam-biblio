import { notFound } from "next/navigation";
import { blobToken, listPrefix, readSyncJson } from "@/lib/blobStore";
import { agoLabel } from "@/lib/format";
import HealthCard from "@/components/HealthCard";
import { currentUser } from "@/lib/users/limits";
import { ownerEmail } from "@/lib/users/allowlist";

export const dynamic = "force-dynamic";

/**
 * The owner's view. Two numbers per person per day, summed across their
 * devices — which is the whole dataset, because that is the whole dataset.
 *
 * Gated to the owner's own Google account: a 404, not a "forbidden", so its
 * existence is not advertised to anyone else.
 */
interface Row {
  sub: string;
  date: string;
  entries: number;
  activeMinutes: number;
}

interface Message {
  at: number;
  from?: { email?: string | null; name?: string | null };
  prompt?: string | null;
  message: string;
  context?: { version?: string; device?: string } | null;
}

/** What people chose to say. The only words on this page, and volunteered. */
async function messages(): Promise<Message[]> {
  const token = blobToken();
  if (!token) return [];
  const files = await listPrefix("feedback/", token).catch(() => []);
  const all = await Promise.all(
    files.slice(0, 200).map((f) => readSyncJson(f.url, token).catch(() => null)),
  );
  return (all.filter(Boolean) as Message[]).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

async function gather(): Promise<Row[]> {
  const token = blobToken();
  if (!token) return [];
  const files = await listPrefix("insights/", token).catch(() => []);
  const recent = new Set(
    Array.from({ length: 14 }, (_, i) =>
      new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
    ),
  );
  const wanted = files.filter((f) => {
    const parts = f.pathname.split("/");
    return parts.length >= 4 && recent.has(parts[2]);
  });

  const byKey = new Map<string, Row>();
  await Promise.all(
    wanted.map(async (f) => {
      const d = (await readSyncJson(f.url, token).catch(() => null)) as {
        entries?: number;
        activeMinutes?: number;
      } | null;
      if (!d) return;
      const [, sub, date] = f.pathname.split("/");
      const key = `${sub}|${date}`;
      const row = byKey.get(key) ?? { sub, date, entries: 0, activeMinutes: 0 };
      row.entries += Number(d.entries) || 0;
      row.activeMinutes += Number(d.activeMinutes) || 0;
      byKey.set(key, row);
    }),
  );
  return [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default async function InsightsPage() {
  const user = await currentUser();
  const owner = ownerEmail();
  if (!user || !owner || user.email?.toLowerCase() !== owner) notFound();

  const [rows, notes] = await Promise.all([gather(), messages()]);
  const people = [...new Set(rows.map((r) => r.sub))];

  return (
    <main className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-3xl text-ink">Insights</h1>
      <p className="mt-1 text-sm text-muted">
        Entries written and minutes spent. Nothing else exists — see
        <code className="mx-1 text-xs">lib/insights/schema.ts</code>.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nothing recorded in the last two weeks.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {people.length} {people.length === 1 ? "person" : "people"} · last 14 days
          </p>
          <ul className="mt-4 divide-y divide-hairline/50 overflow-hidden rounded-2xl border border-hairline/60">
            {rows.map((r) => (
              <li
                key={`${r.sub}|${r.date}`}
                className="flex items-center justify-between gap-3 bg-surface/60 px-5 py-3"
              >
                <span className="font-mono text-xs text-muted">
                  {r.date} · {r.sub.slice(-6)}
                </span>
                <span className="text-sm text-ink/80">
                  {r.entries} {r.entries === 1 ? "entry" : "entries"} · {r.activeMinutes} min
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-10">
        <HealthCard />
      </div>

      <h2 className="mt-12 font-serif text-2xl text-ink">What people said</h2>
      <p className="mt-1 text-sm text-muted">
        Written to you deliberately. This is the only place anyone&rsquo;s words appear.
      </p>

      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((m) => (
            <li
              key={m.at}
              className="rounded-2xl border-2 border-terracotta/25 bg-surface/60 p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted">
                <span className="text-ink/80">{m.from?.name || m.from?.email || "someone"}</span>
                <span>{agoLabel(m.at)}</span>
                {m.context?.version && <span>v{m.context.version}</span>}
                {m.context?.device && <span>{m.context.device}</span>}
              </div>
              {m.prompt && <p className="mt-2 text-xs italic text-muted/80">{m.prompt}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {m.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-xs leading-relaxed text-muted/70">
        People are shown by the last characters of their Google id in the numbers above, not
        their name or address. Names appear only on messages they chose to send you.
      </p>
    </main>
  );
}
