// The sweep's rows pinned (WP-7.2b's Done-when: the same rows after its judge moved to @m3a/tools): six library clips
// and a broken one (a walk with one key's pelvis not a number) on gen-0 and gen-7, each pair's verdict, reasons, warns,
// reach and worse findings hashed. 1bf5252's sweep, its judge still its own, gives the same hash. T1 (D74's sampled
// side, about 1.5 s): a pass, a fail on one skeleton, a fail on both past the clip's own level, a warn only gen-0 adds,
// a side run, a 0.17 s aim, and the broken clip's nan. A deliberate change to the rows re-pins it, saying why.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, type Clip, type Key, type Rest } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { rigOf, sweepOne, type SweepRow } from "./sweep.ts";

const IDS = ["CMU_CURATED/Backflip", "CMU_CURATED/Run_Jump_Over", "MESH2MOTION/Slide_Exit", "QUATERNIUS_3D2DGE/Hit_Knockback", "QUATERNIUS_SHARDFALL/Pistol_Aim_Up", "STYLE100_SIDERUN/BentForward_SideRunLeft"];
/** A library clip by id, on its source's rest. */
function load(id: string): { clip: Clip; rest: Rest } {
  const [set, name] = id.split("/") as [string, string], dir = join(ROOT, "library/sets", set), clip = parseClip(readFileSync(join(dir, `${name}.json`), "utf8"));
  return { clip, rest: (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[clip.restSrc]!.rest };
}

describe("the sweep's rows", () => {
  it("are 1bf5252's, byte for byte, on a fixed sample (the judge moved to @m3a/tools)", async () => {
    const walk = load("QUATERNIUS_3D2DGE/Walk_Loop");
    const clips = [...IDS.map(load), { clip: { ...walk.clip, id: "BROKEN/Walk_Loop", keys: walk.clip.keys.map((k, i) => (i === 2 ? { ...k, hips: [Number.NaN, 0, 0] } : k)) as Key[] } as Clip, rest: walk.rest }];
    const rows: SweepRow[] = [];
    for (const rig of ["gen-0", "gen-7"]) {
      const b = await rigOf(rig);
      for (const c of clips) rows.push(sweepOne(c.clip, c.rest, b, rig));
    }
    // the verdicts, readable (a pair: pass or fail, its reasons and warns counted), then every byte
    expect(rows.map((r) => `${r.rig} ${r.clip.split("/")[1]} ${r.ok ? "pass" : "fail"} ${r.why.length} ${r.warns.length}`).join(", ")).toBe(
      "gen-0 Backflip fail 1 0, gen-0 Run_Jump_Over pass 0 1, gen-0 Slide_Exit pass 0 0, gen-0 Hit_Knockback fail 1 0, gen-0 Pistol_Aim_Up pass 0 0, gen-0 BentForward_SideRunLeft pass 0 0, gen-0 Walk_Loop fail 1 0, " +
        "gen-7 Backflip fail 1 0, gen-7 Run_Jump_Over pass 0 0, gen-7 Slide_Exit pass 0 0, gen-7 Hit_Knockback pass 0 0, gen-7 Pistol_Aim_Up pass 0 0, gen-7 BentForward_SideRunLeft pass 0 0, gen-7 Walk_Loop fail 1 0",
    );
    expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16), JSON.stringify(rows)).toBe("b4f51cf5d8276a36");
  }, 60_000);
});
