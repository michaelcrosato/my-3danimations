// Actions on the test characters (WP-6.3's Done-when, D72): each of the library's actions, and each role of its paired
// action, plays on the six skeletons gate G4 sweeps (gen-0 to gen-3, Quaternius' mannequin, KayKit's knight) with no
// row worse than on its own body and none failing; and each interrupt point goes on into every clip it names, a valid
// clip the sensors don't fail on its own body. The roles of a pair are separate clips, so each plays on any skeleton.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { actions as A, parseClip, serialize, validate, type Clip, type Rest } from "@m3a/core";
import { metrics } from "@m3a/sensors";
import { ROOT } from "../run/cli.ts";
import { rigOf, sweepOne } from "./sweep.ts";

// T1 plays them on two of the six (a generated body and a real rig); T2 (`npm run e2e`, M3A_FULL=1) on all six (D74)
const SIX = ["gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight"], RIGS = process.env.M3A_FULL === "1" ? SIX : ["gen-0", "kaykit-knight"];
const LIB = join(ROOT, "library/sets"), DIR = join(ROOT, "library/actions");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as A.Action | A.PairedAction);
const SINGLE = FILES.filter((f): f is A.Action => !A.isPaired(f)), PAIRED = FILES.filter(A.isPaired);
const clips = new Map<string, { clip: Clip; rest: Rest; contentId: string }>(), compiled = new Map<string, A.CompiledAction>();
/** The library's clips by id, and its actions compiled (an interrupt may go on into one). */
const resolve = Object.assign(
  (id: string) => {
    const action = SINGLE.find((a) => a.id === id);
    if (action) {
      const c = compiled.get(id) ?? A.compileAction(action, resolve);
      compiled.set(id, c);
      return { clip: c.clip, rest: c.rest, contentId: "" };
    }
    if (!clips.has(id)) {
      const [set, slug] = id.split("/") as [string, string];
      let text: string;
      try {
        text = readFileSync(join(LIB, set, `${slug}.json`), "utf8");
      } catch {
        return undefined;
      }
      const clip = parseClip(text), manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
      clips.set(id, { clip, rest: manifest.sources[clip.restSrc]!.rest, contentId: "" });
    }
    return clips.get(id);
  },
  { ids: () => [...clips.keys()] },
);
const action = (id: string): A.CompiledAction => (resolve(id), compiled.get(id)!);

describe("actions on the test characters", () => {
  it("each action and each paired role plays on the six skeletons (two in T1), no row worse than on its own body, none failing", async () => {
    const bound = await Promise.all(RIGS.map((r) => rigOf(r))), played: { id: string; clip: Clip; rest: Rest }[] = SINGLE.map((a) => ({ id: a.id, ...action(a.id) }));
    for (const p of PAIRED) for (const [name, r] of Object.entries(A.compilePaired(p, resolve).roles)) played.push({ id: `${p.id} ${name}`, clip: r.compiled.clip, rest: r.compiled.rest });
    expect(played).toHaveLength(8);
    for (const c of played) {
      RIGS.forEach((rig, i) => {
        const row = sweepOne(c.clip, c.rest, bound[i]!, rig);
        expect([c.id, rig, row.ok, row.played !== "fail"], row.why.join("; ")).toEqual([c.id, rig, true, true]);
      });
    }
  }, 120_000);
  it("each interrupt point goes on into every clip it names: a valid clip the sensors don't fail, read 1.5 s on", () => {
    let n = 0;
    for (const a of SINGLE) {
      const c = action(a.id);
      for (const at of a.interrupts) {
        for (const to of at.to) {
          // 1.5 s of the target is enough to read the cut (a breath lasts 6.8 s)
          const x = A.interruptInto(c, at, to, { play: 1.5 }), r = metrics(x.clip, x.rest);
          expect([a.id, at.t, to, validate(x.clip).errors, r.verdict === "fail"], r.findings.filter((f) => f.level === "fail").map((f) => `${f.metric}@${f.where}`).join(", ")).toEqual([a.id, at.t, to, [], false]);
          // it plays as the action did up to the cut, and goes on past it
          expect([x.clip.keys[0]!.hips, x.clip.dur > at.t, serialize(x.clip).length > 0]).toEqual([c.clip.keys[0]!.hips, true, true]);
          n++;
        }
      }
    }
    expect(n).toBe(14);
  }, 120_000);
});
