import ReflectCard from "@/components/ReflectCard";
import AskView from "@/components/AskView";

/** Ask: the reflection ("Where you are") leads, then questions to your journal. */
export default function AskPage() {
  return (
    <div>
      <div className="mt-4">
        <ReflectCard />
      </div>
      <div className="my-8 border-t border-hairline/60" />
      <AskView />
    </div>
  );
}
