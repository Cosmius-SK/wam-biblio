"use client";

import SettingsShell from "@/components/SettingsShell";
import BackgroundCard from "@/components/BackgroundCard";
import AmbientCard from "@/components/AmbientCard";

export default function AppearanceSettingsPage() {
  return (
    <SettingsShell title="Appearance & sound" blurb="The mood of the room.">
      <BackgroundCard />
      <AmbientCard />
    </SettingsShell>
  );
}
