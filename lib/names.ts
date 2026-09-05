/**
 * Putting back the names a dictation engine has never heard of.
 *
 * Every device's dictation is a language model with a vocabulary, and yours is
 * not in it. Asked for "biblio" it returns "Bibio"; asked for a child's name it
 * returns the nearest word it does know — and it returns it *capitalised*,
 * because it can tell a name was meant even when it cannot tell which one.
 *
 * That capital is the whole safety mechanism here. It is what lets biblio
 * correct "Bibio" while leaving "the bibliography was long" alone.
 */

/** Levenshtein, small and unclever — the words are short and there are few. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Put back the names biblio already knows.
 *
 * A recogniser has never heard of Theva, or of biblio, so it returns the
 * nearest thing in its own vocabulary and it returns it *capitalised*, because
 * it can tell a name is meant even when it cannot tell which one. That capital
 * is the guard that makes this safe: an ordinary lowercase word is never
 * touched, so "the bibliography was long" survives while "Bibio" does not.
 *
 * The names come from Your world — the people, places and things already
 * written down on this device. Which is the honest answer to "how do I stop it
 * misspelling my son's name": biblio is not guessing at a dictionary, it is
 * using the list you built.
 *
 * A match must be close and it must be the only one. Two candidates at the
 * same distance means we do not know which was meant, and a confident wrong
 * name is far worse than a misspelt one.
 */
export function fixNames(text: string, names: string[]): string {
  const known = names.map((n) => n.trim()).filter((n) => n.length >= 4);
  if (known.length === 0) return text;
  const lower = new Set(known.map((n) => n.toLowerCase()));

  return text.replace(/\b[A-Za-z][a-z]{3,}\b/g, (word) => {
    const w = word.toLowerCase();
    if (lower.has(w)) return word; // already right
    if (!/^[A-Z]/.test(word)) return word; // only an attempt at a name
    let best: string | null = null;
    let bestAt = 99;
    let ties = 0;
    for (const name of known) {
      const d = distance(w, name.toLowerCase());
      const allowed = name.length >= 6 ? 2 : 1;
      if (d > allowed) continue;
      if (d < bestAt) {
        best = name;
        bestAt = d;
        ties = 1;
      } else if (d === bestAt) ties++;
    }
    if (!best || ties > 1) return word;
    // As it is written in the list, capital or not — "biblio" is lowercase
    // wherever it stands, and a person's name is theirs to capitalise.
    return best;
  });
}
