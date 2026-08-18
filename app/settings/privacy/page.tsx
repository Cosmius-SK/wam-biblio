import SettingsShell from "@/components/SettingsShell";
import PrivacyCard from "@/components/PrivacyCard";

export default function PrivacySettingsPage() {
  return (
    <SettingsShell title="Privacy" blurb="Exactly what is known about you, and what isn't.">
      <PrivacyCard />
    </SettingsShell>
  );
}
