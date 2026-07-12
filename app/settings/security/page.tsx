"use client";

import SettingsShell from "@/components/SettingsShell";
import AppLockCard from "@/components/AppLockCard";

export default function SecuritySettingsPage() {
  return (
    <SettingsShell title="Security" blurb="Who can open the journal on this device.">
      <AppLockCard />
    </SettingsShell>
  );
}
