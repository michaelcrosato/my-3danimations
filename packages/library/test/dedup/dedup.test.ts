// Near-duplicate detection (WP-9.3): copies of library clips planted through recipes (retimed, eased, trimmed,
// mirrored, lightly edited, and all of it at once; a held pose held three times as long) are found against the whole
// library, each as its original; the library's distinct clips stay apart (each 100STYLE style's walk and run, its
// sidesteps to either side, jabs and crosses, turns either way); a sweep of the library joins no two clips the census
// counts apart but the two dodges Mesh2Motion ships as one motion mirrored; and a check compares few clips in full. T1
// plants into and sweeps a sample of the library, T2's full step (M3A_FULL=1) more of it.
import { recipe as R, type Clip, type Rest } from "@m3a/core";
import { beforeAll, describe, expect, it } from "vitest";
import { census } from "../../../../tools/qa/census.ts";
import { DedupIndex, motionDistance, motionFeatures, NEAR, nearFor, worthComparing, type DedupHit } from "../../src/dedup/index.ts";
import { TIERS, type LoadedClip } from "../../src/index.ts";
import { openLibrary } from "../../src/node.ts";

const FULL = process.env.M3A_FULL === "1";
const lib = openLibrary({ tiers: TIERS, warn: () => {} }), resolve = lib.resolver();
let clips: LoadedClip[], index: DedupIndex, built = 0;
beforeAll(() => {
  clips = lib.catalog().map((r) => lib.clip(r.id));
  const t0 = performance.now();
  index = DedupIndex.of(clips);
  built = performance.now() - t0;
}, 60_000);
const byId = (id: string) => clips.find((c) => c.clip.id === id)!;
const dist = (a: string, b: string) => motionDistance(index.get(a)!, index.get(b)!);

/** How each copy is made from its original, as recipe steps after `{ as: "c", op: "clip", id }`: the light edits of
 *  WP-9.3 (a 1° lean of the chest moves a clip about 4 mm, 11 for a ledge hang, its arms overhead; a 4° one is not
 *  light, at 14 mm and more). */
const PLANTS: Record<string, (c: Clip) => R.Step[] | null> = {
  slower: () => [{ op: "retime", in: "c", speed: 0.8 }],
  faster: () => [{ op: "retime", in: "c", speed: 1.25 }],
  eased: () => [{ op: "retime", in: "c", ease: "inOut" }],
  mirrored: () => [{ op: "mirror", in: "c" }],
  trimmed: (c) => (c.loop ? null : [{ as: "t", op: "clip", id: c.id, from: +(c.dur * 0.05).toFixed(3), to: +(c.dur * 0.95).toFixed(3) }]),
  leaned: () => [{ op: "pose", in: "c", chest: { lean: 1 } }],
  smoothed: () => [{ op: "smooth", in: "c", window: 0.05 }],
  "all at once": () => [{ as: "m", op: "mirror", in: "c" }, { as: "r", op: "retime", in: "m", speed: 1.2 }, { op: "pose", in: "r", chest: { lean: 1 } }],
};
/** A copy of clip `id` made by `plant`, compiled on the library, and the rest it decodes on. */
function planted(id: string, kind: string): { clip: Clip; rest: Rest } | null {
  const steps = PLANTS[kind]!(byId(id).clip);
  if (!steps) return null;
  const c = R.compile({ format: "2.0", id: `PLANTED/${id.split("/")[1]}_${kind.replace(/ /g, "_")}`, steps: steps[0]!.op === "clip" ? steps : [{ as: "c", op: "clip", id }, ...steps] }, resolve);
  return { clip: c.clip, rest: c.rest };
}

describe("near-duplicate detection", () => {
  it(`finds copies planted into ${FULL ? "every 20th" : "every 90th"} clip: retimed, eased, trimmed, mirrored, lightly edited, and all at once`, () => {
    // (a recipe names a clip as SET/Slug without the `-` a slug may hold, spec/MOTION.md §11: MESH2MOTION/Two-hand_Blast)
    const originals = clips.filter((c, i) => i % (FULL ? 20 : 90) === 7 && /^[A-Z0-9_]+\/[A-Za-z0-9_]+$/.test(c.clip.id)).map((c) => c.clip.id), worst: Record<string, number> = {}, missed: string[] = [];
    let found = 0, total = 0;
    for (const id of originals)
      for (const kind of Object.keys(PLANTS)) {
        const p = planted(id, kind);
        if (!p) continue;
        total++;
        // found: the check names the original among the clips within NEAR (a clip the original is one motion with may
        // come first: Mesh2Motion's two dodges are each other's mirror)
        const hit = index.check(p.clip, p.rest).near.find((h: DedupHit) => h.id === id);
        if (hit) [found, worst[kind]] = [found + 1, Math.max(worst[kind] ?? 0, hit.mm)];
        else missed.push(`${kind} ${id}`);
      }
    console.log(`dedup: planted ${total} copies of ${originals.length} clips, found ${found}, missed ${missed.length}; the farthest found by kind (mm): ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}`);
    expect(missed).toEqual([]);
    expect(total).toBeGreaterThan(FULL ? 400 : 100);
  }, 120_000);

  it("finds a held pose held three times as long, past the retime two clips are compared within", () => {
    const id = "STYLE100_IDLE/Neutral_Idle", c = R.compile({ format: "2.0", id: "PLANTED/Held", steps: [{ as: "c", op: "clip", id }, { op: "retime", in: "c", dur: +(byId(id).clip.dur * 3).toFixed(3) }] }, resolve);
    expect(index.check(c.clip, c.rest).near.map((h) => h.id)).toContain(id);
  });

  it("keeps the library's distinct clips apart: a walk and its run, sidesteps either way, jabs and crosses, turns", () => {
    const pairs: [string, string][] = [];
    for (const id of index.ids()) {
      const run = id.replace(/^STYLE100\/(.*)_Walk$/, "STYLE100_RUN/$1_Run"), right = id.replace(/^(STYLE100_SIDE(?:RUN)?\/.*_Side(?:Run)?)Left$/, "$1Right");
      if (run !== id && index.has(run)) pairs.push([id, run]);
      if (right !== id && index.has(right)) pairs.push([id, right]);
    }
    for (const s of ["MESH2MOTION", "QUATERNIUS_3D2DGE", "QUATERNIUS_SHARDFALL"]) pairs.push([`${s}/Punch_Jab`, `${s}/Punch_Cross`]);
    pairs.push(["MESH2MOTION/Fighting_Left_Jab", "MESH2MOTION/Fighting_Right_Jab"], ["MESH2MOTION/Turn_Left_90", "MESH2MOTION/Turn_Right_90"], ["MESH2MOTION/Turn_Left_180", "MESH2MOTION/Turn_Right_180"], ["MESH2MOTION/Turn_Left_90", "MESH2MOTION/Turn_Left_180"]);
    // the index compares in full only the pairs its prefilter lets through
    const near = pairs.filter(([a, b]) => worthComparing(index.get(a)!, index.get(b)!)).map(([a, b]) => ({ a, b, mm: dist(a, b).mm, under: nearFor(index.get(a)!, index.get(b)!) })).sort((x, y) => x.mm - x.under - (y.mm - y.under));
    console.log(`dedup: ${pairs.length} distinct pairs, ${near.length} compared in full${near[0] ? `, the nearest ${near[0].a} and ${near[0].b} at ${near[0].mm.toFixed(1)} mm (one motion under ${near[0].under.toFixed(1)})` : ""}`);
    expect(pairs.length).toBeGreaterThan(280);
    expect(near.filter((p) => p.mm < p.under)).toEqual([]);
  });

  it(`joins no two clips the census counts apart, in a sweep of ${FULL ? "the whole library" : "every 10th clip's pairs"}, but Mesh2Motion's dodges, one motion mirrored`, () => {
    const cc0 = new Set(lib.sets().filter((s) => s.tier === "cc0").map((s) => s.set)), cen = census(clips, cc0), group = (id: string) => cen.same[id]?.as ?? id;
    const dodges = new Set(["MESH2MOTION/Dodge_left", "MESH2MOTION/Dodge_left_RM", "MESH2MOTION/Dodge_right", "MESH2MOTION/Dodge_right_RM"]), sampled = new Set(index.ids().filter((id, i) => FULL || i % 10 === 0 || dodges.has(id)));
    const pairs = index.pairs({ of: (id) => sampled.has(id) }), apart = pairs.filter((p) => group(p.a) !== group(p.b));
    console.log(`dedup: the sweep found ${pairs.length} pairs one motion (within ${NEAR} mm and a share of how much they move), ${pairs.length - apart.length} of them one motion in the census too; apart in it: ${apart.map((p) => `${p.a} ~ ${p.b}${p.mirrored ? " mirrored" : ""} ${p.mm.toFixed(1)} mm`).join("; ")}`);
    // the dodges to either side are one animation mirrored, which the census, reading no mirror, counts twice
    expect(apart.every((p) => dodges.has(p.a) && dodges.has(p.b) && p.mirrored && p.mm < 1)).toBe(true);
    expect(apart.length).toBe(4);
  }, 120_000);

  it("checks a clip against the whole library comparing few in full, says what it found, and leaves out the clip a change improves", () => {
    const id = "MESH2MOTION/Walk_Formal", p = planted(id, "all at once")!, t0 = performance.now(), check = index.check(p.clip, p.rest), ms = performance.now() - t0;
    console.log(`dedup: the index of ${index.size} clips built in ${(built / 1000).toFixed(1)} s; one check took ${ms.toFixed(0)} ms, ${check.compared} compared in full`);
    expect(check.duplicate?.id).toBe(id);
    expect(check.compared).toBeLessThan(index.size / 50);
    expect(check.message).toMatch(new RegExp(`near-duplicate of ${id} mirrored, \\d+\\.\\d mm a point from it on average \\(one motion under \\d+\\.\\d\\): .*\\(--improves ${id}\\)`));
    // an improvement of the clip lies near it by design: it is no duplicate of anything else
    const improves = index.check(p.clip, p.rest, { except: [id] });
    expect(improves.duplicate).toBeNull();
    expect(improves.message).toMatch(/no near-duplicate: no indexed clip of \d+ lies within 12 mm a point of it, or 2% more of how much it moves/);
  });

  it("is deterministic: the same clip gives the same features and distances, bit for bit", () => {
    const a = byId("CMU_CURATED/Roundhouse_Kick"), b = planted(a.clip.id, "eased")!;
    const f1 = motionFeatures(a.clip, a.rest), f2 = motionFeatures(a.clip, a.rest);
    expect(Buffer.from(f1.frames.buffer).equals(Buffer.from(f2.frames.buffer))).toBe(true);
    expect(motionDistance(motionFeatures(b.clip, b.rest), f1)).toEqual(motionDistance(motionFeatures(b.clip, b.rest), f2));
    expect(() => index.add(a.clip, a.rest)).toThrow(/is in the index already/);
  });
});
