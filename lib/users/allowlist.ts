import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";

/**
 * Who may come in.
 *
 * The list lives in the Blob store so adding someone is a tap in the owner
 * view rather than an env var and a redeploy — configuring people as
 * deployment secrets is hardcoding by another name, and it scales to about
 * nobody. `ALLOWED_USERS` still works as a seed for the first deploy.
 *
 * **With no list configured at all, the Google door is shut.** The shared
 * passcode is unaffected. Failing closed here means turning on the new door is
 * always a deliberate act, never a side effect of deploying.
 */
const PATH = "users/allowed.json";

export interface AllowedUser {
  email: string;
  addedAt: number;
}

interface AllowFile {
  users: AllowedUser[];
}

const norm = (e: string) => e.trim().toLowerCase();

function fromEnv(): string[] {
  const raw = `${process.env.ALLOWED_USERS ?? ""},${process.env.OWNER_EMAIL ?? ""}`;
  return raw.split(",").map(norm).filter(Boolean);
}

export function ownerEmail(): string {
  return norm(process.env.OWNER_EMAIL ?? "");
}

async function fromBlob(): Promise<string[]> {
  const token = blobToken();
  if (!token) return [];
  try {
    const data = (await readSyncJson(PATH, token)) as AllowFile | null;
    if (!data?.users || !Array.isArray(data.users)) return [];
    return data.users.map((u) => norm(u.email)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Every address currently allowed in, from both sources. */
export async function allowedEmails(): Promise<string[]> {
  const [blob, env] = [await fromBlob(), fromEnv()];
  return [...new Set([...blob, ...env])];
}

export async function isAllowed(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const list = await allowedEmails();
  return list.includes(norm(email));
}

/** True when anyone at all has been allowed — i.e. the door exists. */
export async function allowlistConfigured(): Promise<boolean> {
  return (await allowedEmails()).length > 0;
}

/** Owner-only: add someone. Env-seeded addresses stay where they are. */
export async function addAllowed(email: string): Promise<void> {
  const token = blobToken();
  if (!token) throw new Error("No Blob store is connected.");
  const current = ((await readSyncJson(PATH, token).catch(() => null)) as AllowFile | null) ?? {
    users: [],
  };
  const e = norm(email);
  if (!e) throw new Error("That doesn't look like an email address.");
  if (current.users.some((u) => norm(u.email) === e)) return;
  current.users.push({ email: e, addedAt: Date.now() });
  await writeSyncJson(PATH, JSON.stringify(current), token);
}

export async function removeAllowed(email: string): Promise<void> {
  const token = blobToken();
  if (!token) throw new Error("No Blob store is connected.");
  const current = ((await readSyncJson(PATH, token).catch(() => null)) as AllowFile | null) ?? {
    users: [],
  };
  const e = norm(email);
  current.users = current.users.filter((u) => norm(u.email) !== e);
  await writeSyncJson(PATH, JSON.stringify(current), token);
}
