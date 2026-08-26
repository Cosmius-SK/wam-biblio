"use client";

import SettingsShell from "@/components/SettingsShell";
import WorldCard from "@/components/world/WorldCard";

export default function WorldSettingsPage() {
  return (
    <SettingsShell
      title="Your world"
      blurb="The people, places and things your journal keeps coming back to."
    >
      <WorldCard />
    </SettingsShell>
  );
}
