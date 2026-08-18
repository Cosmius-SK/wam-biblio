import { notFound } from "next/navigation";
import { blobToken, listPrefix, readSyncJson } from "@/lib/blobStore";
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

  const rows = await gather();
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

      <p className="mt-8 text-xs leading-relaxed text-muted/70">
        People are shown by the last characters of their Google id, not their name or
        address. Whether that is enough distance is worth revisiting if this ever grows.
      </p>
    </main>
  );
}
