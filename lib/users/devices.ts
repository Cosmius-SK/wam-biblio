import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";

/**
 * The device registry.
 *
 * Without it, every device silently holds a copy of a journal and nothing
 * anywhere knows it exists — fine for one person with one phone, not fine the
 * moment a phone is lost. Seeing what holds a copy is how anyone notices that
 * something is wrong at all.
 *
 * Read honestly: disconnecting is a **request**, not a wipe. A device that is
 * never opened again keeps what it already has. See
 * docs/user-management/devices-and-deletion.md.
 */
const path = (sub: string) => `users/${sub}/devices.json`;

export interface DeviceRow {
  id: string;
  label: string;
  platform: string;
  firstSeen: number;
  lastSeen: number;
  /** Set when the owner has disconnected it; it wipes when next seen. */
  revokedAt?: number;
}

interface DeviceFile {
  devices: DeviceRow[];
}

async function read(sub: string): Promise<DeviceFile> {
  const token = blobToken();
  if (!token) return { devices: [] };
  try {
    const d = (await readSyncJson(path(sub), token)) as DeviceFile | null;
    return d?.devices && Array.isArray(d.devices) ? d : { devices: [] };
  } catch {
    return { devices: [] };
  }
}

async function write(sub: string, file: DeviceFile): Promise<void> {
  const token = blobToken();
  if (!token) return;
  await writeSyncJson(path(sub), JSON.stringify(file), token);
}

export async function listDevices(sub: string): Promise<DeviceRow[]> {
  return (await read(sub)).devices.sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Register or touch a device. Returns whether it has been disconnected. */
export async function seenDevice(
  sub: string,
  device: { id: string; label: string; platform: string },
): Promise<{ revoked: boolean }> {
  const file = await read(sub);
  const now = Date.now();
  const existing = file.devices.find((d) => d.id === device.id);
  if (existing?.revokedAt) return { revoked: true };
  if (existing) {
    existing.lastSeen = now;
    // A rename from the device itself is fine; it is their own label.
    if (device.label) existing.label = device.label;
  } else {
    file.devices.push({ ...device, firstSeen: now, lastSeen: now });
  }
  await write(sub, file);
  return { revoked: false };
}

export async function renameDevice(sub: string, id: string, label: string): Promise<void> {
  const file = await read(sub);
  const row = file.devices.find((d) => d.id === id);
  if (!row) return;
  row.label = label.slice(0, 60);
  await write(sub, file);
}

/** Cut a device off from future sync, and ask it to wipe when next seen. */
export async function revokeDevice(sub: string, id: string): Promise<void> {
  const file = await read(sub);
  const row = file.devices.find((d) => d.id === id);
  if (!row) return;
  row.revokedAt = Date.now();
  await write(sub, file);
}

export async function forgetDevice(sub: string, id: string): Promise<void> {
  const file = await read(sub);
  file.devices = file.devices.filter((d) => d.id !== id);
  await write(sub, file);
}
