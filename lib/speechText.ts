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
 *
 * Timing alone is not enough, and a run of sixty unpunctuated words proved it:
 * a streaming engine sends interim text for the next phrase *before* it marks
 * the last one final, so the silence never appears in the event timing at all
 * and every gap measures as nothing. The engine's own capital letter is the
 * more reliable signal — see `opensSentence`.
 */
const CONTINUATION_MS = 400;

/** "I", and the contractions of it, keep their capital mid-sentence. */
const I_WORD = /^I(?:'|’)?(?:m|ll|ve|d)?\b/;

/**
 * Words no sentence ends on. If the engine closed a result after one of these
 * it was catching its breath, not finishing a thought, and a full stop there
 * is worse than none.
 */
const HANGING =
  /\b(and|or|but|so|the|a|an|to|of|in|on|at|for|with|that|is|was|are|were|be|been|my|your|his|her|its|our|their|this|these|those|if|as|by|from|into|about)$/i;

/**
 * Did the engine start a new sentence here?
 *
 * Every engine capitalises the first word of each result it closes, which is
 * it saying "this is where one thing ended and the next began" without saying
 * so. It is a far better signal than the clock, and it was being thrown away:
 * the capital was lowercased as a stray and the boundary went with it.
 */
function opensSentence(piece: string, wordsSoFar: number): boolean {
  if (!/^[A-Z]/.test(piece)) return false;
  const first = piece.split(/\s/, 1)[0];
  if (first.length > 1 && first === first.toUpperCase()) return false; // an acronym says nothing
  // "I" is capitalised wherever it stands, so on its own it proves nothing —
  // but it is also how most sentences in a journal begin. The tie-break is
  // length: three words in, the previous sentence is a sentence.
  if (I_WORD.test(piece)) return wordsSoFar >= 3;
  return true;
}
/** A silence this long is somebody starting a new thought, not a new sentence. */
const PARAGRAPH_MS = 2200;

/**
 * A question, conservatively.
 *
 * Only an auxiliary or modal followed by a subject — "can you hear me", "is it
 * working", "how do you do this". Deliberately misses "how things work", which
 * is a question but has no auxiliary to prove it, because the alternative rule
 * also turns "what I need is time" into a question. A missing question mark is
 * a small wrong; a confident one in the wrong place reads as a machine that
 * does not understand English.
 */
const WH = "how|what|when|where|why|who|which|whose";
const AUX =
  "can|could|do|does|did|is|are|am|was|were|will|would|shall|should|may|might|have|has|had|isn't|aren't|don't|doesn't|didn't|can't|couldn't|wouldn't|shouldn't|won't|haven't|hasn't";
const SUBJECT = "i|you|he|she|it|we|they|there|this|that|these|those|anyone|anybody|everyone";
/** Openers that carry no grammar — strip them before judging. */
const DISCOURSE = /^(?:so|and|but|well|ok|okay|now|then|right|actually|basically|hey)[,\s]+/i;
const QUESTION = new RegExp(`^(?:(?:${WH})\\s+)?(?:${AUX})\\s+(?:${SUBJECT})\\b`, "i");

function isQuestion(text: string): boolean {
  return QUESTION.test(text.replace(DISCOURSE, "").trim());
}

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

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
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
  /** How to close whatever is already in `out`. */
  let terminator = ".";
  /** Words in the sentence being built — a boundary needs a sentence behind it. */
  let words = 0;
  for (const u of utterances) {
    const marked = applySpokenMarks(u.text);
    if (!marked) continue;
    // A break they asked for out loud wins over anything inferred from timing.
    const asked = /^\n+/.exec(marked)?.[0] ?? "";
    const piece = marked.slice(asked.length);
    if (!piece) continue;
    if (asked && out) {
      out = out.replace(/[ \t]+$/, "") + asked + capitalise(piece);
      terminator = isQuestion(piece) ? "?" : ".";
      continue;
    }
    if (!out) {
      out = capitalise(piece);
    } else if (out.endsWith("\n")) {
      out += capitalise(piece);
    } else if (!endsOpen(out)) {
      // Already punctuated — by them, or by the engine.
      out += /[,;:]$/.test(out) ? ` ${continueCase(piece)}` : ` ${capitalise(piece)}`;
    } else if (!opensSentence(piece, words) && u.gapMs < CONTINUATION_MS) {
      out += ` ${continueCase(piece)}`;
      words += countWords(piece);
      // It ran on, so whatever it turns out to be is judged as one sentence.
      terminator = isQuestion(out.slice(out.lastIndexOf(". ") + 2)) ? "?" : terminator;
      continue;
    } else if (HANGING.test(out)) {
      // The engine closed a result on "and" or "the". Whatever it heard next
      // belongs to the same sentence, whatever the capital says.
      out += ` ${continueCase(piece)}`;
      words += countWords(piece);
      continue;
    } else if (u.gapMs >= PARAGRAPH_MS) {
      // A long silence is a new thought, and he wrote his own transcript with
      // exactly these breaks in it.
      out += `${terminator}\n\n${capitalise(piece)}`;
    } else {
      out += `${terminator} ${capitalise(piece)}`;
    }
    terminator = isQuestion(piece) ? "?" : ".";
    words = countWords(piece);
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
  if (!t || !endsOpen(t)) return t;
  const lastBreak = Math.max(t.lastIndexOf(". "), t.lastIndexOf("? "), t.lastIndexOf("\n"));
  const lastSentence = lastBreak >= 0 ? t.slice(lastBreak + 1) : t;
  return `${t}${isQuestion(lastSentence) ? "?" : "."}`;
}
