"use client";

/**
 * The recovery phrase.
 *
 * Six short words rather than twenty characters of hex, because the only time
 * anyone types this is the day something has gone wrong — and words survive
 * being written on paper, read down a phone line, and copied by hand without
 * anyone arguing about whether that was a zero or an O.
 *
 * The phrase is used as a passphrase *string*, never decoded back to bits, so
 * this list can grow or change later without invalidating a single existing
 * phrase.
 */
const WORDS = [
  "amber", "anchor", "apple", "arch", "atlas", "autumn", "bamboo", "barley",
  "basil", "beacon", "bell", "birch", "bison", "blossom", "bramble", "branch",
  "breeze", "bridge", "bright", "brook", "bundle", "burrow", "cabin", "cactus",
  "camber", "candle", "canvas", "canyon", "carbon", "cedar", "chalk", "charm",
  "cherry", "chime", "cinder", "circle", "citrus", "clay", "clever", "cliff",
  "clover", "cobble", "cocoa", "comet", "compass", "copper", "coral", "cotton",
  "crane", "crater", "cricket", "crystal", "cypress", "dahlia", "daisy", "dapple",
  "dawn", "delta", "denim", "dew", "dial", "domino", "dove", "dune",
  "dusk", "eagle", "ember", "emerald", "falcon", "fable", "feather", "fennel",
  "fern", "fiddle", "finch", "flint", "flora", "flute", "forest", "fossil",
  "fountain", "foxglove", "garden", "garnet", "gentle", "ginger", "glacier", "glass",
  "granite", "grove", "gully", "harbor", "harvest", "hazel", "heather", "hedge",
  "heron", "hickory", "hollow", "honey", "horizon", "ivory", "jasmine", "jetty",
  "juniper", "kestrel", "kettle", "lantern", "lattice", "laurel", "lavender", "ledger",
  "lemon", "lichen", "lilac", "linen", "lively", "lotus", "lumber", "lyric",
  "magnet", "mallow", "mangrove", "maple", "marble", "marigold", "meadow", "medlar",
  "mellow", "mercury", "mica", "mint", "mirror", "mist", "morning", "mosaic",
  "moss", "mulberry", "nectar", "needle", "nestle", "nickel", "noble", "north",
  "nutmeg", "oak", "oasis", "ochre", "olive", "onyx", "opal", "orbit",
  "orchard", "osprey", "otter", "paddle", "pallet", "pampas", "papyrus", "parcel",
  "parsley", "pasture", "pebble", "pelican", "pepper", "petal", "pewter", "pigeon",
  "pillar", "pine", "pippin", "plover", "plum", "pollen", "pond", "poplar",
  "poppy", "prairie", "puffin", "quarry", "quartz", "quill", "quince", "rabbit",
  "radish", "rafter", "rapids", "raven", "reed", "ribbon", "ridge", "rill",
  "river", "robin", "rosemary", "rowan", "rudder", "russet", "saffron", "sage",
  "salmon", "sandal", "sapling", "satin", "scarlet", "seagull", "sepia", "shale",
  "shallow", "shore", "signal", "silver", "sixty", "slate", "smoke", "snapdragon",
  "sorrel", "sparrow", "spindle", "spruce", "squall", "stable", "starling", "steady",
  "stellar", "stone", "stork", "summer", "sunset", "swallow", "sycamore", "tamarind",
  "tandem", "tangle", "teal", "tempo", "thistle", "thorn", "thunder", "timber",
  "tinder", "topaz", "torrent", "trellis", "trumpet", "tulip", "tundra", "turtle",
  "twilight", "umber", "valley", "velvet", "vertex", "violet", "walnut", "warbler",
  "wattle", "weaver", "whisper", "willow", "window", "winter", "wisteria", "yarrow",
];

/** How many words. Six from this list, stretched by PBKDF2, is plenty when the
 * ciphertext itself is only reachable from inside the owner's Google account. */
const LENGTH = 6;

export function generateRecoveryPhrase(): string {
  const picks = new Uint32Array(LENGTH);
  crypto.getRandomValues(picks);
  return Array.from(picks, (n) => WORDS[n % WORDS.length]).join(" ");
}

/** Forgive stray spaces, capitals and line breaks — it was written by hand. */
export function normalizePhrase(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export function looksLikePhrase(input: string): boolean {
  return normalizePhrase(input).split(" ").length >= LENGTH;
}
