"use client";

import SettingsShell from "@/components/SettingsShell";
import GoogleAccount from "@/components/GoogleAccount";

export default function AccountSettingsPage() {
  return (
    <SettingsShell
      title="Account & sync"
      blurb="Sign in once — your journal follows you across devices, encrypted."
    >
      <GoogleAccount />
    </SettingsShell>
  );
}
