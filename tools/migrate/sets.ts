// The seed sets WP-1.5 migrates to format 2 (PLAN.md WP-1.5): where each comes from, its tier, its edition, and how
// each source's license and making read in format 2. Distinct content gets distinct names (D4): my-3d2dge's and
// shardfall's Quaternius imports are two sets.

/**
 * CMU's notice word for word, as 4TU.ResearchData reproduces it (CMU's own site was down when it was read; research
 * note data_licensing_registries.md, "CMU"). The origin's source records say only "free for all uses" and omit the
 * no-resale clause.
 */
export const CMU_NOTICE =
  "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form. If you publish results obtained using this data, we would appreciate it if you would send the citation to your published paper to jkh+mocap@cs.cmu.edu, and also would add this text to your acknowledgments section: The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.";

/** How a source's clips were made and are licensed, keyed by the origin's source id (a prefix match for CMU_*). */
export interface SourceRule {
  method: "captured" | "keyed";
  license: string;
  credit?: string;
  terms?: string;
  audit?: string;
}

/** One target set. */
export interface SetSpec {
  set: string;
  title: string;
  tier: "cc0" | "cc-by" | "cmu" | "local";
  from: { repo: "my-3d2dge" | "shardfall"; file: string };
  edition: string;
  credit: string;
  sources: (id: string) => SourceRule;
}

const quaternius: SourceRule = { method: "keyed", license: "CC0-1.0", terms: "CC0 1.0 (public domain)" };
const m2m = (id: string): SourceRule => ({
  method: id === "M2M_MOCOPI" ? "captured" : "keyed",
  license: "CC0-1.0",
  terms: "CC0 1.0, per the mesh2motion-app README",
  audit: "pending WP-5.3: a July 2026 report says some Mesh2Motion assets are CC BY or CC BY-SA; no animation is named, so the set stays cc0 until the per-asset audit",
});

/** The five seed sets, in the order they are written. */
export const SETS: readonly SetSpec[] = [
  {
    set: "QUATERNIUS_3D2DGE",
    title: "Quaternius UAL 1 and 2 (my-3d2dge's import)",
    tier: "cc0",
    from: { repo: "my-3d2dge", file: "src/mocap/sets/quaternius.js" },
    edition: "Universal Animation Library 1 Standard (Godot export, AnimationLibrary_Godot_Standard.glb, 45 clips and a T-pose) and 2 Standard (UAL2_Standard.glb, 42 clips), as my-3d2dge@14a561c imported them",
    credit: "Universal Animation Library 1 and 2 by Quaternius (quaternius.com), CC0 1.0.",
    sources: () => quaternius,
  },
  {
    set: "QUATERNIUS_SHARDFALL",
    title: "Quaternius UAL 1 and 2, v2 (shardfall's import)",
    tier: "cc0",
    from: { repo: "shardfall", file: "anim/quaternius.json" },
    edition: "Universal Animation Library 1 and 2 Standard, version 2 (June 2026), Unreal-rig exports with their _RM root-motion twins, as shardfall@a9ca003 imported them",
    credit: "Universal Animation Library 1 and 2 by Quaternius (quaternius.com), CC0 1.0.",
    sources: () => quaternius,
  },
  {
    set: "MESH2MOTION",
    title: "Mesh2Motion",
    tier: "cc0",
    from: { repo: "my-3d2dge", file: "src/mocap/sets/mesh2motion.js" },
    edition: "mesh2motion-app's human animations (base, add-on and mocap GLBs), as my-3d2dge@14a561c imported them",
    credit: "Mesh2Motion's human animations (mesh2motion.org), CC0 1.0; some are Quaternius' Universal Animation Library clips as Mesh2Motion re-exported them.",
    sources: m2m,
  },
  {
    set: "CMU_CURATED",
    title: "CMU motion capture, curated",
    tier: "cmu",
    from: { repo: "my-3d2dge", file: "src/mocap/sets/cmu.js" },
    edition: "60 picks from 25 subjects of the CMU Graphics Lab Motion Capture Database (src/mocap/catalogs/cmu.json), as my-3d2dge@14a561c imported them",
    credit: "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu); created with funding from NSF EIA-0196217.",
    sources: () => ({ method: "captured", license: "LicenseRef-CMU-Mocap", credit: "CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu)", terms: CMU_NOTICE }),
  },
  {
    set: "STYLE100",
    title: "100STYLE walks",
    tier: "cc-by",
    from: { repo: "shardfall", file: "anim/style100.json" },
    edition: "100STYLE (zenodo.org/records/8127870): 98 forward walks, each cut at its best cycle, as shardfall@a9ca003 imported them",
    credit: "100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0.",
    sources: () => ({ method: "captured", license: "CC-BY-4.0", credit: "100STYLE, Mason, Starke and Komura (CC BY 4.0)", terms: "CC BY 4.0" }),
  },
];

/** A validator warning as the baseline sees it: its code, the key (1-based) and the field and index it names. */
export interface Warned {
  code: string;
  key?: number;
  field?: string;
  index?: number;
}

/** The limb twist bend past which a twist is well defined; below it a straight limb's twist barely shows. */
const STRAIGHT = 25;

/**
 * Why a validator warning is accepted in a migrated clip until the WP that addresses it, from the warning and the
 * clip's own keys, so each reason is true of the clip it is written for. Throws on a warning no reason covers, so a
 * new kind of warning gets a reason before it gets a baseline.
 */
export function baselineReason(w: Warned, warned: readonly Warned[], keys: readonly Record<string, unknown>[]): string {
  const field = w.field ?? "";
  if (w.code === "M2-W002") return "format 1's twist pop: a limb turns while bent past 140 degrees, where its twist barely shows; re-importing from the source files fixes it once they come (D63)";
  if (w.code === "M2-W003") return "the hips go below standing ground on purpose (the clip swims or rises from the ground); tag profiles refine the rule (WP-3.3)";
  if (w.code === "M2-W004") return "a limb swings round through its root between two keys; a refit or re-import adds the key between (WP-5.3)";
  if (w.code === "M2-W006") return "the origin's importer wrote this optional field in some keys only; re-import writes it in all (WP-5.3)";
  if (w.code === "M2-W005" && ["body", "chest", "head"].includes(field)) return "the body really spins: its turn accumulates past ±540 degrees, and unwrapping keeps the spin continuous (MOTION.md §6.3)";
  if (w.code === "M2-W005" && field.startsWith("foot") && w.index === 1) return "the foot's out angle is measured about the shin, which turns over in the flip, so it winds past ±540 degrees; the flip is real, the extra turns are the measure's, and a re-import folds them (WP-5.3)";
  if (w.code === "M2-W005" && /^(arm|leg)[LR]$/.test(field) && w.index === 4) {
    const bends = warned.filter((o) => o.code === w.code && o.field === field && o.index === 4).map((o) => (keys[o.key! - 1]![field] as number[])[3]!);
    const most = Math.max(...bends);
    if (most <= STRAIGHT) return `the twist of a nearly straight ${field.slice(0, 3)} (bend at most ${most} degrees at these keys) is barely defined, so capture noise winds it past ±540 degrees; a re-import that resets twist on straight limbs fixes it (WP-5.3)`;
  }
  if (w.code === "M2-W005" && /^hand[LR]$/.test(field) && w.index === 2) {
    const arm = `arm${field.slice(-1)}`, bends = warned.filter((o) => o.code === w.code && o.field === field && o.index === 2).map((o) => (keys[o.key! - 1]![arm] as number[])[3]!);
    const most = Math.max(...bends);
    if (most <= STRAIGHT) return `the hand's roll is measured from the elbow's bend, and this ${arm} is nearly straight (bend at most ${most} degrees at these keys), so its roll is barely defined and capture noise winds it past ±540 degrees (MOTION.md §6.3)`;
    // an arm that bends: the roll really turns that far over the clip, and unwrapping keeps the count
    const rolls = warned.filter((o) => o.code === w.code && o.field === field && o.index === 2).map((o) => (keys[o.key! - 1]![field] as number[])[2]!);
    return `the hand rolls round as the ${arm} bends ${Math.min(...bends)}–${most} degrees at these keys: its roll reaches ${rolls.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))} degrees, counted on past ±540 so it stays continuous (MOTION.md §6.3)`;
  }
  throw new Error(`no baseline reason covers ${w.code} at ${field}[${w.index}]: write one in tools/migrate/sets.ts before baselining it`);
}
