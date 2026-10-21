// Actions (WP-6.3, spec/ACTION.md): the library's six actions and its paired one are the schema's shape and check
// clean; each compiles into a valid clip with its beats and interrupt points as events, standing on the grounds its
// floor gives, the root curve rising or falling with them; each interrupt goes on into every clip it names, raised and
// turned; the checks name each problem with its code; a paired action meets its roles on their event; and on a body a
// ready-made gait outreaches (test characters), an action plays it fitted to the legs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bind } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { actions as A, clip as C, format, parseClip, procedural as PR, serialize, validate, type Clip, type Rest } from "../src/index.ts";
import type { Resolver } from "../src/recipe/types.ts";
import { sha256 } from "../src/recipe/sha256.ts";
import { RecipeError } from "../src/recipe/validate.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets"), DIR = join(ROOT, "library/actions");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as A.Action | A.PairedAction);
const SINGLE = FILES.filter((f): f is A.Action => !A.isPaired(f)), PAIRED = FILES.filter(A.isPaired);
const cache = new Map<string, { clip: Clip; rest: Rest; contentId: string }>(), compiled = new Map<string, A.CompiledAction>();
/** The library's clips by id, and its actions (ACTIONS/<Name>) compiled, as an interrupt may go on into one. */
const resolve: Resolver = Object.assign(
  (id: string) => {
    const action = SINGLE.find((a) => a.id === id);
    if (action) {
      const c = compiled.get(id) ?? A.compileAction(action, resolve);
      compiled.set(id, c);
      return { clip: c.clip, rest: c.rest, contentId: sha256(serialize(c.clip)) };
    }
    const [set, slug] = id.split("/") as [string, string], path = join(LIB, set, `${slug}.json`);
    if (!cache.has(id)) {
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
      const clip = parseClip(text), manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
      cache.set(id, { clip, rest: manifest.sources[clip.restSrc]!.rest, contentId: sha256(text) });
    }
    return cache.get(id);
  },
  { ids: () => [...cache.keys()] },
);
const action = (id: string): A.CompiledAction => (resolve(id), compiled.get(id)!);
const codes = (f: () => unknown): string[] => {
  try {
    f();
  } catch (e) {
    if (e instanceof RecipeError) return e.issues.map((i) => i.code);
    throw e;
  }
  return [];
};

describe("the library's actions", () => {
  it("are the schema's shape and check clean: six actions and a paired one", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    ajv.addSchema(JSON.parse(readFileSync(join(ROOT, "spec/schemas/recipe.schema.json"), "utf8")) as object);
    const schema = ajv.compile(JSON.parse(readFileSync(join(ROOT, "spec/schemas/action.schema.json"), "utf8")) as object);
    expect(SINGLE.map((a) => a.id)).toEqual(["ACTIONS/Climb_Up", "ACTIONS/Get_Up", "ACTIONS/Heavy_Landing", "ACTIONS/Hop_Down", "ACTIONS/Roll", "ACTIONS/Vault"]);
    expect(PAIRED.map((p) => p.id)).toEqual(["ACTIONS/Jab_And_Flinch"]);
    for (const f of FILES) {
      expect([f.id, schema(f), A.isPaired(f) ? A.validatePaired(f) : A.validateAction(f)]).toEqual([f.id, true, []]);
    }
  });
  it("compile into valid clips with their beats and interrupt points as events, on the grounds their floors give", () => {
    for (const a of SINGLE) {
      const c = action(a.id), events = c.clip.events ?? [];
      expect([a.id, validate(c.clip).errors]).toEqual([a.id, []]);
      for (const b of a.beats) expect([a.id, events.some((e) => e.name === b.name && Math.abs(e.t - b.from) < 1e-3)]).toEqual([a.id, true]);
      expect(events.filter((e) => e.name === "interrupt").map((e) => e.t)).toEqual(a.interrupts.map((i) => i.t));
      // the root curve: the clip's travel and turn, and the ground's height from where it started
      const [start, end] = [A.actionRootAt(c, 0), A.actionRootAt(c, c.clip.dur)];
      expect([a.id, Math.abs(start.up) <= 6, Math.abs(end.up - (a.floor ?? 0)) <= 6]).toEqual([a.id, true, true]);
    }
    // the climb's ground comes up to the ledge only as the feet leave the floor, the hop's down only as they land
    const climb = action("ACTIONS/Climb_Up"), hop = action("ACTIONS/Hop_Down"), ups = (c: A.CompiledAction) => c.track.times.map((t) => A.actionRootAt(c, t).up);
    const rising = ups(climb), falling = ups(hop);
    expect([rising.every((u, i) => i === 0 || u >= rising[i - 1]! - 1e-9), falling.every((u, i) => i === 0 || u <= falling[i - 1]! + 1e-9)]).toEqual([true, true]);
    expect([A.actionRootAt(climb, 0.1).up < 60, A.actionRootAt(hop, 0.3).up < -60]).toEqual([true, true]);
  });
  it("go on at each interrupt point into every clip it names, the action until then, raised and turned", () => {
    for (const a of SINGLE) {
      const c = action(a.id), [set, slug] = a.id.split("/") as [string, string];
      for (const at of a.interrupts) {
        expect([a.id, A.interruptAt(c, at.t - 0.05)]).toEqual([a.id, at]);
        // every target is played and read by the sensors in tools/sweep/actions.test.ts; here, the first
        for (const to of at.to.slice(0, 1)) {
          const x = A.interruptInto(c, at, to, { play: 1.5 });
          expect([a.id, to, validate(x.clip).errors, x.clip.id]).toEqual([a.id, to, [], `${set}/${slug}_To_${to.split("/")[1]}`]);
          // the action plays as it was up to the cut (the crossfade starts there), and the result goes on past it
          expect([a.id, to, JSON.stringify(x.clip.keys[0]!.hips) === JSON.stringify(c.clip.keys[0]!.hips), x.clip.dur > at.t]).toEqual([a.id, to, true, true]);
        }
      }
    }
    // after a climb the walk goes on raised onto the ledge: its own pelvis height, and the ground where it was cut
    const climb = action("ACTIONS/Climb_Up"), cut = climb.action.interrupts[0]!, walk = A.interruptInto(climb, cut, "PROCEDURAL/Walk"), last = walk.clip.keys[walk.clip.keys.length - 1]!.hips!;
    const own = climb.resolve("PROCEDURAL/Walk")!.clip.keys.map((k) => k.hips![2]!), mean = own.reduce((x, y) => x + y, 0) / own.length;
    expect([Math.abs(last[2]! - (mean + A.actionRootAt(climb, cut.t).up)) < 4, A.actionRootAt(climb, cut.t).up > 100]).toEqual([true, true]);
    expect(codes(() => A.interruptInto(climb, climb.action.interrupts[0]!, "NOWHERE/Nothing"))).toEqual(["R-E008"]);
    // a clip whose slug keeps "-" (MOTION.md §11) is a target too; the cut's own recipe id takes "_" for it (D118)
    const blast = A.interruptInto(climb, cut, "MESH2MOTION/Two-hand_Blast", { play: 1 });
    expect([validate(blast.clip).errors, blast.clip.id]).toEqual([[], "ACTIONS/Climb_Up_To_Two_hand_Blast"]);
    // played for 0.6 s, the target is cut there: the result ends that long after the crossfade begins (past its length,
    // all of it plays)
    const short = A.interruptInto(climb, cut, "PROCEDURAL/Walk", { play: 0.6 }), long = A.interruptInto(climb, cut, "PROCEDURAL/Walk", { play: 5 }), fade = Math.min(0.3, cut.t / 2);
    expect([short.clip.dur, long.clip.dur]).toEqual([Math.round((cut.t - fade + 0.6) * 1000) / 1000, walk.clip.dur]);
  }, 60_000);
  it("are cut where their feet stand: a foot on the ground at each point, both where its reason says so", () => {
    const X = new Float32Array(format.P * 3);
    for (const a of SINGLE) {
      const c = action(a.id);
      for (const at of a.interrupts) {
        format.decodePose(c.rest, format.keyAt(c.clip, at.t) as never, X);
        const ground = A.actionRootAt(c, at.t).up + c.start, feet = (["L", "R"] as const).map((s) => (Math.min(...C.sole(c.rest, X, s).map((q) => q.p[2])) / c.rest.H0) * 100 - ground);
        const down = feet.filter((h) => Math.abs(h) <= 2).length;
        expect([a.id, at.t, down >= (/both feet/.test(at.why) ? 2 : 1)]).toEqual([a.id, at.t, true]);
      }
    }
  });
  it("give a kept procedural part back on each resolver's own rest, not on an equal one another resolver made it on", () => {
    // T1's files share their modules (D125): a gait another file made on an equal rest is kept, its clip shared
    const climb = action("ACTIONS/Climb_Up"), twin = structuredClone(climb.rest), other = A.proceduralResolver(resolve, twin, climb.clip.restSrc);
    const first = other("PROCEDURAL/Walk")!, own = climb.resolve("PROCEDURAL/Walk")!, again = A.proceduralResolver(resolve, climb.rest, climb.clip.restSrc)("PROCEDURAL/Walk")!;
    expect([first.rest === twin, own.rest === climb.rest, again.rest === climb.rest, again.clip === first.clip, again.contentId === first.contentId]).toEqual([true, true, true, true, true]);
  });
  it("make procedural parts on the action's body, each with its content id", () => {
    const climb = action("ACTIONS/Climb_Up"), walk = climb.resolve("PROCEDURAL/Walk")!;
    expect([walk.clip.id, walk.rest === climb.rest, walk.contentId]).toEqual(["PROCEDURAL/Walk", true, sha256(serialize(walk.clip))]);
    expect([climb.resolve("PROCEDURAL/Nothing"), climb.resolve.ids!().includes("PROCEDURAL/Breathe")]).toEqual([undefined, true]);
    // a gait the body's legs reach is played as it is (fitGait returns it): the run on Mesh2Motion's rest, byte for byte
    const run = climb.resolve("PROCEDURAL/Run")!, plain = PR.gaitClip(PR.GAITS[2]!, climb.rest, { restSrc: climb.clip.restSrc, id: "PROCEDURAL/Run" });
    expect([PR.fitGait(PR.GAITS[2]!, climb.rest) === PR.GAITS[2], run.contentId]).toEqual([true, sha256(serialize(plain))]);
  });
});

describe("an action on another body", () => {
  it("plays a ready-made gait fitted to the legs: the run on test characters it outreaches, slowed to fit", async () => {
    // the run reaches past 72% of a leg on all but the tall test characters, where gaitClip refuses it; the resolver
    // fits each gait to the body first (fitGait), so an action that runs compiles there, its run at the speed the legs
    // take (D71, round 7; chibi, heroic, bulky, and the child without collarbones)
    const run = PR.GAITS[2]!, setOff: A.Action = {
      format: "2.0", id: "ACTIONS/Set_Off", desc: "Stands, then runs",
      steps: [{ as: "stand", op: "clip", id: "MESH2MOTION/Idle_A", to: 0.5 }, { as: "run", op: "clip", id: "PROCEDURAL/Run" }, { op: "sequence", items: ["stand", "run"], sync: "contacts" }],
      beats: [{ name: "stand", from: 0, to: 0.5 }, { name: "run", from: 0.5, to: 1 }],
      interrupts: [{ t: 0.5, to: ["PROCEDURAL/Walk"], why: "both feet down" }],
    };
    for (const seed of [0, 1, 2, 3]) {
      // each ready-made gait fitted to this body once (fitGait is a function of the gait and the rest alone), read below
      const rest = bind((await loadGlb(character(variant(seed)).glb, { textures: false })).scene).core.rest, fitted = new Map(PR.GAITS.map((x) => [x, PR.fitGait(x, rest)])), fit = fitted.get(run)!;
      expect([seed, fit.speed < run.speed]).toEqual([seed, true]);
      expect(() => PR.gaitClip(run, rest, { restSrc: `GEN${seed}` })).toThrow(/its feet reach .* past 72%/);
      // the library's clips on this body, as a host's resolver gives them
      const c = A.compileAction(setOff, (id) => { const r = resolve(id); return r && { ...r, rest }; });
      // after the 0.2 s fade the run alone, at the fitted speed (the root on whole % of the hip height: 1% over 0.5 s)
      const [from, to] = [A.actionRootAt(c, 0.5), A.actionRootAt(c, c.clip.dur)], speed = (to.forward - from.forward) / (c.clip.dur - 0.5);
      expect([seed, validate(c.clip).errors, c.clip.dur, Math.abs(speed - fit.speed) <= 2]).toEqual([seed, [], 1, true]);
      // each ready-made gait this body's legs don't take is the fitted one's clip, going its speed (one they take is
      // played as it is: the Mesh2Motion pin above)
      for (const g of PR.GAITS.filter((x) => fitted.get(x) !== x)) {
        const part = c.resolve(`PROCEDURAL/${g.name.charAt(0).toUpperCase()}${g.name.slice(1)}`)!, own = PR.gaitClip(fitted.get(g)!, rest, { restSrc: c.clip.restSrc, id: part.clip.id });
        expect([seed, g.name, validate(part.clip).errors, part.contentId, Math.abs(C.rootAt(part.clip, part.clip.dur).forward - fitted.get(g)!.speed * part.clip.dur) <= 0.5]).toEqual([seed, g.name, [], sha256(serialize(own)), true]);
      }
    }
  }, 30_000);
});

describe("an action's checks", () => {
  const climb = SINGLE.find((a) => a.id === "ACTIONS/Climb_Up")!, edit = (f: (a: A.Action) => void): A.Action => {
    const a = structuredClone(climb);
    f(a);
    return a;
  };
  it("name each problem with its code and a fix", () => {
    const cases: [string, unknown][] = [
      ["A-E001", null],
      ["A-E001", edit((a) => (a.beats = []))],
      ["A-E001", edit((a) => (a.interrupts = []))],
      ["A-E002", edit((a) => (a.beats[0]!.name = "Pull Up"))],
      ["A-E002", edit((a) => (a.beats[1]!.from = 0.1))],
      ["A-E002", edit((a) => (a.beats[0]!.to = 0))],
      ["A-E003", edit((a) => (a.interrupts[0]!.to = ["walk"]))],
      ["A-E003", edit((a) => (a.interrupts[0]!.why = ""))],
      ["A-E003", edit((a) => a.interrupts.push({ ...a.interrupts[0]! }))],
      ["A-E004", edit((a) => (a.steps = [{ op: "clip", id: "PROCEDURAL/Walk" }]))],
      ["R-E004", edit((a) => (a.floor = 900))],
      ["R-E007", edit((a) => ((a as unknown as Record<string, unknown>).ground = 1))],
    ];
    for (const [code, a] of cases) {
      const issues = A.validateAction(a);
      expect([code, issues.map((i) => i.code)]).toEqual([code, [code]]);
      expect(issues.every((i) => i.message.length > 0)).toBe(true);
    }
    expect(Object.keys(A.ACTION_RULES)).toEqual(["A-E001", "A-E002", "A-E003", "A-E004", "A-E005", "A-E006", "A-E007"]);
  });
  it("may name a clip whose slug has a hyphen to go on into, as the format allows (MOTION.md §11), the schema agreeing", () => {
    const ajv = new Ajv2020({ strict: false });
    ajv.addSchema(JSON.parse(readFileSync(join(ROOT, "spec/schemas/recipe.schema.json"), "utf8")) as object);
    const schema = ajv.compile(JSON.parse(readFileSync(join(ROOT, "spec/schemas/action.schema.json"), "utf8")) as object);
    const blast = edit((a) => (a.interrupts[0]!.to = ["MESH2MOTION/Two-hand_Blast"]));
    expect([A.validateAction(blast), schema(blast)]).toEqual([[], true]);
    // a paired action's own id is SET/Slug as a recipe's, without one
    expect(A.validatePaired({ ...PAIRED[0]!, id: "ACTIONS/Jab-And_Flinch" }).map((i) => [i.code, i.field])).toEqual([["A-E001", "id"]]);
  });
  it("find on compiling a beat past the end and feet off the ground the floor gives", () => {
    expect(codes(() => A.compileAction(edit((a) => (a.beats[1]!.to = 5)), resolve))).toEqual(["A-E005"]);
    let issue: { code: string; fix?: string } | undefined;
    try {
      A.compileAction(edit((a) => delete a.floor), resolve);
    } catch (e) {
      issue = (e as RecipeError).issues[0];
    }
    // the fix names the floor the feet show: the ledge the clip climbs onto
    expect([issue?.code, Math.abs(Number(/"floor": (-?\d+)/.exec(issue?.fix ?? "")?.[1]) - 115) <= 6]).toEqual(["A-E006", true]);
  });
});

describe("a paired action", () => {
  const pair = PAIRED[0]!;
  it("starts each role so their moments meet, the second placed in the first's frame", () => {
    const c = A.compilePaired(pair, resolve), { attacker, victim } = c.roles;
    const hit = (r: typeof attacker) => r!.start + r!.compiled.clip.events!.find((e) => e.name === "hit")!.t;
    expect([attacker!.start, Math.abs(hit(attacker) - hit(victim)) < 1e-9, c.dur]).toEqual([0, true, Math.max(attacker!.compiled.clip.dur, victim!.start + victim!.compiled.clip.dur)]);
    expect([attacker!.compiled.clip.id, victim!.compiled.clip.id]).toEqual(["ACTIONS/Jab_And_Flinch_Attacker", "ACTIONS/Jab_And_Flinch_Victim"]);
    const at = A.pairAt(c, hit(attacker));
    expect([at.victim!.time, at.victim!.root, at.attacker!.root.yaw]).toEqual([victim!.compiled.clip.events!.find((e) => e.name === "hit")!.t, { forward: 105, right: 0, yaw: 180 }, 0]);
  });
  it("names its problems: one role, a role without the event, a field it doesn't have", () => {
    const one = structuredClone(pair);
    delete one.roles.victim;
    expect(A.validatePaired(one).map((i) => i.code)).toEqual(["A-E001"]);
    expect(A.validatePaired({ ...pair, speed: 1 }).map((i) => i.code)).toEqual(["A-E007"]);
    const quiet = structuredClone(pair);
    quiet.roles.victim!.steps = [{ op: "clip", id: "MESH2MOTION/Hit_Head" }];
    expect(codes(() => A.compilePaired(quiet, resolve))).toEqual(["A-E005"]);
  });
});
