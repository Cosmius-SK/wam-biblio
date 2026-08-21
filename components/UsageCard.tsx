"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type AiLogRow } from "@/lib/db";
import { formatCost, formatDate, formatTime, modelLabel } from "@/lib/format";
import { isOwner } from "@/lib/owner";

const FEATURES: { key: AiLogRow["feature"]; label: string }[] = [
  { key: "shape", label: "Shaped entries" },
  { key: "ask", label: "Questions" },
  { key: "reflect", label: "Reflections" },
  { key: "illustrate", label: "Illustrations" },
];

/**
 * Settings › AI › Usage: the itemised ledger of live AI calls on this device
 * — Claude by tokens with estimated cost, Gemini images by count (free tier).
 * Sample-mode previews are free and never logged.
 */
export default function UsageCard() {
  const rows = useLiveQuery(() => db.ailog.orderBy("at").reverse().toArray());
  const [showRecent, setShowRecent] = useState(false);
  /**
   * Money is the deployment owner's business, not the writer's. Someone using
   * biblio on an invitation should not be totting up what they are costing
   * their host — that is how a person quietly stops using something. They see
   * how much they have used; the owner sees what it cost.
   */
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    void isOwner().then(setOwner);
  }, []);

  if (!rows) return null;

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const sum = (list: AiLogRow[]) => list.reduce((n, r) => n + r.cost, 0);
  const today = rows.filter((r) => r.at >= startOfToday);
  const month = rows.filter((r) => r.at >= startOfMonth);
  const imagesToday = today.reduce((n, r) => n + (r.images ?? 0), 0);

  const first = rows[rows.length - 1];

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Usage on this device</h2>

      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          No live AI calls logged yet. Sample mode is free and doesn&rsquo;t appear here.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Today", today],
                ["This month", month],
                ["All time", rows],
              ] as [string, AiLogRow[]][]
            ).map(([label, list]) => (
              <div key={label} className="rounded-xl bg-paper/50 px-2 py-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 font-medium tabular-nums text-ink">
                  {owner ? formatCost(sum(list)) : list.length}
                </p>
                {!owner && <p className="text-[0.65rem] text-muted/70">calls</p>}
              </div>
            ))}
          </div>

          <ul className="mt-4 space-y-1.5">
            {FEATURES.map(({ key, label }) => {
              const of = rows.filter((r) => r.feature === key);
              if (of.length === 0) return null;
              const images = of.reduce((n, r) => n + (r.images ?? 0), 0);
              return (
                <li key={key} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink/80">{label}</span>
                  <span className="tabular-nums text-muted">
                    {key === "illustrate"
                      ? `${images} image${images === 1 ? "" : "s"}${owner ? ` · ≈ ${formatCost(sum(of))}` : ""}`
                      : `${of.length} ×${owner ? ` · ${formatCost(sum(of))}` : ""}`}
                  </span>
                </li>
              );
            })}
          </ul>

          {imagesToday > 0 && (
            <p className="mt-3 text-xs text-muted/80">
              {imagesToday} illustration{imagesToday === 1 ? "" : "s"} today — billed ≈4¢ each
              on billing-enabled (Tier 1+) Gemini keys; free-tier keys aren&rsquo;t charged.
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            className="mt-4 text-sm text-lavender underline-offset-2 hover:underline"
          >
            {showRecent ? "Hide recent activity" : "Recent activity"}
          </button>
          {showRecent && (
            <ul className="mt-2 space-y-1 border-t border-hairline/50 pt-3">
              {rows.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2 text-xs text-muted">
                  <span>
                    {FEATURES.find((f) => f.key === r.feature)?.label ?? r.feature} ·{" "}
                    {modelLabel(r.model)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {r.images ? `${r.images} img` : owner ? formatCost(r.cost) : modelLabel(r.model)} ·{" "}
                    {formatDate(r.at)} {formatTime(r.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-muted/70">
            Estimates from calls logged on this device since {formatDate(first.at)}.
          </p>
        </>
      )}
    </div>
  );
}
