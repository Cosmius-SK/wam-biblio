/**
 * Turning what a speech engine hands back into something a person would write.
 *
 * A dictation engine gives you words and nothing else: no full stops, no
 * capitals except an arbitrary one at the start of each result, no sense of
 * where one sentence ended and the next began. Left alone it reads like this,
 * which is a real first attempt by a real person:
 *
 *   "Checking on voice typing can you hear me Okay So how things work while I
 *    type in voice awesome But there are no punctuation marks"
 *
 * Nobody forgives that twice. But the engine does know something it isn't
 * saying out loud: it closes a result when someone stops talking. Those
 * boundaries are sentence boundaries most of the time, and the silence before
 * each one says how confident to be about it. That is the whole trick here —
 * the punctuation is already in the timing, it just has to be written down.
 *
 * What this cannot do is fix a misheard word. "That is not going to hell" was
 * "help", and no amount of formatting recovers it — only something that
 * understands the sentence can, which is why the shaping pass is told the text
 * was dictated (see lib/ai/structurePrompt.ts).
 */

export interface Utterance {
  /** One final result — roughly, one thing said between two breaths. */
  text: string;
  /** Silence before it began, in ms. The engine's own sense of a pause. */
  gapMs: number;
}

/**
 * Below this, the engine closed a result mid-flow rather than at the end of a
 * thought — often several times a second on a desktop — and a full stop there
 * would chop a sentence into pieces.
 */
const CONTINUATION_MS = 400;

/**
 * Punctuation people actually say.
 *
 * Deliberately not "period": it is an ordinary English noun ("over that period
 * we grew"), and turning it into a full stop would quietly wreck sentences
 * about time. "Full stop" carries no such risk — and where it is said
 * idiomatically ("we're not doing it, full stop") a full stop is the right
 * reading anyway.
 */
const SPOKEN: [RegExp, string][] = [
  [/\bnew paragraph\b/gi, "\n\n"],
  [/\b(?:new ?line)\b/gi, "\n"],
  [/\bfull stop\b/gi, "."],
  [/\bquestion mark\b/gi, "?"],
  [/\bexclamation (?:mark|point)\b/gi, "!"],
  [/\bsemicolon\b/gi, ";"],
  [/\bcolon\b/gi, ":"],
  [/\bcomma\b/gi, ","],
];

/** "I", and the contractions of it, keep their capital mid-sentence. */
const I_WORD = /^I(?:'|’)?(?:m|ll|ve|d)?\b/;

export function applySpokenMarks(text: string): string {
  let out = text;
  for (const [pattern, mark] of SPOKEN) out = out.replace(pattern, mark);
  return (
    out
      .replace(/[ \t]+([.,!?;:])/g, "$1") // the space before a spoken mark
      .replace(/([.,!?;:])(?=[^\s\d])/g, "$1 ") // and the missing one after it
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      // Spaces only: a "new paragraph" said at the start of an utterance is a
      // leading newline, and trimming it away threw the break out with it.
      .replace(/^[ \t]+|[ \t]+$/g, "")
  );
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * The engine capitalises the first word of every result, so a sentence that
 * merely continues arrives with a capital in the middle of it — half of what
 * made that first transcript look broken. Lowercasing it is right almost
 * always; the exceptions are "I" and an acronym said as letters.
 */
function continueCase(s: string): string {
  if (!s) return s;
  if (I_WORD.test(s)) return s;
  const first = s.split(/\s/, 1)[0];
  if (first.length > 1 && first === first.toUpperCase()) return s; // NASA, EOD
  return s[0].toLowerCase() + s.slice(1);
}

function endsOpen(s: string): boolean {
  return !/[.!?,;:\n]$/.test(s);
}

/**
 * Assemble the utterances so far, plus whatever is being said right now.
 *
 * The live tail is deliberately joined loosely — it is still changing, and a
 * full stop that appears and then moves as someone keeps talking is worse than
 * no full stop at all.
 */
export function composeSpeech(utterances: Utterance[], interim = ""): string {
  let out = "";
  for (const u of utterances) {
    const marked = applySpokenMarks(u.text);
    if (!marked) continue;
    // A break they asked for out loud wins over anything inferred from timing.
    const asked = /^\n+/.exec(marked)?.[0] ?? "";
    const piece = marked.slice(asked.length);
    if (!piece) continue;
    if (asked && out) {
      out = out.replace(/[ \t]+$/, "") + asked + capitalise(piece);
      continue;
    }
    if (!out) {
      out = capitalise(piece);
    } else if (out.endsWith("\n")) {
      out += capitalise(piece);
    } else if (!endsOpen(out)) {
      // Already punctuated — by them, or by the engine.
      out += /[,;:]$/.test(out) ? ` ${continueCase(piece)}` : ` ${capitalise(piece)}`;
    } else if (u.gapMs < CONTINUATION_MS) {
      out += ` ${continueCase(piece)}`;
    } else {
      out += `. ${capitalise(piece)}`;
    }
  }

  const tail = applySpokenMarks(interim);
  if (tail) {
    if (!out) out = capitalise(tail);
    else if (out.endsWith("\n")) out += capitalise(tail);
    else out += endsOpen(out) ? ` ${continueCase(tail)}` : ` ${capitalise(tail)}`;
  }
  return out;
}

/** Close the last sentence, once they have actually stopped talking. */
export function finishSpeech(text: string): string {
  const t = text.trim();
  return !t || !endsOpen(t) ? t : `${t}.`;
}
