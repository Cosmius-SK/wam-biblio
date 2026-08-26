/**
 * The record types differential sync knows about — defined once.
 *
 * This list has now been wrong twice in two different files, each time letting
 * a record push successfully and then silently refuse to come back. Sync fails
 * quietly by nature, so a mismatch here doesn't error anywhere: it just means
 * something a person wrote never arrives on their other device.
 *
 *   e — entry      p — portrait     r — reflection
 *   k — media key  d — the draft    w — someone (or somewhere) in your world
 */
export const REC_TYPES = "eprkdw";

const KEY = new RegExp(`^[${REC_TYPES}]/[A-Za-z0-9._-]{1,200}$`);

/** `<type>/<recordId>` as it appears in a request. */
export function isRecordKey(key: unknown): key is string {
  return typeof key === "string" && KEY.test(key);
}

/** The same thing at the end of a blob pathname. */
export function parseRecordPath(pathname: string): { type: string; id: string } | null {
  const m = pathname.match(new RegExp(`/([${REC_TYPES}])/(.+)\\.json$`));
  return m ? { type: m[1], id: m[2] } : null;
}
