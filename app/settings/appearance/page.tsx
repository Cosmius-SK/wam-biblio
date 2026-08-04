"use client";

import SettingsShell from "@/components/SettingsShell";
import ThemeCard from "@/components/ThemeCard";
import BackgroundCard from "@/components/BackgroundCard";
import AmbientCard from "@/components/AmbientCard";

export default function AppearanceSettingsPage() {
  return (
    <SettingsShell title="Appearance & sound" blurb="The mood of the room.">
      <ThemeCard />
      <div className="mt-4">
        <BackgroundCard />
      </div>
      <AmbientCard />
    </SettingsShell>
  );
}
