import CaptureComposer from "@/components/CaptureComposer";
import PageBar from "@/components/PageBar";

export default function CapturePage() {
  // Writing stays a single, calm column however wide the window is.
  return (
    <div className="mx-auto max-w-2xl">
      <PageBar />
      <CaptureComposer />
    </div>
  );
}
