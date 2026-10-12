// The metrics (PLAN.md WP-3.3): foot sliding, penetration, self-intersection, jitter and pops, twist flips, joint
// limits, bone stretch, loop seams, fit, non-numbers, events and symmetry, each finding with its times; thresholds
// with their reasons; tag profiles; and `metrics(clip, R)`'s report and verdict.
export { metrics, measure, profilesOf, type Report, type MetricsOptions } from "./report.ts";
export { motionOf, motionOfFrames, stance, STANCE, type Motion, type MetricClip } from "./motion.ts";
export { slide, penetration, intersection, jitter, pops, twistFlips, jointLimits, stretch, seam, fit, nan, events, symmetry, levels, partScale, TYPICAL_CHAIN, type Finding, type Measured } from "./checks.ts";
export { THRESHOLDS, PROFILES, METRICS, REFERENCE_H0, type Threshold, type MetricName } from "./thresholds.ts";
