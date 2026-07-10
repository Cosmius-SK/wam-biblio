import type { EntryPlace } from "./types";

/**
 * Place search via the Open-Meteo geocoding API — free, no key, CORS-enabled,
 * city/town-level results worldwide. Used by the capture screen's place
 * chooser: the user types, picks from real results, and only a picked place is
 * ever stored (no free text).
 */
interface GeoResult {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<EntryPlace[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query,
  )}&count=6&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Place search is unavailable right now.");
  const data = (await res.json()) as { results?: GeoResult[] };
  return (data.results ?? [])
    .filter((r) => r.name && typeof r.latitude === "number" && typeof r.longitude === "number")
    .map((r) => ({
      name: r.name as string,
      region: r.admin1,
      country: r.country,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
    }));
}

/** "Chennai, Tamil Nadu, India" — deduped, compact. */
export function placeLabel(p: EntryPlace): string {
  const parts = [p.name];
  if (p.region && p.region !== p.name) parts.push(p.region);
  if (p.country && p.country !== p.region) parts.push(p.country);
  return parts.join(", ");
}
