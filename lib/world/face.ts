/**
 * The vocabulary of a face.
 *
 * Not a picture editor — a structured description editor. Choosing "full
 * beard, glasses, mid-thirties" produces exactly the words an image prompt
 * needs, without anyone having to describe their own face in adjectives. The
 * person experiences picking a face; the image model receives a description.
 *
 * So every option carries two things: a `label`, which is what a human picks,
 * and a `phrase`, which is what leaves for the picture. Colours carry a third,
 * `hex`, which is only ever used to draw the portrait here on the device.
 *
 * See docs/your-world.md for why this exists at all, and why correcting a
 * generated image can never do the same job.
 */

export interface Face {
  /** The word for them: shifts to girl/boy/child at the younger ages. */
  presents: string;
  age: string;
  skin: string;
  hair: string;
  hairColour: string;
  facialHair: string;
  glasses: string;
  build: string;
}

export interface Choice {
  key: string;
  label: string;
  /** What this becomes in a prompt. Empty means it adds nothing. */
  phrase?: string;
  /** For the portrait only. Never sent anywhere. */
  hex?: string;
  /** A second, darker tone for the shaded side of a shape. */
  shade?: string;
}

export const PRESENTS: Choice[] = [
  { key: "woman", label: "Woman" },
  { key: "man", label: "Man" },
  { key: "person", label: "Person" },
];

/** Rough bands. Precision here would be false — nobody's face is 34. */
export const AGES: Choice[] = [
  { key: "small", label: "Small child", phrase: "of about four" },
  { key: "child", label: "Child", phrase: "of about seven" },
  { key: "older", label: "Older child", phrase: "of about eleven" },
  { key: "teen", label: "Teenager", phrase: "in their teens" },
  { key: "20s", label: "Twenties", phrase: "in their twenties" },
  { key: "30s", label: "Thirties", phrase: "in their thirties" },
  { key: "40s", label: "Forties", phrase: "in their forties" },
  { key: "50s", label: "Fifties", phrase: "in their fifties" },
  { key: "60s", label: "Sixties", phrase: "in their sixties" },
  { key: "older-adult", label: "Older", phrase: "in their seventies" },
];

/** Which ages take a child's noun rather than an adult's. */
const CHILD_AGES = new Set(["small", "child", "older"]);
/** Nor an adult's — a teenager is neither, and "a man in his teens" is a
 * sentence nobody would write about a fifteen-year-old. */
const TEEN_NOUNS: Record<string, string> = {
  woman: "teenage girl",
  man: "teenage boy",
  person: "teenager",
};

export const SKINS: Choice[] = [
  { key: "porcelain", label: "Porcelain", phrase: "very fair skin", hex: "#F4DCCB", shade: "#E4C3AC" },
  { key: "fair", label: "Fair", phrase: "fair skin", hex: "#EAC5A8", shade: "#D6A987" },
  { key: "olive", label: "Olive", phrase: "olive skin", hex: "#D8AC80", shade: "#C08F63" },
  { key: "tan", label: "Tan", phrase: "tan skin", hex: "#C08A5E", shade: "#A46F47" },
  { key: "brown", label: "Brown", phrase: "brown skin", hex: "#96603C", shade: "#7C4C2D" },
  { key: "deep", label: "Deep", phrase: "deep brown skin", hex: "#6B4226", shade: "#55321B" },
];

/**
 * Adjectives, not phrases — they are composed as "<length> <colour> hair".
 *
 * These used to read "long hair", which composed to "blond long hair". English
 * puts length before colour, and a prompt written in the wrong order is a
 * prompt the model has to work to understand.
 */
export const HAIR: Choice[] = [
  { key: "bald", label: "None", phrase: "" }, // handled on its own: "bald"
  { key: "shaved", label: "Shaved", phrase: "closely shaved" },
  { key: "short", label: "Short", phrase: "short" },
  { key: "curls", label: "Curls", phrase: "short curly" },
  { key: "wavy", label: "Wavy", phrase: "wavy shoulder-length" },
  { key: "long", label: "Long", phrase: "long" },
  { key: "tied", label: "Tied back", phrase: "tied-back" },
];

export const HAIR_COLOURS: Choice[] = [
  { key: "black", label: "Black", phrase: "black", hex: "#2B2724", shade: "#1C1917" },
  { key: "darkbrown", label: "Dark brown", phrase: "dark brown", hex: "#4A3327", shade: "#37241B" },
  { key: "brown", label: "Brown", phrase: "brown", hex: "#77503A", shade: "#5D3D2C" },
  { key: "auburn", label: "Auburn", phrase: "auburn", hex: "#8E4B34", shade: "#703826" },
  { key: "blond", label: "Blond", phrase: "blond", hex: "#C9A063", shade: "#AE8749" },
  { key: "grey", label: "Grey", phrase: "grey", hex: "#9C9691", shade: "#837D78" },
  { key: "white", label: "White", phrase: "white", hex: "#E2DDD6", shade: "#C7C1B9" },
];

export const FACIAL_HAIR: Choice[] = [
  { key: "none", label: "Clean", phrase: "" },
  { key: "stubble", label: "Stubble", phrase: "stubble" },
  { key: "moustache", label: "Moustache", phrase: "a moustache" },
  { key: "short", label: "Short beard", phrase: "a short beard" },
  { key: "full", label: "Full beard", phrase: "a full beard" },
];

export const GLASSES: Choice[] = [
  { key: "none", label: "None", phrase: "" },
  { key: "round", label: "Round", phrase: "round glasses" },
  { key: "rect", label: "Rectangular", phrase: "rectangular glasses" },
  { key: "wire", label: "Thin wire", phrase: "thin wire glasses" },
];

export const BUILDS: Choice[] = [
  { key: "slight", label: "Slight", phrase: "slight build" },
  { key: "medium", label: "Medium", phrase: "medium build" },
  { key: "sturdy", label: "Sturdy", phrase: "sturdy build" },
];

export const DEFAULT_FACE: Face = {
  presents: "person",
  age: "30s",
  skin: "olive",
  hair: "short",
  hairColour: "black",
  facialHair: "none",
  glasses: "none",
  build: "medium",
};

export function pick(list: Choice[], key: string): Choice {
  return list.find((c) => c.key === key) ?? list[0];
}

export function isChild(face: Face): boolean {
  return CHILD_AGES.has(face.age);
}

/** The word for them at this age — "a boy of about seven", not "a man". */
export function noun(face: Face): string {
  if (face.age === "teen") return TEEN_NOUNS[face.presents] ?? "teenager";
  if (!isChild(face)) return face.presents;
  if (face.presents === "woman") return "girl";
  if (face.presents === "man") return "boy";
  return "child";
}

/**
 * The whole point of the exercise: the sentence that goes into a picture.
 *
 * Names never appear here. "Theva" becomes "a man in his thirties with olive
 * skin and a full beard" — recognisable in every illustration, and identifying
 * nobody to anyone who wasn't already at the table.
 */
export function describeFace(face: Face): string {
  const who = noun(face);
  // "a teenage boy in his teens" says it twice; the noun has already said it.
  const age = face.age === "teen" ? "" : pick(AGES, face.age).phrase ?? "";
  // "in their thirties" reads badly attached to someone we have a word for.
  const possessive = face.presents === "woman" ? "her" : face.presents === "man" ? "his" : "their";
  const ageClause = age.replace("their", possessive);

  const details: string[] = [];
  const build = pick(BUILDS, face.build).phrase;
  const skin = pick(SKINS, face.skin).phrase;
  const length = pick(HAIR, face.hair).phrase;
  const colour = pick(HAIR_COLOURS, face.hairColour).phrase;
  const beard = isChild(face) ? "" : pick(FACIAL_HAIR, face.facialHair).phrase;
  const glasses = pick(GLASSES, face.glasses).phrase;

  if (build) details.push(build);
  if (skin) details.push(skin);
  // Bald says itself. Everything else is length before colour, as English has
  // it: "long blond hair", never "blond long hair".
  details.push(face.hair === "bald" ? "bald" : `${length} ${colour} hair`);
  if (beard) details.push(beard);
  if (glasses) details.push(glasses);

  return `a ${who}${ageClause ? ` ${ageClause}` : ""}, ${details.join(", ")}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A face at random — the shuffle button.
 *
 * Getting near by luck and then adjusting is far quicker than working down a
 * list of eight questions, and it is the difference between this feeling like
 * play and feeling like a form. A form nobody fills in takes the whole feature
 * with it.
 */
export function randomFace(): Face {
  const any = (list: Choice[]) => list[Math.floor(Math.random() * list.length)].key;
  const face: Face = {
    presents: any(PRESENTS),
    age: any(AGES),
    skin: any(SKINS),
    hair: any(HAIR),
    hairColour: any(HAIR_COLOURS),
    facialHair: any(FACIAL_HAIR),
    glasses: any(GLASSES),
    build: any(BUILDS),
  };
  if (isChild(face)) face.facialHair = "none";
  return face;
}
