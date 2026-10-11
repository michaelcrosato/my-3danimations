// The format-2 data types (spec/MOTION.md): a clip, its key poses and what it carries, a set manifest, and the table
// of key fields (names, lengths, component names, ranges) that the validator, the codec and the text lens share.

/** The format version this reader writes and knows. */
export const FORMAT = "2.0";
/** The legend version the keys follow. */
export const LEGEND_VERSION = "2.0";

/** A key pose: `t` plus named arrays of whole numbers (and `yaw`, one number). */
export interface Key {
  t: number;
  hips: number[];
  body: number[];
  chest: number[];
  head: number[];
  armL: number[];
  armR: number[];
  legL: number[];
  legR: number[];
  shL?: number[];
  shR?: number[];
  footL?: number[];
  footR?: number[];
  blade?: number[];
  root?: number[];
  handL?: number[];
  handR?: number[];
  fingersL?: number[];
  fingersR?: number[];
  spine?: number[];
  yaw?: number;
}

/** The ends a contact can plant. */
export const CONTACT_ENDS = ["footL", "footR", "handL", "handR"] as const;

/** Planted intervals per end, in seconds, and whether a tool detected them or a source labelled them. */
export interface Contacts {
  by: "detected" | "labelled";
  footL?: [number, number][];
  footR?: [number, number][];
  handL?: [number, number][];
  handR?: [number, number][];
}

/** A named moment in a clip, with its own data fields. */
export interface ClipEvent {
  t: number;
  name: string;
  [field: string]: unknown;
}

/** How a clip's motion was made. */
export const METHODS = ["captured", "keyed", "procedural", "composed", "edited", "generated"] as const;
/** IPTC digital source types (http://cv.iptc.org/newscodes/digitalsourcetype/), one per method. */
export const IPTC = { captured: "digitalCapture", keyed: "digitalCreation", procedural: "algorithmicMedia", composed: "composite", edited: "humanEdits", generated: "trainedAlgorithmicMedia" } as const;

/** Where a clip came from (spec/MOTION.md §7.4). */
export interface Provenance {
  src: string;
  orig?: string;
  take?: string;
  method: (typeof METHODS)[number];
  producer: { tool: string; version: string; model?: string };
  license: string;
  credit?: string;
  ai: (typeof IPTC)[keyof typeof IPTC];
}

/** QA verdicts. */
export const QA_VERDICTS = ["pass", "baselined", "fail", "unchecked"] as const;

/** How good a clip is: fit against its capture, and its QA verdict. */
export interface Quality {
  fit: [number, number];
  qa: (typeof QA_VERDICTS)[number];
  qaVersion: string;
  baseline?: string;
}

/** Review states. */
export const REVIEW_STATES = ["approved", "flagged", "unreviewed"] as const;

/** The owner's review of a clip's motion. */
export interface Review {
  state: (typeof REVIEW_STATES)[number];
  by: string;
  date: string;
  motion: string;
  note?: string;
}

/** A format-2 clip, one per file (spec/MOTION.md §4). */
export interface Clip {
  format: string;
  id: string;
  name: string;
  legend: string;
  dur: number;
  loop: boolean;
  fps: number;
  tags: string[];
  desc: string;
  skeleton: string;
  restSrc: string;
  requires?: string[];
  contacts?: Contacts;
  events?: ClipEvent[];
  facts?: Record<string, unknown>;
  provenance: Provenance;
  quality: Quality;
  review?: Review;
  keys: Key[];
}

/** The clip fields in the order writers emit them. */
export const CLIP_FIELDS = ["format", "id", "name", "legend", "dur", "loop", "fps", "tags", "desc", "skeleton", "restSrc", "requires", "contacts", "events", "facts", "provenance", "quality", "review", "keys"] as const;

/** Set tiers (D10). */
export const TIERS = ["cc0", "cc-by", "cmu", "local"] as const;

/** A set manifest, `_set.json` (spec/MOTION.md §9.1). */
export interface SetManifest {
  set: string;
  title: string;
  format: string;
  legend: { version: string; text: string[] };
  tier: (typeof TIERS)[number];
  content: { edition: string; importer: string; sha256: string };
  sources: Record<string, { label: string; origin: string; license: string; url: string; credit?: string; rest: Record<string, unknown>; [field: string]: unknown }>;
  credit: string;
  producer: { tool: string; version: string };
  body?: unknown;
}

/** A key field's shape: its component names, ranges, which components are angles, and whether every key has it. */
export interface KeyField {
  parts: readonly string[];
  required: boolean;
  /** [min, max] per component (angles get the angle bound). */
  ranges: readonly (readonly [number, number])[];
  /** Components that unwrap (validated within ±ANGLE_MAX, warned past ±ANGLE_WARN). */
  angles: readonly number[];
  /** True for limb directions: the first three components must not all be zero. */
  direction?: boolean;
  /** Present since this format version. */
  since: "1" | "2.0";
}

/** Stored angles are valid within this bound; they unwrap past ±180 (spec/MOTION.md §5.1). */
export const ANGLE_MAX = 3600;
/** The validator warns past this angle. */
export const ANGLE_WARN = 540;

const A = [-ANGLE_MAX, ANGLE_MAX] as const;
const P100 = [-100, 100] as const;
const limb = (): KeyField => ({ parts: ["forward", "out", "up", "bend", "twist"], required: true, ranges: [P100, P100, P100, [0, 180], A], angles: [4], direction: true, since: "1" });
const frame = (): KeyField => ({ parts: ["turn", "lean", "tilt"], required: true, ranges: [A, A, A], angles: [0, 1, 2], since: "1" });

/** Every key field but `t` and `yaw`, in the order the key lens writes them. */
export const KEY_FIELDS: Record<string, KeyField> = {
  hips: { parts: ["forward", "right", "up"], required: true, ranges: [[-1000, 1000], [-1000, 1000], [-100, 1000]], angles: [], since: "1" },
  body: frame(),
  chest: frame(),
  head: frame(),
  shL: { parts: ["reach", "shrug"], required: false, ranges: [[-180, 180], [-180, 180]], angles: [], since: "1" },
  shR: { parts: ["reach", "shrug"], required: false, ranges: [[-180, 180], [-180, 180]], angles: [], since: "1" },
  armL: limb(),
  armR: limb(),
  legL: limb(),
  legR: limb(),
  footL: { parts: ["down", "out", "toes"], required: false, ranges: [[-180, 180], A, [-180, 180]], angles: [1], since: "1" },
  footR: { parts: ["down", "out", "toes"], required: false, ranges: [[-180, 180], A, [-180, 180]], angles: [1], since: "1" },
  blade: { parts: ["forward", "right", "up"], required: false, ranges: [P100, P100, P100], angles: [], direction: true, since: "1" },
  root: { parts: ["forward", "right"], required: false, ranges: [[-1e7, 1e7], [-1e7, 1e7]], angles: [], since: "1" },
  handL: { parts: ["flex", "side", "roll"], required: false, ranges: [[-90, 90], [-45, 45], [-180, 180]], angles: [], since: "2.0" },
  handR: { parts: ["flex", "side", "roll"], required: false, ranges: [[-90, 90], [-45, 45], [-180, 180]], angles: [], since: "2.0" },
  fingersL: { parts: ["thumb", "index", "middle", "ring", "pinky"], required: false, ranges: Array(5).fill([0, 100]), angles: [], since: "2.0" },
  fingersR: { parts: ["thumb", "index", "middle", "ring", "pinky"], required: false, ranges: Array(5).fill([0, 100]), angles: [], since: "2.0" },
  spine: { parts: ["lower", "middle", "upper"], required: false, ranges: [[-100, 200], [-100, 200], [-100, 200]], angles: [], since: "2.0" },
};

/** Limits per clip (spec/MOTION.md §8). */
export const LIMITS = { keys: 4096, dur: 600, gap: 0.001, pastDur: 0.05, events: 64, contacts: 256 } as const;
