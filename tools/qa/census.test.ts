// The census's incremental form (D119): a pool that stays and clips added to it in turn, each count the whole census's
// (copies by orig, re-exports by name and by pose at their rate, near-duplicates by pose, held poses), the re-export
// and its original on either side of the pool, an added clip kept while it is the same object and read again when it
// is another.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, type Clip, type Rest } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { census, incremental } from "./census.ts";
import type { LibraryClip } from "./qa.ts";

/** A library clip read from its file, on its set's rest. */
const read = (id: string): LibraryClip => {
  const [set, name] = id.split("/") as [string, string], dir = join(ROOT, "library/sets", set);
  const clip = parseClip(readFileSync(join(dir, `${name}.json`), "utf8")), sources = (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources;
  return { set, clip, rest: sources[clip.restSrc]!.rest };
};
const o = read("QUATERNIUS_SHARDFALL/Death01"), other = read("QUATERNIUS_SHARDFALL/Hit_Head"), CC0 = new Set(["QUATERNIUS_SHARDFALL", "MESH2MOTION"]);
/** `c` in set `set` under its own name, edited by `edit`. */
const as = (c: LibraryClip, set: string, edit: (x: Clip) => Clip = (x) => x): LibraryClip => ({ ...c, set, clip: edit({ ...c.clip, id: `${set}/${c.clip.id.split("/")[1]}` }) });
// the original played at 0.8 of its speed under the re-export source's name (25% longer, keys stretched), a copy by
// orig, a near-duplicate by pose in another source, and one pose held 1 s and as a 4 s loop
const slowed = as(o, "MESH2MOTION", (x) => ({ ...x, id: "MESH2MOTION/Slowed", dur: Math.round(x.dur * 1250) / 1000, provenance: { ...x.provenance, src: "M2M_QUATERNIUS" }, keys: x.keys.map((k) => ({ ...k, t: Math.round(k.t * 1250) / 1000 })) }));
const copy = as(other, "COPIES", (x) => ({ ...x, provenance: { ...x.provenance, orig: other.clip.id } }));
const near = as(o, "NEAR", (x) => ({ ...x, id: "NEAR/Other_Name", provenance: { ...x.provenance, src: "ELSEWHERE" }, keys: x.keys.map((k) => ({ ...k, hips: [k.hips[0]! + 0.5, k.hips[1]!, k.hips[2]!] })) as never }));
const pose = { ...o.clip.keys[0]!, t: 0 }, held = (id: string, dur: number, loop: boolean): LibraryClip => ({ ...o, set: "HELD", clip: { ...o.clip, id, dur, loop, keys: [pose, { ...pose, t: dur }] } });
const [heldA, heldB] = [held("HELD/A", 1, false), held("HELD/B", 4, true)];

describe("the incremental census", () => {
  it("counts a pool with clips added as the whole census does, count after count, the added clips the same objects or new", () => {
    const pool = [o, other, heldA], added = [slowed, copy, near, heldB], count = incremental(pool, CC0), whole = census([...pool, ...added], CC0);
    // every kind of link is in it: a re-export by pose at its rate, a copy, a near-duplicate, a held pose
    expect([whole.same[slowed.clip.id]?.kind, whole.same[copy.clip.id]?.kind, whole.same[o.clip.id]?.as ?? whole.same[near.clip.id]?.as, whole.same[heldB.clip.id]?.kind ?? whole.same[heldA.clip.id]?.kind]).toEqual(["export", "orig", expect.any(String), "pose"]);
    expect(count(added)).toEqual(whole);
    expect(count(added)).toEqual(whole);
    expect(count(structuredClone(added))).toEqual(whole);
    // fewer added, or none: the census of what is counted, nothing kept from the counts before
    expect(count([copy])).toEqual(census([...pool, copy], CC0));
    expect(count([])).toEqual(census(pool, CC0));
  });
  it("finds a re-export in the pool from an original added to it, at the rate it plays", () => {
    const pool = [slowed, other, heldA], count = incremental(pool, CC0);
    expect(count([o, heldB])).toEqual(census([...pool, o, heldB], CC0));
    expect(count([o, heldB]).same[slowed.clip.id]).toMatchObject({ as: o.clip.id, kind: "export", why: expect.stringMatching(/played at 0\.8 of its speed/) });
    expect(count([heldB]).same[slowed.clip.id]).toBeUndefined();
  });
});
