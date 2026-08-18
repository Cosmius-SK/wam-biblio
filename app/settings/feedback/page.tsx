import SettingsShell from "@/components/SettingsShell";
import TellMayaCard from "@/components/TellMayaCard";

export default function FeedbackSettingsPage() {
  return (
    <SettingsShell title="Tell Maya" blurb="The one place your words go to a person.">
      <TellMayaCard />
    </SettingsShell>
  );
}
