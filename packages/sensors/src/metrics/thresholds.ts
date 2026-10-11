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
export const METRICS = ["slide", "skate", "penetration", "bodyPenetration", "intersection", "jitter", "pop", "twistFlip", "jointLimit", "stretch", "seam", "seamVelocity", "fit", "nan", "events", "symmetry"] as const;
/** A metric's name. */
export type MetricName = (typeof METRICS)[number];

/** The hip height thresholds are written for (the reference rig's). */
export const REFERENCE_H0 = 950;

/** Every metric's threshold. */
export const THRESHOLDS: Record<MetricName, Threshold> = {
  slide: { warn: 150, fail: 230, unit: "mm per contact", rate: 60, scales: true, reason: "the farthest a contact's drift takes the foot from where it landed, in the world: the drift is summed step by step at the lowest sole point (the heel at strike, the ball at push-off), so a heel-to-toe roll drifts nothing and capture's marker noise cancels (a path length would add it up: 6 s of standing read 400 mm). The world is a clip's own travel, or for an in-place loop that steps a treadmill at its measured speed. A contact is where the foot stands, measured (motion.ts STANCE: within 4% of H0 of the floor, slower than half an H0 a second or carried along with the pelvis), so a foot is measured however it slides. Capture (CMU, STYLE100; 157 clips) reads 52 mm at the median, 145 at p95, 229 at most (Roundhouse_Kick's pivots; in-place walks against a constant treadmill while their stride's speed varies): warn at capture's p95, fail at its most" },
  skate: { warn: 18, fail: 38, unit: "cm/s over a contact", rate: 60, scales: true, reason: "a contact's slide over its time, for contacts of at least 0.25 s, so a slow glide over a long contact (170 mm in half a second) shows though it stays under the slide's mm. Capture reads 5.7 cm/s at the median, 18 at p95, 38 at most: warn at capture's p95, fail at its most. Over all contact time (the report's skateMean) capture reads 4.7 cm/s at the median; Kimodo's paper reports 2.21 cm/s of foot skate for capture with root motion and 3.87 for generated motion, measured its own way" },
  penetration: { warn: 50, fail: 120, unit: "mm under the floor", rate: 60, scales: true, reason: "a sole's lowest point under z = 0: the heel (the standing rest's sole under the ankle, turned with the foot, so a foot lying toes up has its heel behind the ankle, not under it), the ball and the toe; the finding names the foot. Capture reads 14 mm at the median, 48 at p95, 119 at most (markers above the skin, a floor a little off): warn at capture's p95, fail at its most. Keyed sets reach 660 mm" },
  bodyPenetration: { warn: 25, fail: 60, unit: "mm under the floor", rate: 60, scales: true, reason: "a knee, hand, elbow, head or the pelvis under z = 0, outside the lying, sitting and acrobatic profiles, where touching the floor is the motion. Capture reads 0 but for one clip lying untagged" },
  intersection: { warn: 1, fail: 1.6, unit: "of the thinner part's width", rate: 60, scales: false, reason: "how deep a forearm or hand sits in the torso, or one shin or foot in the other, as the mannequin's capsules (thick: a hand on the belly reads a third): 1 is the thinner part's whole width inside. Capture reads 0.7 at p95 and 1.6 at p99, arms held tight to the body: warn at 1, fail at capture's p99" },
  jitter: { warn: 26, fail: 90, unit: "mm", rate: 0, scales: true, reason: "sustained shaking on the key grid (a clip's keys; captured points' samples): the median over 5 keys of a point's back-and-forth, the smaller of consecutive second differences of opposite sign (at the keys' spacing, or as if 1/30 s apart where keys lie further apart), so a single reversal, a stop, a snap or a key out of place reads 0. A shake of ±a mm from key to key reads about 4a. Capture reads 5.5 mm at the median, 26 at p90, 90 at p99 (elbows, knees and toes swinging where the encoding's twist turns noisy near a straight limb, F2.4): warn at capture's p90, fail at its p99, where keys alternating ±5° at the wrist (the fist swinging 60 mm a key) read 119" },
  pop: { warn: 2100, fail: 3600, unit: "mm/s above the larger step beside it", rate: 0, scales: true, reason: "my-3d2dge's rule (ed-sheet.mjs:125) on the key grid: a point's step between keys over 2.5 times the larger of the steps either side (or, for a key out of place, the pair out and back against the steps either side of the pair), as its speed above that step. A smooth fast motion is not a pop however fast: a punch's steps grow and shrink from key to key (a minimum-jerk jab in 0.12 s reads 0). Capture reads 0.63 m/s at the median, 2.1 at p95, 3.6 at most: warn at capture's p95, fail at its most. Keyed sets jump up to 37 m/s (Sword_Regular_B's index point between two keys)" },
  twistFlip: { warn: 120, fail: 160, unit: "degrees between keys (or per 0.1 s)", rate: 0, scales: false, reason: "a limb's twist, a hand's roll or a foot's heading jumping most of a half turn between keys. Where the reference is undefined (a straight limb for its twist and its hand's roll, a foot pointing straight down for its heading: the encoder's flips, F2.4) the jump counts whatever the keys' spacing, since a skinned bone turns about its axis over the in-between; elsewhere its rate, as the turn in 0.1 s, so a slow turn over far-apart keys isn't a flip. A flip turns the bone about its own axis, and swings the toes when the foot points down. Capture's median is 122°: the flips are common in the encoded capture (WP-3.5 repairs them), so the levels are by meaning (two thirds of a turn and nearly a half), not by distribution" },
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
  acrobatics: { tags: ["dodge", "climb", "getup"], names: /flip|cartwheel|tumble|handstand|(^|\/|dive_)roll/i, off: ["bodyPenetration", "intersection"], why: "rolls, flips and climbs put hands, knees and the back on the floor and curl the body" },
  lying: { tags: ["death", "lie", "crawl"], off: ["bodyPenetration", "slide", "skate", "intersection"], why: "the body lies on the floor; its feet aren't standing" },
  swimming: { tags: ["swim", "fly"], off: ["penetration", "bodyPenetration", "slide", "skate"], why: "no floor under the body" },
  sliding: { tags: ["slide"], off: ["slide", "skate", "bodyPenetration"], why: "a feet-first slide moves the feet along the floor on purpose, the body low on it" },
  sitting: { tags: ["sit", "vehicle"], off: ["bodyPenetration", "intersection"], why: "the pelvis and hands rest low, the thighs fold onto the belly" },
};
