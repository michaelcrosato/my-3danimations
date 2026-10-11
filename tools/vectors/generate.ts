// Builds every conformance vector in memory from the oracles (tools/vectors/oracle.ts): path -> file text.
// Tier 1a: the importer's captured body points before `fit` for the tiny rig and the CMU take, with the oracle's
// measure, reduce, fit and text. Tier 1b: the raw inputs of the same pair. Tier 2: every curated clip decoded on its
// reference body at its key times and at three in-between times, with mirror and text checks. Tier 3: bodies of other
// proportions. Each oracle run is cross-checked against shardfall's expected sets, written by the same importer.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "../../spec/conformance/runner/json.ts";
import { loadCmuReader, loadCodec, loadGlbReader, loadSet, quietly, type Capture, type Clip1, type MR } from "./oracle.ts";
import { glb, rigGltf, type Proportions } from "./rig.ts";
import { format, type Rest } from "@m3a/core";

const { keyLens, mirror: mirror2, pose: pose2 } = format;
type KeyLike = format.KeyLike;

/** The curated sets of my-3d2dge carried into tier 2 (hero.js is game-specific and stays behind). */
export const SETS = ["quaternius", "mesh2motion", "cmu"] as const;

/** Tier 3's generated bodies: the tiny rig rescaled per segment. */
export const BODIES: Record<string, Proportions> = {
  rig: {},
  "long-legs": { legs: 1.3 },
  "short-arms": { arms: 0.75 },
  "long-torso": { torso: 1.35 },
  child: { all: 0.55, head: 1.6 },
  broad: { shoulders: 1.8, hips: 1.5 },
  stocky: { legs: 0.8, arms: 0.85, torso: 0.9, shoulders: 1.4 },
};

/** The fit budget the origin's importer uses by default (mm). */
const TOL = 30;
/** In-between sample times per clip, as fractions of `dur`; the last one is past the end (a loop wraps, a one-shot holds). */
const BETWEEN = [0.37, 0.71, 1.05];

const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
const µm = (out: Float32Array) => Array.from(out, (v) => Math.round(v * 1000));
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v);
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** A capture as plain data: frames as rows of 108 numbers (f, r, z per body point, mm, float32 values). */
function captureData(cap: Capture, P: number) {
  const rows: number[][] = [];
  for (let f = 0; f < cap.n; f++) rows.push(Array.from(cap.data.subarray(f * P * 3, (f + 1) * P * 3)));
  return { name: cap.name, n: cap.n, dur: cap.dur, loop: cap.loop, fps: cap.fps, ...(cap.take ? { take: cap.take } : {}), move: cap.move ? Array.from(cap.move) : null, data: rows };
}

/** The importer's per-clip catalog handling (anim-import.mjs:249-253): tags set loop/once, the rest become tags. */
function extraFor(name: string, cap: Capture, cat: Record<string, [string, string, string?]>) {
  const extra: Record<string, unknown> = { blade: /Sword/.test(name) };
  const c = cat[name];
  if (c) {
    const tags = c[0].split(" ").filter(Boolean);
    if (tags.includes("loop")) cap.loop = true;
    if (tags.includes("once")) cap.loop = false;
    extra.tags = tags.filter((t) => t !== "loop" && t !== "once");
    extra.desc = c[1];
  }
  return extra;
}

/** Tier 1a for one library: measure, then reduce, fit and text for each clip, as the importer runs them. */
function tier1a(MR: MR, label: string, clips: Record<string, Capture>, restClip: string, cat: Record<string, [string, string, string?]>, log: string[]) {
  const rest = MR.measure(clips, restClip);
  const out: Record<string, unknown> = {};
  for (const [name, cap] of Object.entries(clips)) {
    if (name.startsWith("_")) {
      out[name] = { capture: captureData(cap, MR.P) };
      continue;
    }
    const extra = extraFor(name, cap, cat);
    const reduce = MR.reduce(cap, TOL);
    const fit = MR.fit(rest, cap, TOL, extra);
    out[name] = { capture: captureData(cap, MR.P), extra, reduce, fit: { max: fit.max, mean: fit.mean, clip: fit.clip }, text: MR.text(fit.clip) };
  }
  return { about: `Tier 1a, ${label}: the origin's captured body points (POINTS order, f r z mm, float32 values) before fit, its measure (rest), and per clip reduce (tol ${TOL} mm), fit and text. Bit for bit.`, points: MR.POINTS, tol: TOL, restClip, rest, clips: out, log };
}

/** Every vector file, keyed by its path under spec/vectors/. `work` is a scratch folder under .cache/. */
export async function generate(root: string, work: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const put = (p: string, v: unknown) => files.set(p, typeof v === "string" ? v : stringify(v) + "\n");
  const MR = loadCodec(root);
  const fixtures = join(root, ".cache/src/shardfall/crates/pav_tools/tests/fixtures/mocap");
  mkdirSync(work, { recursive: true });

  // ---- the tiny rig: tier 1b input, tier 1a output, cross-checked against shardfall's rig_expected.json
  const rig = rigGltf();
  const rigGlb = glb(rig);
  const glbPath = join(work, "rig.glb");
  writeFileSync(glbPath, rigGlb);
  const gltfText = stringify({ ...rig.json, buffers: [{ byteLength: rig.bin.length, uri: `data:application/octet-stream;base64,${Buffer.from(rig.bin).toString("base64")}` }] }) + "\n";
  put("tier1b/rig.gltf", gltfText);
  const rigCatText = readFileSync(join(fixtures, "rig_catalog.json"), "utf8");
  put("tier1b/rig-catalog.json", rigCatText);
  const rigCat = JSON.parse(rigCatText) as Record<string, [string, string, string?]>;
  const readGlb = await loadGlbReader(root, work, glbPath, "RIG");
  const { value: rigLib, log: rigLog } = await quietly(() => readGlb(glbPath));
  const rigT1 = tier1a(MR, "the tiny rig (tier1b/rig.gltf packed as .glb, read by anim-import.mjs readLibrary)", rigLib.clips, "A_TPose", rigCat, rigLog);
  put("tier1a/rig.json", { ...rigT1, glbSha256: sha256(rigGlb) });
  crossCheck("rig", rigT1, JSON.parse(readFileSync(join(fixtures, "rig_expected.json"), "utf8")));

  // ---- the CMU take 09_02: tier 1b input (the ASF and AMC text), tier 1a output, cross-checked likewise
  const asf = readFileSync(join(fixtures, "cmu/09.asf"), "latin1");
  const amc = readFileSync(join(fixtures, "cmu/09_02.amc"), "latin1");
  put("tier1b/cmu/09.asf", asf);
  put("tier1b/cmu/09_02.amc", amc);
  const cmuCatText = readFileSync(join(fixtures, "cmu_catalog.json"), "utf8");
  put("tier1b/cmu/catalog.json", cmuCatText);
  const cmuCat = JSON.parse(cmuCatText) as { $pick: Record<string, [string, number, number]> } & Record<string, [string, string, string?]>;
  const picks = Object.entries(cmuCat.$pick).map(([name, [take, from, to]]) => ({ name, take, from, to, fps: 120, loop: (cmuCat[name]?.[0] ?? "").split(" ").includes("loop") }));
  const readCmu = await loadCmuReader(root);
  const { value: cmuLib, log: cmuLog } = await quietly(() => readCmu(join(fixtures, "cmu/09.asf"), picks, 30));
  const cmuT1 = tier1a(MR, "the CMU take 09_02 (tier1b/cmu, read by asf-amc.mjs readCmu at 30 fps)", cmuLib.clips, "_rest", cmuCat, cmuLog);
  put("tier1a/cmu-09_02.json", { ...cmuT1, picks });
  crossCheck("cmu", cmuT1, JSON.parse(readFileSync(join(fixtures, "cmu_expected.json"), "utf8")));

  // ---- tier 2: every curated clip decoded on its reference body
  const tier2Sizes: Record<string, number> = {};
  for (const name of SETS) {
    const set = loadSet(root, name);
    const ids = Object.keys(set.sources);
    const base = set.sources[ids[0]!]!.rest;
    const bodies: Record<string, unknown> = {};
    for (const id of ids) bodies[id] = { ...base, spineW: set.sources[id]!.rest.spineW, neckW: set.sources[id]!.rest.neckW };
    const clips: Record<string, unknown> = {};
    const out = new Float32Array(MR.P * 3);
    for (const [clipName, clip] of Object.entries(set.clips)) {
      const restSrc = bodies[clip.src ?? ""] ? clip.src! : ids[0]!;
      const R = bodies[restSrc];
      const keys = clip.keys.map((k) => ({ t: k.t, at: µm(MR.pose(R, clip, k.t, out)) }));
      const between = BETWEEN.map((u) => {
        const t = Math.round(clip.dur * u * 1000) / 1000;
        return { t, at: µm(MR.pose(R, clip, t, out)) };
      });
      const text = MR.text(clip);
      const mirrored = MR.mirror(clip);
      clips[clipName] = {
        clip,
        restSrc,
        dur: clip.dur,
        loop: Boolean(clip.loop),
        textSha256: sha256(text),
        parseTextSame: same(MR.parse(text).keys, clip.keys),
        mirrorSha256: sha256(stringify(mirrored.keys)),
        mirrorTwiceSame: same(MR.mirror(mirrored).keys.map(stripZeroSign), clip.keys.map((k) => stripZeroSign(fill(k)))),
        keys,
        between,
      };
    }
    const file = `tier2/${set.set}.json`;
    put(file, { about: `Tier 2, ${set.set}: each clip decoded on its reference body (the set's first source's rest with the clip's src spine and neck shares, as mocap.js builds it) at every key time and at ${BETWEEN.join(", ")} of dur; clip holds the input (the origin's clip object, keys included); body points in POINTS order as whole micrometres (f r z). Compare within 0.001 mm. textSha256 hashes the format-1 text lens; mirrorSha256 the mirrored keys (this file's number format, -0 kept).`, points: MR.POINTS, bodies, clips });
    tier2Sizes[set.set] = files.get(file)!.length;
  }

  // ---- tier 2, format 2's fields: decoded by @m3a/core, the reference implementation for them (D2)
  {
    const set = loadSet(root, "quaternius");
    const ids = Object.keys(set.sources);
    const base = set.sources[ids[0]!]!.rest;
    const bodies: Record<string, unknown> = {};
    for (const id of ids) bodies[id] = { ...base, spineW: set.sources[id]!.rest.spineW, neckW: set.sources[id]!.rest.neckW };
    const pick = ["Walk_Loop", "Idle_Loop", "Roll", "Dance_Loop", "Sword_Attack", "Punch_Jab"].filter((n) => set.clips[n]);
    const clips: Record<string, unknown> = {};
    const out = new Float32Array(MR.P * 3);
    for (const name of pick) {
      const c = set.clips[name]!;
      const keys = c.keys.map((k, i) => ({
        ...k,
        handL: [Math.round(40 * Math.sin(i)), Math.round(15 * Math.cos(i)), 150 + 20 * i],
        handR: [Math.round(-30 * Math.cos(i)), Math.round(-10 * Math.sin(i)), -60 + 7 * i],
        fingersL: [10, 20 + i, 40, 60, 80],
        fingersR: [100, 90, 70 - i, 50, 30],
        spine: [10 + i, 40, 80],
        yaw: 12 * i,
      })) as KeyLike[];
      const clip = { clip: c.clip ?? name, src: c.src, dur: c.dur, loop: Boolean(c.loop), keys };
      const restSrc = bodies[c.src ?? ""] ? c.src! : ids[0]!;
      const R = bodies[restSrc] as unknown as Rest;
      const µ = (t: number) => Array.from(pose2(R, clip, t, out), (v) => Math.round(v * 1000));
      const lens = keyLens(clip);
      const mirrored = mirror2(clip);
      clips[name] = {
        clip,
        restSrc,
        dur: clip.dur,
        loop: clip.loop,
        textSha256: sha256(lens),
        parseTextSame: same(JSON.parse(lens).keys, clip.keys),
        mirrorSha256: sha256(stringify(mirrored.keys)),
        mirrorTwiceSame: same(mirror2(mirrored).keys.map(stripZeroSign), clip.keys.map((k) => stripZeroSign(fill(k as Record<string, unknown>)))),
        keys: clip.keys.map((k) => ({ t: k.t as number, at: µ(k.t as number) })),
        between: BETWEEN.map((u) => {
          const t = Math.round(clip.dur * u * 1000) / 1000;
          return { t, at: µ(t) };
        }),
      };
    }
    put("tier2/FORMAT2.json", { about: "Tier 2, format 2's optional fields (hand, fingers, spine, yaw) on six QUATERNIUS clips, decoded by @m3a/core: the reference implementation for these fields (D2). textSha256 hashes keyLens; otherwise as the other tier-2 files.", format: "2.0", points: MR.POINTS, bodies, clips });
  }

  // ---- tier 3: bodies of other proportions (generated rigs, measured by the origin) plus the sets' own bodies
  const bodies: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(BODIES)) {
    const path = join(work, `body-${name}.glb`);
    writeFileSync(path, glb(rigGltf(p)));
    const { value: lib } = await quietly(() => readGlb(path));
    bodies[name] = { from: "tools/vectors/rig.ts", proportions: p, rest: MR.measure(lib.clips, "A_TPose") };
  }
  for (const name of SETS) {
    const set = loadSet(root, name);
    const id = Object.keys(set.sources)[0]!;
    bodies[`${set.set}/${id}`] = { from: `my-3d2dge src/mocap/sets/${name}.js`, rest: set.sources[id]!.rest };
  }
  bodies["CMU_09"] = { from: "tier1a/cmu-09_02.json", rest: cmuT1.rest };
  put("tier3/bodies.json", { about: "Tier 3: bodies of other proportions, as rests measured by the origin's measure(). A solver puts any clip on each; WP-2.4 checks every limb points within 9 degrees of the source (14 on a curled spine).", bodies });
  return files;
}

/** Mirroring writes -0 for a zero twist; for the mirror-twice comparison, zero's sign doesn't count. */
function stripZeroSign(k: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(k).map(([f, v]) => [f, Array.isArray(v) ? v.map((x: number) => (x === 0 ? 0 : x)) : v]));
}

/** Mirroring fills a limb's missing bend and twist with 0; compare the original filled the same way. */
function fill(k: Record<string, unknown>): Record<string, unknown> {
  const o = { ...k };
  for (const f of ["armL", "armR", "legL", "legR"]) {
    const v = o[f] as number[] | undefined;
    if (v) o[f] = [v[0], v[1], v[2], v[3] || 0, v[4] || 0];
  }
  return o;
}

/** Fail unless the oracle's run equals shardfall's expected set (same importer, same inputs) in rests and keys. */
function crossCheck(label: string, ours: { rest: unknown; clips: Record<string, unknown> }, want: { sources: Record<string, { rest: unknown }>; clips: Record<string, { keys: unknown }> }): void {
  const wantRest = Object.values(want.sources)[0]!.rest;
  if (!same(ours.rest, wantRest)) throw new Error(`${label}: the oracle's rest differs from shardfall's expected set; the pins or the oracle changed`);
  for (const [name, c] of Object.entries(want.clips)) {
    const o = ours.clips[name] as { fit?: { clip: Clip1 } } | undefined;
    if (!o?.fit || !same(o.fit.clip.keys, c.keys)) throw new Error(`${label}/${name}: the oracle's keys differ from shardfall's expected set`);
  }
}
