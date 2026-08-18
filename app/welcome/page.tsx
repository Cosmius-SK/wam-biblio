import Link from "next/link";
import GoogleDoor from "@/components/GoogleDoor";

export const metadata = { title: "biblio — welcome" };

/**
 * The only page that does not need a way in. Three lines about what this is,
 * and one door.
 */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-20">
      <h1 className="font-serif text-4xl text-ink">biblio</h1>
      <p className="mt-3 font-serif text-lg leading-relaxed text-ink/80">
        A quiet place to write things down.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Say or type whatever is on your mind, however it comes out. biblio shapes it into
        something you&rsquo;ll want to read again, and keeps it where only you can open it —
        encrypted before it ever leaves your device.
      </p>

      <div className="mt-8">
        <GoogleDoor />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted/80">
        Signing in tells biblio which journal is yours and where to keep your key. It never
        reads your Google account for anything else.
      </p>

      <p className="mt-10 text-xs text-muted/70">
        Have a passcode instead?{" "}
        <Link href="/unlock" className="text-lavender underline-offset-2 hover:underline">
          Unlock with it
        </Link>
        .
      </p>
    </main>
  );
}
