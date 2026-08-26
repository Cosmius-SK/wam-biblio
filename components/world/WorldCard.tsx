"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FACE, describeFace, type Face } from "@/lib/world/face";
import { describeMember, newMember, type WorldKind, type WorldMember } from "@/lib/world/types";
import { deleteMember, listWorld, saveMember } from "@/lib/world/store";
import FaceBuilder from "./FaceBuilder";
import FacePortrait from "./FacePortrait";
import Framed from "./Framed";

/**
 * Settings › Your world.
 *
 * The deliberate door. Most of the cast should arrive the other way — offered
 * after an illustration, when the generic result has just explained the offer
 * better than any copy could — but somebody who would rather sit down and do
 * it properly should be able to, and somebody who wants to see exactly what
 * biblio holds about their family needs one page that shows all of it.
 */
const KINDS: { kind: WorldKind; title: string; blurb: string; add: string }[] = [
  {
    kind: "person",
    title: "People",
    blurb: "Choose a face once and they look the same in every picture.",
    add: "Add someone",
  },
  {
    kind: "place",
    title: "Places",
    blurb:
      "A few words are enough — nobody minds that the cinema isn't precisely their cinema.",
    add: "Add a place",
  },
  {
    kind: "thing",
    title: "Things",
    blurb: "A detail or two. “A pale green scooter” is the whole entry.",
    add: "Add a thing",
  },
];

export default function WorldCard() {
  const [members, setMembers] = useState<WorldMember[]>([]);
  const [editing, setEditing] = useState<WorldMember | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      setMembers(await listWorld());
      setLoaded(true);
    })();
  }, []);

  async function reload() {
    setMembers(await listWorld());
  }

  function begin(kind: WorldKind) {
    const draft = newMember(kind);
    if (kind === "person") draft.face = { ...DEFAULT_FACE };
    setEditing(draft);
  }

  if (editing) {
    return (
      <Editor
        member={editing}
        existing={members.some((m) => m.id === editing.id)}
        onDone={async () => {
          setEditing(null);
          await reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {KINDS.map(({ kind, title, blurb, add }) => {
        const mine = members.filter((m) => m.kind === kind);
        return (
          <section key={kind} className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
            <h2 className="font-serif text-lg text-ink">{title}</h2>
            <p className="mt-1 text-sm text-muted">{blurb}</p>

            {kind === "person" ? (
              <div className="mt-4 flex flex-wrap gap-4">
                {mine.map((m) => (
                  <Framed
                    key={m.id}
                    size={104}
                    caption={m.name}
                    onClick={() => setEditing(m)}
                  >
                    {m.face ? (
                      <FacePortrait face={m.face} size={104} />
                    ) : (
                      <span className="block h-full w-full bg-paper" />
                    )}
                  </Framed>
                ))}
              </div>
            ) : (
              mine.length > 0 && (
                <ul className="mt-4 overflow-hidden rounded-xl border border-hairline/60">
                  {mine.map((m, i) => (
                    <li key={m.id} className={i > 0 ? "border-t border-hairline/50" : ""}>
                      <button
                        type="button"
                        onClick={() => setEditing(m)}
                        className="block w-full bg-paper/40 px-4 py-3 text-left transition-colors hover:bg-paper/70"
                      >
                        <span className="block text-sm text-ink">{m.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {m.note || "No description yet"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            <button
              type="button"
              onClick={() => begin(kind)}
              className="mt-4 rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-lavender/40"
            >
              {add}
            </button>
          </section>
        );
      })}

      {loaded && members.length === 0 && (
        <p className="px-1 text-sm text-muted">
          Nothing here yet — and nothing needs to be. After biblio draws a picture it will
          ask whether the people in it should keep their faces, which is the moment any of
          this makes sense.
        </p>
      )}
    </div>
  );
}

function Editor({
  member,
  existing,
  onDone,
}: {
  member: WorldMember;
  /** Already kept, so "forget them" means something. */
  existing: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [aka, setAka] = useState((member.aka ?? []).join(", "));
  const [note, setNote] = useState(member.note ?? "");
  const [face, setFace] = useState<Face>(member.face ?? { ...DEFAULT_FACE });
  const person = member.kind === "person";

  async function save() {
    await saveMember({
      ...member,
      name: name.trim(),
      aka: aka
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      note: note.trim() || undefined,
      face: person ? face : undefined,
    });
    onDone();
  }

  async function remove() {
    await deleteMember(member.id);
    onDone();
  }

  const preview = person
    ? describeFace(face)
    : describeMember({ ...member, note: note.trim() || undefined });

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <label className="block text-xs uppercase tracking-wide text-muted/70" htmlFor="w-name">
        {person ? "What you call them" : "What you call it"}
      </label>
      <input
        id="w-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={person ? "Theva" : "The Saturday cinema"}
        className="mt-1.5 w-full rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-ink placeholder:text-muted/50 focus:border-lavender/60 focus:outline-none"
      />
      <p className="mt-1.5 text-2xs text-muted/70">
        This is how biblio recognises them in what you write. It never leaves this device.
      </p>

      <label className="mt-4 block text-xs uppercase tracking-wide text-muted/70" htmlFor="w-aka">
        Also called
      </label>
      <input
        id="w-aka"
        value={aka}
        onChange={(e) => setAka(e.target.value)}
        placeholder={person ? "Dad, Appa" : "the multiplex"}
        className="mt-1.5 w-full rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-ink placeholder:text-muted/50 focus:border-lavender/60 focus:outline-none"
      />

      {person ? (
        <div className="mt-6">
          <FaceBuilder face={face} onChange={setFace} />
        </div>
      ) : null}

      <label className="mt-5 block text-xs uppercase tracking-wide text-muted/70" htmlFor="w-note">
        {person ? "Anything the choices missed" : "What it looks like"}
      </label>
      <textarea
        id="w-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={person ? 2 : 3}
        placeholder={
          person
            ? "always in a cricket shirt"
            : "a multiplex lobby, neon strips, dark patterned carpet"
        }
        className="mt-1.5 w-full resize-none rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-sm text-ink placeholder:text-muted/50 focus:border-lavender/60 focus:outline-none"
      />
      {!person && (
        <p className="mt-1.5 text-2xs text-muted/70">
          Words, not a photograph — and this is the whole of what a picture is told:{" "}
          <span className="text-muted">{preview || "nothing yet"}</span>
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!name.trim()}
          className="rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform active:scale-95 disabled:opacity-40"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => void remove()}
            className="ml-auto text-sm text-terracotta/90 transition-colors hover:text-terracotta"
          >
            {member.kind === "person" ? "Forget them" : "Forget it"}
          </button>
        )}
      </div>
    </div>
  );
}
