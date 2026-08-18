import SettingsShell from "@/components/SettingsShell";
import DevicesCard from "@/components/DevicesCard";

export default function DevicesSettingsPage() {
  return (
    <SettingsShell title="Devices" blurb="What holds a copy of your journal.">
      <DevicesCard />
    </SettingsShell>
  );
}
