import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";
import { addAllowed } from "./allowlist";

/**
 * Invite links.
 *
 * An allowlist the owner edits by hand means every new person waits for him to
 * be awake and at a keyboard — which is a poor way to greet someone who has
 * just been told about the app. But leaving the door open is worse: this
 * deployment spends real money on every entry, and the OAuth consent cap is
 * counted for the lifetime of the project and cannot be reset. A stranger
 * costs something permanent.
 *
 * A link is the middle: whoever holds it walks straight in, and nobody else
 * can. The link is what is shared, so no address has to be known in advance.
 */
const PATH = "users/invites.json";

export interface Invite {
  /** The unguessable part of the URL. */
  id: string;
  note: string;
  createdAt: number;
  /** How many people may use it. */
  uses: number;
  used: number;
  expiresAt: number;
  revokedAt?: number;
  /** Who has come in on it, for the owner's own sense of who is who. */
  accepted: string[];
}

interface InviteFile {
  invites: Invite[];
}

async function read(): Promise<InviteFile> {
  const token = blobToken();
  if (!token) return { invites: [] };
  try {
    const d = (await readSyncJson(PATH, token)) as InviteFile | null;
    return d?.invites && Array.isArray(d.invites) ? d : { invites: [] };
  } catch {
    return { invites: [] };
  }
}

async function write(file: InviteFile): Promise<void> {
  const token = blobToken();
  if (!token) throw new Error("No Blob store is connected.");
  await writeSyncJson(PATH, JSON.stringify(file), token);
}

export async function listInvites(): Promise<Invite[]> {
  return (await read()).invites.sort((a, b) => b.createdAt - a.createdAt);
}

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createInvite(opts: {
  note?: string;
  uses?: number;
  days?: number;
}): Promise<Invite> {
  const file = await read();
  const invite: Invite = {
    id: newId(),
    note: (opts.note ?? "").slice(0, 60),
    createdAt: Date.now(),
    uses: Math.min(50, Math.max(1, Math.round(opts.uses ?? 1))),
    used: 0,
    expiresAt: Date.now() + Math.min(90, Math.max(1, Math.round(opts.days ?? 14))) * 86_400_000,
    accepted: [],
  };
  file.invites.push(invite);
  await write(file);
  return invite;
}

export async function revokeInvite(id: string): Promise<void> {
  const file = await read();
  const row = file.invites.find((i) => i.id === id);
  if (!row) return;
  row.revokedAt = Date.now();
  await write(file);
}

export function inviteUsable(i: Invite | undefined): i is Invite {
  return !!i && !i.revokedAt && i.used < i.uses && i.expiresAt > Date.now();
}

/**
 * Spend one use of an invite and let this person in.
 *
 * Deliberately does the allowlist write first: being added and not counted is
 * a person who got in, which is the intent; being counted and not added is a
 * person left outside holding a link that no longer works.
 */
export async function redeemInvite(id: string, email: string): Promise<boolean> {
  if (!id || !email) return false;
  const file = await read();
  const invite = file.invites.find((i) => i.id === id);
  if (!inviteUsable(invite)) return false;

  await addAllowed(email);
  invite.used += 1;
  if (!invite.accepted.includes(email.toLowerCase())) {
    invite.accepted.push(email.toLowerCase());
  }
  await write(file);
  return true;
}
