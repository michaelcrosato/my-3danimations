// The metrics' thresholds (PLAN.md WP-3.3), each with its unit, the sample rate it was set at, whether it scales with
// the body's hip height, and its reason: where in the migrated library's distribution it sits and how the planted
// defects (WP-3.6) and real capture compare. A threshold that scales is written for a 950 mm hip height (the reference
// rig) and multiplied by H0 / 950. `npm run qa -- --dist` prints the distributions they were read from.

/** A metric's warn and fail levels and what they mean. */
export interface Threshold {
  warn: number;
  fail: number;
  unit: string;
  /** Samples per second the value is measured at. */
  rate: number;
  /** Multiplied by H0 / 950: the value is a length on the body. */
  scales: boolean;
  reason: string;
}

/** The metrics, by name. */
export const METRICS = ["slide", "penetration", "bodyPenetration", "intersection", "jitter", "pop", "twistFlip", "jointLimit", "stretch", "seam", "seamVelocity", "fit", "nan", "events", "symmetry"] as const;
/** A metric's name. */
export type MetricName = (typeof METRICS)[number];

/** The hip height thresholds are written for (the reference rig's). */
export const REFERENCE_H0 = 950;

/** Every metric's threshold. */
export const THRESHOLDS: Record<MetricName, Threshold> = {
  slide: { warn: 180, fail: 450, unit: "mm per contact", rate: 60, scales: true, reason: "the contact point's path while planted, in the world: a clip's own travel, or in place a treadmill at its measured speed. Capture (CMU, STYLE100; 157 clips) reads 73 mm per contact at the median, 175 at p95, 445 at most, mostly its speed changing within a stride against the constant treadmill: warn at capture's p95, fail at its most. As skate, capture reads 9.5 cm/s at the median (Kimodo: 2.21 cm/s for capture with root motion, 3.87 generated)" },
  penetration: { warn: 50, fail: 120, unit: "mm under the floor", rate: 60, scales: true, reason: "a sole's lowest point under z = 0. Capture reads 14 mm at the median, 50 at p95, 119 at most (markers above the skin, a floor a little off): warn at capture's p95, fail at its most. Keyed sets reach 663 mm" },
  bodyPenetration: { warn: 25, fail: 60, unit: "mm under the floor", rate: 60, scales: true, reason: "a knee, hand, elbow, head or the pelvis under z = 0, outside the lying, sitting and acrobatic profiles, where touching the floor is the motion. Capture reads 0 but for one clip lying untagged" },
  intersection: { warn: 1, fail: 1.6, unit: "of the thinner part's width", rate: 60, scales: false, reason: "how deep a forearm or hand sits in the torso, or one shin or foot in the other, as the mannequin's capsules (thick: a hand on the belly reads a third): 1 is the thinner part's whole width inside. Capture reads 0.7 at p95 and 1.6 at p99, arms held tight to the body: warn at 1, fail at capture's p99" },
  jitter: { warn: 13, fail: 30, unit: "mm", rate: 60, scales: true, reason: "sustained shaking: the median over 0.15 s of a point's back-and-forth (the geometric mean of consecutive opposite accelerations), so a single reversal, a stop or a snap reads 0. Capture reads 1.9 mm at the median, 12.8 at p90 and 30 at p99, its tail the toes swinging where the data's foot heading flips (F2.4; a flip's swing is reported as the flip): warn at capture's p90, fail at its p99" },
  pop: { warn: 4100, fail: 6800, unit: "mm/s above the steps around it", rate: 60, scales: true, reason: "my-3d2dge's rule (its CHANGELOG 0.8.0): a point's step over four times the median speed of the steps around it (three either side left out), as its speed above theirs. A punch's steady sweep and a hard stop are not pops. Capture reads 0.76 m/s at the median, 4.1 at p95, 6.8 at most: warn at capture's p95, fail at its most. Keyed sets snap up to 83 m/s (a sword's hand crossing 1.4 m in two samples)" },
  twistFlip: { warn: 120, fail: 160, unit: "degrees between keys under 0.1 s apart", rate: 0, scales: false, reason: "a limb's twist, a hand's roll or a foot's heading jumping most of a half turn in one key interval: the encoder's reference flipping at a straight limb or a foot pointing down (F2.4). It turns the bone about its own axis, and swings the toes when the foot points down. Capture's median is 89°: the flips are common, so the levels are by meaning (two thirds of a turn and nearly a half), not by distribution" },
  jointLimit: { warn: 135, fail: 165, unit: "degrees", rate: 0, scales: false, reason: "a bent knee whose twist is past the level (it points backwards), or the head turned that far from the chest. Capture reads 24° at the median, 131 at p95, 164 at p99 (kicks and sits turn the thigh far): warn at capture's p95, fail at its p99" },
  stretch: { warn: 1, fail: 3, unit: "% of the rest length", rate: 60, scales: false, reason: "a limb segment's length against the rest's. The decoder keeps lengths (the library reads 0), so this reads baked or imported points" },
  seam: { warn: 25, fail: 60, unit: "mm", rate: 60, scales: true, reason: "a loop's jump from its last pose to its first, at any point. Capture's loops read 0 (cut on a matching frame); keyed sets 9.7 mm at p99 and one 125 mm" },
  seamVelocity: { warn: 2750, fail: 4000, unit: "mm/s", rate: 60, scales: true, reason: "a loop's change of velocity across its seam, at any point: a hitch even where the poses meet. Capture reads 0.98 m/s at the median, 2.75 at p95, 3.96 at most: warn at capture's p95, fail at its most" },
  fit: { warn: 30, fail: 40, unit: "mm mean from the source", rate: 0, scales: false, reason: "the import's recorded fit (quality.fit: mean, worst). Capture reads 12 mm at the median, 29 at p95; my-3d2dge's limits fail a clip at 40 mm mean or 300 mm worst" },
  nan: { warn: 1, fail: 1, unit: "values", rate: 0, scales: false, reason: "any non-number in a key or a decoded point" },
  events: { warn: 1, fail: 1, unit: "events", rate: 0, scales: false, reason: "events out of order, outside the clip, or with no name" },
  symmetry: { warn: 5, fail: 20, unit: "mm", rate: 60, scales: true, reason: "a clip against its mirrored pair, mirrored back: the codec mirrors within 0.5 mm, so more is the wrong side or a different motion" },
};

/** Tag profiles: the checks that don't apply to a kind of motion. */
export const PROFILES: Readonly<Record<string, { tags: readonly string[]; names?: RegExp; off: readonly MetricName[]; why: string }>> = {
  acrobatics: { tags: ["dodge", "climb", "getup"], names: /flip|cartwheel|roll|tumble|handstand/i, off: ["bodyPenetration", "intersection"], why: "rolls, flips and climbs put hands, knees and the back on the floor and curl the body" },
  lying: { tags: ["death", "lie", "crawl"], off: ["bodyPenetration", "slide", "intersection"], why: "the body lies on the floor; its feet aren't standing" },
  swimming: { tags: ["swim", "fly"], off: ["penetration", "bodyPenetration", "slide"], why: "no floor under the body" },
  sitting: { tags: ["sit", "vehicle"], off: ["bodyPenetration", "intersection"], why: "the pelvis and hands rest low, the thighs fold onto the belly" },
};
