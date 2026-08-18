"use client";

import SettingsShell from "@/components/SettingsShell";
import AppLockCard from "@/components/AppLockCard";
import JournalKeyCard from "@/components/JournalKeyCard";

export default function SecuritySettingsPage() {
  return (
    <SettingsShell title="Security" blurb="Who can open the journal on this device.">
      <div className="space-y-4">
        <JournalKeyCard />
        <AppLockCard />
      </div>
    </SettingsShell>
  );
}
