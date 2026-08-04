import CaptureComposer from "@/components/CaptureComposer";

export default function CapturePage() {
  // Writing stays a single, calm column however wide the window is.
  return (
    <div className="mx-auto max-w-2xl">
      <CaptureComposer />
    </div>
  );
}
