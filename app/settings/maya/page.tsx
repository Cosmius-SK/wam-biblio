"use client";

import SettingsShell from "@/components/SettingsShell";
import MayaCard from "@/components/MayaCard";

export default function MayaSettingsPage() {
  return (
    <SettingsShell title="Maya" blurb="The quiet companion in your journal.">
      <MayaCard />
    </SettingsShell>
  );
}
