// The conformance kit (WP-10.2): each tier of spec/conformance/tiers.md as questions to an implementation. A tier
// builds its cases from the vectors, asks them through the protocol (PROTOCOL.md) and compares every answer with the
// tier's tolerance, keeping per vector file its cases, its failures and the first failure's field with both values.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "../runner/json.ts";
import { rigSkeleton } from "../runner/skeleton.ts";
import { loadTier1a, loadTier2, loadTier3, sha256, TOLERANCE, tier1bGlb, tier1bText, tier2Sets, VECTORS, type Tier2Clip } from "../runner/vectors.ts";
import { AnswerError, PROTOCOL } from "./wire.ts";

/** Ask the implementation one op with its fields: the op's result, or a thrown error. */
export type Ask = (op: string, fields: Record<string, unknown>) => Promise<unknown>;

/** Where an answer first differs from the vector: the field's path and both values. */
export interface Diff {
  field: string;
  ours: unknown;
  want: unknown;
}

/** A failed case: its vector file, the case, and where its answer first differs. */
export interface Failure extends Diff {
  vector: string;
  case: string;
}

/** One vector file's outcome in a tier: its cases, how many failed, and the first that did. */
export interface VectorResult {
  vector: string;
  cases: number;
  failed: number;
  first?: Failure;
}

/** The tiers, in order, each with the ops an implementation must answer to claim it. */
export const TIERS = { "1a": ["reduce", "fit", "text"], "1b": ["readGltf", "readCmu", "measure"], "2": ["decode", "text", "parse", "mirror"], "3": ["retarget"] } as const;

/** A tier's name. */
export type Tier = keyof typeof TIERS;

/** The tiers' names in order (an object lists "2" and "3" before "1a"). */
export const TIER_NAMES: readonly Tier[] = ["1a", "1b", "2", "3"];

/** What an implementation says of itself in answer to `hello`. */
export interface Hello {
  implementation: string;
  version: string;
  protocol: string;
  ops: string[];
  /** The format versions it reads: 1 and 2 when omitted. A format-1 codec leaves tier 2's FORMAT2.json unclaimed. */
  formats?: number[];
}

/** One tier's outcome: claimed (every op it needs answered), passed, its cases per vector file, the worst errors. */
export interface TierOutcome {
  tier: Tier;
  claimed: boolean;
  ok: boolean;
  ms: number;
  cases: number;
  failed: number;
  vectors: VectorResult[];
  worst: Record<string, number>;
  missing: string[];
  skipped: string[];
}

/** Where `ours` first differs from `want`: numbers bit for bit (or within `tol`, or with -0's sign ignored), strings
 *  byte for byte, arrays item by item, objects by their fields (order free, undefined ones absent). */
export function diff(ours: unknown, want: unknown, path: string, o: { tol?: number; zeroSign?: boolean } = {}): Diff | null {
  if (typeof want === "number") {
    const n = ours as number, same = typeof ours === "number" && (o.tol !== undefined ? Math.abs(n - want) <= o.tol : o.zeroSign === false ? n === want : Object.is(n, want));
    return same ? null : { field: path, ours, want };
  }
  if (typeof want === "string" && typeof ours === "string" && ours !== want) {
    let i = 0;
    while (ours[i] === want[i]) i++;
    const cut = (s: string) => s.slice(Math.max(0, i - 24), i + 40);
    return { field: `${path} at character ${i}`, ours: cut(ours), want: cut(want) };
  }
  if (Array.isArray(want)) {
    if (!Array.isArray(ours) || ours.length !== want.length) return { field: `${path} (length)`, ours: Array.isArray(ours) ? ours.length : ours, want: want.length };
    for (let i = 0; i < want.length; i++) {
      const d = diff(ours[i], want[i], `${path}[${i}]`, o);
      if (d) return d;
    }
    return null;
  }
  if (want && typeof want === "object") {
    if (!ours || typeof ours !== "object") return { field: path, ours, want: "an object" };
    const a = ours as Record<string, unknown>, b = want as Record<string, unknown>;
    const fa = Object.keys(a).filter((k) => a[k] !== undefined).sort(), fb = Object.keys(b).filter((k) => b[k] !== undefined).sort();
    if (fa.join() !== fb.join()) return { field: `${path} (fields)`, ours: fa, want: fb };
    for (const k of fb) {
      const d = diff(a[k], b[k], `${path}.${k}`, o);
      if (d) return d;
    }
    return null;
  }
  return ours === want ? null : { field: path, ours, want };
}

/** A vector file's cases as they run: each checks one answer; a thrown error fails the case with its message. */
class Cases {
  readonly r: VectorResult;
  constructor(vector: string) {
    this.r = { vector, cases: 0, failed: 0 };
  }
  async case(name: string, check: () => Promise<Diff | null>): Promise<void> {
    this.r.cases++;
    let d: Diff | null;
    try {
      d = await check();
    } catch (e) {
      d = { field: "(answer)", ours: e instanceof Error ? e.message : String(e), want: "an answer of the op's shape" };
    }
    if (d && this.r.failed++ === 0) this.r.first = { vector: this.r.vector, case: name, ...d };
  }
}

type Run = (ask: Ask, o: { sample: number; format2: boolean }) => Promise<{ vectors: VectorResult[]; worst?: Record<string, number>; skipped?: string[] }>;
const each = <A, B>(o: Record<string, A>, f: (a: A) => B) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
const pick = (o: unknown, fields: string[]) => (o && typeof o === "object" ? Object.fromEntries(fields.map((f) => [f, (o as Record<string, unknown>)[f]])) : o);
const json = <T>(rel: string) => JSON.parse(readFileSync(join(VECTORS, rel), "utf8")) as T;

// Tier 1a: reduce, fit and text from the oracle's captured body points, bit for bit.
const tier1a: Run = async (ask, { sample }) => {
  const vectors: VectorResult[] = [];
  for (const name of ["rig", "cmu-09_02"] as const) {
    const v = loadTier1a(name), c = new Cases(`tier1a/${name}.json`);
    for (const [clip, x] of Object.entries(v.clips).filter(([, x]) => x.fit).slice(0, sample)) {
      await c.case(`${clip} reduce`, async () => diff(await ask("reduce", { capture: x.capture, tol: v.tol }), x.reduce, "reduce"));
      await c.case(`${clip} fit`, async () => diff(await ask("fit", { rest: v.rest, capture: x.capture, tol: v.tol, extra: x.extra ?? {} }), x.fit, "fit"));
      await c.case(`${clip} text`, async () => diff(await ask("text", { clip: x.fit!.clip, format: 1 }), x.text, "text"));
    }
    vectors.push(c.r);
  }
  return { vectors };
};

// Tier 1b: the readers' captures (clip names in order) and the rest measured from them, bit for bit.
const tier1b: Run = async (ask) => {
  type Lib = { rig?: string; body?: unknown; restClip?: string; rest: unknown; log: string[]; clips: Record<string, { capture: unknown }> };
  const read = async (op: string, fields: Record<string, unknown>, want: Record<string, unknown>) => {
    const ours = (await ask(op, fields)) as { clips?: object };
    return diff(Object.keys(ours?.clips ?? {}), Object.keys(want.clips as object), `${op}.clips (names in order)`) ?? diff(pick(ours, Object.keys(want)), want, op);
  };
  const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
  const rig = loadTier1a("rig") as unknown as Lib, rigify = json<Lib>("tier1b/rigify-expected.json"), cmu = loadTier1a("cmu-09_02") as unknown as Lib;
  const caps = (v: Lib) => each(v.clips, (x) => x.capture);
  const cat = JSON.parse(tier1bText("cmu/catalog.json")) as { $pick: Record<string, [string, number, number]> } & Record<string, [string, string]>;
  const picks = Object.entries(cat.$pick).map(([name, [take, from, to]]) => ({ name, take, from, to, fps: 120, loop: (cat[name]?.[0] ?? "").split(" ").includes("loop") }));
  const amc = Object.fromEntries(picks.map((p) => [p.take, tier1bText(`cmu/${p.take}.amc`)]));
  // each input, the oracle's library it must read as, the clip its rest comes from (the Rigify rig's T-pose), the read
  const files: [string, Lib, string, () => Promise<Diff | null>][] = [
    ["tier1b/rig.gltf", rig, rig.restClip!, () => read("readGltf", { glb: b64(tier1bGlb("tier1b/rig.gltf")), fps: 30 }, { rig: "unreal", clips: caps(rig) })],
    ["tier1b/rigify.gltf", rigify, "A_TPose", () => read("readGltf", { glb: b64(tier1bGlb("tier1b/rigify.gltf")), fps: 30 }, { rig: rigify.rig, warnings: [], body: rigify.body, clips: caps(rigify) })],
    ["tier1b/cmu/", cmu, cmu.restClip!, () => read("readCmu", { asf: tier1bText("cmu/09.asf"), amc, picks, fps: 30 }, { clips: caps(cmu), log: cmu.log })],
  ];
  const vectors: VectorResult[] = [];
  for (const [file, v, restClip, reading] of files) {
    const c = new Cases(file);
    await c.case("read", reading);
    await c.case("measure", async () => diff(await ask("measure", { clips: caps(v), restClip }), v.rest, "rest"));
    vectors.push(c.r);
  }
  return { vectors };
};

/** The mirrored key's fields in the reference's order, so its hash doesn't hang on the order an answer writes them. */
const MIRRORED = ["t", "hips", "body", "chest", "head", "root", "armL", "legL", "footL", "shL", "armR", "legR", "footR", "shR", "blade", "handL", "fingersL", "handR", "fingersR", "spine", "yaw"];
const canonical = (k: Record<string, unknown>) => Object.fromEntries([...MIRRORED.filter((f) => f in k), ...Object.keys(k).filter((f) => !MIRRORED.includes(f))].map((f) => [f, k[f]]));
/** A clip's keys as mirroring twice gives them back: every limb with five numbers. */
const filled = (keys: Tier2Clip["clip"]["keys"]) =>
  keys.map((k) => {
    const o = { ...k };
    for (const f of ["armL", "armR", "legL", "legR"]) if (Array.isArray(o[f])) o[f] = [...o[f].slice(0, 3), o[f][3] || 0, o[f][4] || 0];
    return o;
  });

// Tier 2: decode within 0.001 mm at every key and in-between; text, parse and mirror exactly.
const tier2: Run = async (ask, { sample, format2 }) => {
  const vectors: VectorResult[] = [];
  let worst = 0;
  for (const set of tier2Sets()) {
    const v = loadTier2(set), c = new Cases(`tier2/${set}.json`), fmt = v.format === "2.0" ? 2 : 1;
    if (fmt === 2 && !format2) continue;
    for (const [name, x] of Object.entries(v.clips).slice(0, sample)) {
      const at = [...x.keys, ...x.between];
      await c.case(`${name} decode`, async () => {
        const got = (await ask("decode", { rest: v.bodies[x.restSrc], clip: x.clip, times: at.map((s) => s.t) })) as number[][];
        const shape = diff(got?.map?.((p) => p?.length), at.map(() => 108), "decode (poses, points)");
        if (shape) return shape;
        for (let j = 0; j < at.length; j++) {
          for (let i = 0; i < 108; i++) {
            const um = Math.abs(got[j]![i]! * 1000 - at[j]!.at[i]!);
            if (!(um <= TOLERANCE.tier2mm * 1000)) return { field: `decode t ${at[j]!.t}: ${v.points[(i / 3) | 0]}[${i % 3}] (mm)`, ours: got[j]![i], want: at[j]!.at[i]! / 1000 };
            if (um > worst) worst = um;
          }
        }
        return null;
      });
      let text = "";
      await c.case(`${name} text`, async () => diff(sha256((text = (await ask("text", { clip: x.clip, format: fmt })) as string)), x.textSha256, "textSha256 (of the text)"));
      await c.case(`${name} parse`, async () => diff(((await ask("parse", { text, format: fmt })) as { keys: unknown })?.keys, x.clip.keys, "parse.keys", { zeroSign: false }));
      await c.case(`${name} mirror`, async () => {
        const once = (await ask("mirror", { clip: x.clip })) as { keys: Record<string, unknown>[] };
        const twice = diff(sha256(stringify(once.keys.map(canonical))), x.mirrorSha256, "mirrorSha256 (of the mirrored keys)");
        return twice ?? diff(((await ask("mirror", { clip: { ...x.clip, keys: once.keys } })) as { keys: unknown })?.keys, filled(x.clip.keys), "mirror twice: keys", { zeroSign: false });
      });
    }
    vectors.push(c.r);
  }
  return { vectors, worst: { decodeUm: worst }, skipped: format2 ? [] : ["tier2/FORMAT2.json (format 2)"] };
};

// Tier 3: retargeting onto other bodies, measured from the joints an implementation reports in the format's frame.
type V = number[];
const sub = (a: V, b: V) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot = (a: V, b: V) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const unit = (a: V) => a.map((x) => x / Math.hypot(a[0]!, a[1]!, a[2]!));
const angle = (a: V, b: V) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
/** An orthonormal frame from a direction and a second one across it. */
const triad = (x: V, y: V): V[] => {
  const a = unit(x), b = unit(sub(y, a.map((v) => v * dot(y, a))));
  return [a, b, [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]];
};
/** The rotation (row-major 3×3) taking frame A's axes onto frame B's. */
const turn = (A: V[], B: V[]) => Array.from({ length: 9 }, (_, rc) => A.reduce((s, a, i) => s + B[i]![(rc / 3) | 0]! * a[rc % 3]!, 0));
const turnAngle = (M: V, N: V) => (Math.acos(Math.max(-1, Math.min(1, (M.reduce((s, m, i) => s + m * N[i]!, 0) - 1) / 2))) * 180) / Math.PI;
/** Each humanoid bone's humanoid parent: the pairs whose distance retargeting keeps. */
const PARENT: Record<string, string> = { spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck" };
for (const s of ["left", "right"]) Object.assign(PARENT, { [s + "Shoulder"]: "upperChest", [s + "UpperArm"]: s + "Shoulder", [s + "LowerArm"]: s + "UpperArm", [s + "Hand"]: s + "LowerArm", [s + "UpperLeg"]: "hips", [s + "LowerLeg"]: s + "UpperLeg", [s + "Foot"]: s + "LowerLeg", [s + "Toes"]: s + "Foot" });

const tier3: Run = async (ask, { sample, format2 }) => {
  const sets = tier2Sets().map((s) => [s, loadTier2(s)] as const).filter(([, v]) => format2 || v.format !== "2.0"), vectors: VectorResult[] = [];
  const worst = { limbDeg: 0, chestDeg: 0, curledDeg: 0, lengthMm: 0 };
  for (const [body, b] of Object.entries(loadTier3().bodies).filter(([, b]) => b.proportions)) {
    const c = new Cases(`tier3/bodies.json: ${body}`), sk = rigSkeleton(b.proportions), head = new Map(sk.bones.map((x) => [x.name, x.head as V]));
    const { fist, Cr } = b.rest as { fist: number; Cr: V[] };
    for (const [set, v] of sets) {
      const P = (s: { at: number[] }, n: string) => s.at.slice(v.points.indexOf(n) * 3, v.points.indexOf(n) * 3 + 3).map((x) => x / 1000);
      for (const [name, x] of Object.entries(v.clips).slice(0, sample)) {
        const SR = v.bodies[x.restSrc] as { fist: number; clav: { L: V; R: V } }, at = [x.keys[0]!, ...x.between];
        await c.case(`${set}/${name}`, async () => {
          const r = (await ask("retarget", { skeleton: sk, source: SR, clip: x.clip, times: at.map((s) => s.t) })) as { bones: Record<string, string>; rest: Record<string, V>; poses: Record<string, V>[] };
          const need = ["hips", "spine", "upperChest", "neck", ...Object.keys(PARENT).filter((h) => /Shoulder|Arm|Hand|Leg|Foot/.test(h))];
          const shape = diff(r?.poses?.length, at.length, "retarget.poses (length)") ?? diff(need.filter((h) => !r.rest?.[h] || r.poses.some((p) => !p?.[h])), [], "retarget: joints missing");
          if (shape) return shape;
          const rel = (J: Record<string, V>, a: string, b: string) => sub(J[a]!, J[b]!), R = r.rest;
          const chestRest = triad(rel(R, "neck", "upperChest"), rel(R, "rightShoulder", "leftShoulder")), hipsRest = triad(rel(R, "spine", "hips"), rel(R, "rightUpperLeg", "leftUpperLeg"));
          for (let j = 0; j < at.length; j++) {
            const J = r.poses[j]!, s = at[j]!, t = `t ${s.t}`;
            for (const [side, S] of [["left", "L"], ["right", "R"]] as const) {
              // an arm aims at its virtual fist: the wrist plus the forearm's direction times the fist's reach (MOTION.md §5.3)
              const vf = (el: V, wr: V, reach: number) => wr.map((w, i) => w + unit(sub(wr, el))[i]! * reach);
              const arm = angle(sub(vf(J[side + "LowerArm"]!, J[side + "Hand"]!, fist), J[side + "UpperArm"]!), sub(vf(P(s, "elbow" + S), P(s, "wrist" + S), SR.fist), P(s, "sh" + S)));
              const leg = angle(rel(J, side + "Foot", side + "UpperLeg"), sub(P(s, "ankle" + S), P(s, "hip" + S)));
              for (const [limb, deg] of [["arm", arm], ["leg", leg]] as const) {
                if (!(deg <= TOLERANCE.tier3deg)) return { field: `${t}: ${limb}${S} direction (degrees off the source)`, ours: deg, want: `at most ${TOLERANCE.tier3deg}` };
                worst.limbDeg = Math.max(worst.limbDeg, deg);
              }
            }
            // the chest faces as the source's: the turn from the target's rest chest frame (Cr) to the source's posed one (RC,
            // rebuilt from its chest, chestF and clavicle points) against the turn the target's upper chest makes from rest (its
            // neck and shoulders turn with it); one turned more than 30° from the hips' turn is a curled spine, allowed 14°
            const local = triad([1, 0, 0], sub(SR.clav.R, SR.clav.L)), world = triad(sub(P(s, "chestF"), P(s, "chest")), sub(P(s, "clavR"), P(s, "clavL")));
            const M = turn(local, world), RC = [0, 1, 2].map((i) => [M[i]!, M[3 + i]!, M[6 + i]!]), want = turn(Cr, RC);
            const chest = turnAngle(want, turn(chestRest, triad(rel(J, "neck", "upperChest"), rel(J, "rightShoulder", "leftShoulder"))));
            const curled = turnAngle(want, turn(hipsRest, triad(rel(J, "spine", "hips"), rel(J, "rightUpperLeg", "leftUpperLeg")))) > 30, tol = curled ? TOLERANCE.tier3curledDeg : TOLERANCE.tier3deg;
            if (!(chest <= tol)) return { field: `${t}: chest turn (degrees off the source${curled ? ", curled" : ""})`, ours: chest, want: `at most ${tol}` };
            if (curled) worst.curledDeg = Math.max(worst.curledDeg, chest);
            else worst.chestDeg = Math.max(worst.chestDeg, chest);
            for (const [h, p] of Object.entries(PARENT)) {
              if (!r.bones[h] || !r.bones[p] || !J[h] || !J[p]) continue;
              const len = Math.hypot(...sub(head.get(r.bones[h])!, head.get(r.bones[p])!)) * 1000, got = Math.hypot(...rel(J, h, p)), off = Math.abs(got - len);
              if (!(off <= 1e-6)) return { field: `${t}: ${p} to ${h} length (mm)`, ours: got, want: len };
              worst.lengthMm = Math.max(worst.lengthMm, off);
            }
          }
          return null;
        });
      }
    }
    vectors.push(c.r);
  }
  return { vectors, worst, skipped: format2 ? [] : ["tier2/FORMAT2.json's clips (format 2)"] };
};

const RUN: Record<Tier, Run> = { "1a": tier1a, "1b": tier1b, "2": tier2, "3": tier3 };

/** Certify an implementation: `hello`, then each tier it claims, at most `sample` clips per vector file (all by default). */
export async function certify(ask: Ask, tiers: readonly Tier[] = TIER_NAMES, sample = Infinity): Promise<{ impl: Hello; tiers: TierOutcome[] }> {
  const impl = (await ask("hello", { protocol: PROTOCOL })) as Hello;
  if (impl?.protocol !== PROTOCOL || !Array.isArray(impl.ops)) throw new AnswerError(`its hello answered ${JSON.stringify(impl)}, not protocol ${PROTOCOL} with its ops`);
  const out: TierOutcome[] = [];
  for (const tier of tiers) {
    const missing = TIERS[tier].filter((op) => !impl.ops.includes(op)), t0 = performance.now();
    const run = missing.length ? { vectors: [] } : await RUN[tier](ask, { sample, format2: impl.formats?.includes(2) ?? true });
    const cases = run.vectors.reduce((s, x) => s + x.cases, 0), failed = run.vectors.reduce((s, x) => s + x.failed, 0);
    out.push({ tier, claimed: !missing.length, ok: !missing.length && cases > 0 && failed === 0, ms: performance.now() - t0, cases, failed, vectors: run.vectors, worst: run.worst ?? {}, missing, skipped: run.skipped ?? [] });
  }
  return { impl, tiers: out };
}
