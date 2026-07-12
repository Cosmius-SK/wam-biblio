"use client";

import SettingsShell from "@/components/SettingsShell";
import ProfileCard from "@/components/ProfileCard";

export default function ProfileSettingsPage() {
  return (
    <SettingsShell title="Profile" blurb="Your name, portrait, and timelapse.">
      <ProfileCard />
    </SettingsShell>
  );
}
