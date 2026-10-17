// Compose and wire (PLAN.md WP-7.2b §1, D93): a recipe compiled into a clip file under check-output/recipe.compile/ (its
// keys, fit, license and the sensors' verdict, or its coded issues), a graph checked against the clips the game sees
// (the library at its tiers, the user's WORKSHOP copies, and clips given: a compiled recipe's file, the user's own), and
// a script of game input run on a graph on a character (the tiny conformance rig by default; a mapping patch as
// retarget.inspect gives it, D93's one character parameter with it): its trace under
// check-output/graph.sim/, the states it went through, hit windows, travel, the sensors' read of the run, a filmstrip
// and the first difference from an expected trace. Recipes, graphs, scripts, traces and clips are each a file or JSON,
// named in replies as clips are (clips.ts naming); a clip the graph names that no one has gets a fix naming the closest
// id, the game.json line that opts in to its tier, the file to pass or the copy to make. A recipe or a script too long
// to build, a run costing too much (by what its graph holds: the clips its layers play at once, a blend's points, what
// its transitions test, its parameters; and, by a run without poses first, what its fades play out), and a clip
// holding a foot too long (judge.ts MAX_HOLD) are refused before they run. Issues come as rows (code, where, message,
// fix), at most 20; every capped list's cut is counted in the data's `more` ({issues: 5}) and in a more line.
import { graph as G, playable, recipe, serialize, type AnimClip, type Clip, type Rest } from "@m3a/core";
import { LibraryError, withFacts } from "@m3a/library";
import { metrics } from "@m3a/sensors";
import { defineTool, ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { quote, type Schema } from "../registry/schema.ts";
import { compareTraces, filmstrip, simulate, traceText, validateScript, type SimScript, type Trace } from "../sim/index.ts";
import { bodyOf, CHARACTER, characterName, MAPPING, type MappingPatch } from "./body.ts";
import { boundHolds } from "./judge.ts";
import { bounded, clipResolver, fits, given, loadClip, naming, prose, refusal, suggestId, type ClipRef } from "./clips.ts";
import { call, capped, count, cut, fileOrJson, mm, more, output, round, sec } from "./common.ts";
import { WORKSHOP } from "./workshop.ts";

/** A recipe, graph or script parameter. */
const DOC: Schema = { type: "string", description: "file or JSON" };
/** The clips parameter: clips a graph names that the game's library lacks (a compiled recipe's file, the user's own). */
const CLIPS: Schema = { type: "array", items: { type: "string" }, description: "clip files the library lacks" };
/** The most clips one call takes. */
const MAX_CLIPS = 64;
/** The most steps graph.sim runs: the longest script (600 s) at the default 60 steps a second. */
const MAX_STEPS = 36_000;
/**
 * The most points one blend space graph.sim plays takes. A blend of two parameters weighs each point against every
 * other (core's weights2D) several times a step, so its cost grows with the square of its points; unbounded, the
 * verifier's 1D blend of 1,000 points took 16.8 s for 3,600 steps and one of 100,000 ran past 10 minutes (each point is
 * also a clip played, MAX_CLIP_STEPS). 25 points make an 8-way, 3-speed space with its idle.
 */
const MAX_BLEND_POINTS = 64;
/**
 * The most clip steps graph.sim poses: each layer the clips its widest state plays at once (a blend's points, every one
 * of which may weigh in a blend of two parameters; 1 at least), times the steps, and the states its fades play out
 * (`faded`): 4 clips at once for the longest script, as Locomotion's 3-point blend and its upper layer. Each clip a
 * step is posed, its feet planted, and costs most with a clip holding both feet 15 s (judge.ts MAX_HOLD's most:
 * QUATERNIUS_3D2DGE/Idle_Loop retimed), about twice a walk's. Measured here at this limit (on tiny, 36,000 steps, the
 * run without poses and start-up included, other lanes' tests running): 45.5 s with walks and jogs (two layers of a
 * walk-jog blend, both weighed), 136 s with 4 such held clips (a 2D blend of Idle_Loop retimed to 12 to 15 s, every
 * point weighed; the verifier's 4 layers of one, 118 s). Past it only where one held clip plays at several times at
 * once (a state left every step for one sharing its clip, each fade cut): the Animator's pose cache clears at 1,024
 * poses a clip (animator.ts:692), so each step decodes its holds again, about 6 times the cost (40 ms a step for one
 * clip at once against 1.1), reported to core.
 */
const MAX_CLIP_STEPS = 4 * MAX_STEPS;
/**
 * How many states a layer's fade plays out at once when its fades may be cut (an interruptible transition): core's
 * MAX_OUT (graph/run.ts); one when they may not, its fade played out first.
 */
const FADING = 4;
/**
 * The most transition terms graph.sim tests (each transition 1, plus each of its conditions and each state its `from`
 * lists: every layer's transitions are read each step, each term in turn), times the steps: 1,000 terms for the longest
 * script. Measured here, 20,000 transitions never taken added 3.6 s to a 3,600-step run (about 0.05 µs each a step),
 * and one of 200,001 conditions 12 s (about 0.017 µs a condition), so a graph near io's 64 MB text limit on a 600 s
 * script would take about 20 minutes. At this limit, about 2 s.
 */
const MAX_TRANSITION_STEPS = 1000 * MAX_STEPS;
/**
 * The most parameter reads graph.sim makes: each step every parameter (stride warping reads its parameter through the
 * Animator's `graph`, which copies them all; triggers set age each step), and each again for every number the script
 * eases in (a row's `over`): 100 parameters for the longest script. Measured here, 200,000 parameters on a warped
 * script took 100 ms a step (0.5 µs a parameter); at this limit, about 2 s.
 */
const MAX_PARAM_READS = 100 * MAX_STEPS;

/** An issue of a recipe, graph or script: its code, where, what is wrong and the fix. */
type Issue = recipe.RecipeIssue;
/** Whether `v` is a JSON object (not an array). */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** A time span with 3 decimals: "0.217–0.300 s". */
const span = (t0: number, t1: number) => `${round(t0, 3).toFixed(3)}–${sec(t1)}`;
/** An issue as a row: its code, where (step, field), what is wrong and the fix, each cut to a row's 90 characters. */
const row = (i: Issue) => ({ code: i.code, step: i.step ?? null, field: i.field ?? null, message: cut(i.message), fix: i.fix === undefined ? null : cut(i.fix) });
/** An issue as one line, its fix after it. */
const line = (i: Issue) => `${i.code}${i.step === undefined ? "" : ` step ${i.step}`}${i.field ? ` ${i.field}` : ""}: ${i.message}${i.fix ? `; fix: ${i.fix}` : ""}`;
/** Issues as a reply shows them: at most 20 rows, a line each, the more line. */
function issued(issues: readonly Issue[]): { rows: ReturnType<typeof row>[]; lines: string[]; more?: number } {
  const shown = capped(issues, 20);
  return { rows: shown.rows.map(row), lines: [...shown.rows.map(line), ...more(shown.more, "issue")], ...(shown.more ? { more: shown.more } : {}) };
}
/** The data's `more`, one shape in every reply: how many each capped list's cap cut ({issues: 5}), there when one did. */
function cuts(lists: Record<string, { more?: number }>): { more?: Record<string, number> } {
  const m = Object.fromEntries(Object.entries(lists).flatMap(([k, c]) => (c.more ? [[k, c.more]] : [])));
  return Object.keys(m).length ? { more: m } : {};
}
/** The WORKSHOP ids among a document's strings (the user's copies a graph's states name, wherever its shape has them). */
const workshopIds = (v: unknown): string[] => (typeof v === "string" ? (v.startsWith(`${WORKSHOP}/`) ? [v] : []) : v && typeof v === "object" ? Object.values(v).flatMap(workshopIds) : []);

/** A document given as a file or JSON (common.ts fileOrJson), with its id (null when it has none) and how replies name
 *  it (clips.ts naming): `as` as a hint's positional, `flag` as its flag, `title` in a verdict (without an id, `as` in
 *  prose: "the graph's JSON", "the script's file", or the path as given). */
async function docOf(ctx: ToolContext, value: string, what: string) {
  const d = await fileOrJson(ctx, value, `the ${what}`), id = isObj(d.data) && typeof d.data.id === "string" ? d.data.id : null;
  const n = naming({ id: id ?? "", where: d.path === null ? "text" : "file", path: d.path, name: null }, `the ${what}'s`);
  return { ...d, id, as: n.as, flag: given(n.as, value), title: id === null ? prose(n.as) : n.title };
}

/** A library clip the game sees (a deprecated id's successor, warned), or undefined; a tampered set refused (an error). */
function libraryClip(lib: LibraryAccess, id: string): { clip: Clip; rest: Rest } | undefined {
  try {
    return lib.library.clip(id);
  } catch (err) {
    if (!(err instanceof LibraryError)) throw err;
    if (err.code === "E_TAMPERED") throw refusal(err, id);
    return undefined;
  }
}

/** The clips a layer's widest state plays at once: a blend's points, a clip state's one; 1 at least (a layer of pass
 *  states still steps). */
const widest = (L: G.GraphLayer): number => Object.values(L.states).reduce((w, s) => Math.max(w, G.clipsOf(s).length), 1);
/** What a transition costs each step its layer reads it: 1, each condition, each state its `from` lists. */
const terms = (t: G.GraphTransition): number => 1 + (t.when?.length ?? 0) + (Array.isArray(t.from) ? t.from.length : 0);
/** A refusal of a run too costly: usage (the document's to change), saying what to cut. */
const costly = (what: string, cut: string) => new ToolError("E_ARGS", `${what}: ${cut}, or shorten dur or lower rate`, true);

/**
 * What a run of `n` steps costs graph.sim by what its graph (checked) and script hold, refused (E_ARGS) at the first
 * past its bound, before anything runs: a blend of more than MAX_BLEND_POINTS points, the clips its layers play at once
 * (MAX_CLIP_STEPS, fades aside), the transition terms it tests (MAX_TRANSITION_STEPS), its parameter reads
 * (MAX_PARAM_READS). Each refusal names the numbers it multiplies.
 */
export function runCost(layers: readonly G.GraphLayer[], params: number, script: SimScript, n: number): void {
  for (const [i, L] of layers.entries()) {
    for (const [name, s] of Object.entries(L.states)) {
      const points = s.blend?.points.length ?? 0;
      if (points > MAX_BLEND_POINTS) throw new ToolError("E_ARGS", `${i ? `layers.${i - 1}.` : ""}states.${name}.blend has ${points} points, past the ${MAX_BLEND_POINTS} one blend graph.sim plays takes: use fewer points`, true);
    }
  }
  const clips = layers.reduce((c, L) => c + widest(L), 0), tests = layers.reduce((c, L) => c + L.transitions.reduce((t, x) => t + terms(x), 0), 0);
  if (clips * n > MAX_CLIP_STEPS) throw costly(`the run plays ${clips} clips at once (each layer's widest state: a blend's points) × ${n} steps, past the ${MAX_CLIP_STEPS} clip steps graph.sim takes (${MAX_CLIP_STEPS / MAX_STEPS} clips × ${MAX_STEPS} steps)`, "use fewer layers or blend points");
  if (tests * n > MAX_TRANSITION_STEPS) throw costly(`the run tests ${tests} transition terms (each transition 1, and its conditions and the states it is from) × ${n} steps, past the ${MAX_TRANSITION_STEPS} graph.sim takes (${MAX_TRANSITION_STEPS / MAX_STEPS} terms × ${MAX_STEPS} steps)`, "use fewer transitions or conditions");
  const eased = (isObj(script) && Array.isArray(script.input) ? script.input : []).reduce((e, r) => e + (isObj(r) && typeof r.over === "number" && r.over > 0 && isObj(r.set) ? Object.values(r.set).filter((v) => typeof v === "number").length : 0), 0);
  if (params * (n + eased) > MAX_PARAM_READS) throw costly(`the run reads ${params} parameters ${n + eased} times (each step, and each number the script eases in), past the ${MAX_PARAM_READS} parameter reads graph.sim takes (${MAX_PARAM_READS / MAX_STEPS} parameters × ${MAX_STEPS} steps)`, "use fewer parameters");
}

/**
 * The clip steps a run's fades add, by a run without poses (its states entered, each layer's at most every step): a
 * layer's fade plays out up to FADING states (1 when no transition of it may cut a fade) of its widest, for each step
 * within its longest fade (core's 0.2 s when a transition gives none) of a state entered. Refused (E_ARGS) when they
 * and the clips its layers play pass MAX_CLIP_STEPS.
 */
function faded(layers: readonly G.GraphLayer[], entered: readonly { layer: string; from: string | null }[], n: number, rate: number): void {
  const by = new Map<string, number>();
  for (const e of entered) if (e.from !== null) by.set(e.layer, (by.get(e.layer) ?? 0) + 1);
  let steady = 0, extra = 0;
  for (const L of layers) {
    const fade = L.transitions.reduce((f, t) => Math.max(f, Math.ceil((t.fade ?? 0.2) * rate)), 0), out = L.transitions.some((t) => t.interruptible === true) ? FADING : 1;
    steady += widest(L) * n;
    extra += widest(L) * out * Math.min(n, (by.get(L.name) ?? 0) * fade);
  }
  const takes = entered.filter((e) => e.from !== null).length;
  if (steady + extra > MAX_CLIP_STEPS) throw costly(`the run plays ${steady} clip steps, and its fades (${takes} transitions taken) up to ${extra} more, past the ${MAX_CLIP_STEPS} clip steps graph.sim takes (${MAX_CLIP_STEPS / MAX_STEPS} clips × ${MAX_STEPS} steps)`, "take fewer transitions, or shorter fades");
}

/** A G-E009 (a clip neither the library at the game's tiers, the workshop nor the clips given have) with the fix that
 *  finds it: the copy to make (a WORKSHOP id), its file in clips (a set the library hasn't, a compiled recipe's), the
 *  game.json line for its tier (a clip the set has that the game doesn't see), or the closest id. */
function missing(lib: LibraryAccess, i: Issue): Issue {
  const id = /^clip (\S+) is not/.exec(i.message)?.[1] ?? "", [set = "", name = ""] = id.split("/");
  if (set === WORKSHOP) return { ...i, fix: `no such copy: \`fix <a library clip> --save_as ${id}\` makes it` };
  if (!lib.source.sets().includes(set)) return { ...i, fix: "pass its clip file in clips (recipe.compile writes a recipe's)" };
  const tier = lib.library.about(set).tier;
  if (lib.source.files(set).includes(`${name}.json`) && !fits(tier, lib.tiers)) return { ...i, fix: `add "${tier}" to "tiers" in game.json (${set} is a ${tier} set; this game sees ${lib.tiers.join(", ")})` };
  const near = suggestId(lib, id);
  return near ? { ...i, fix: `did you mean ${quote(near)}? or pass its clip file in clips` } : i;
}

/** A graph (file or JSON) and the clips it may play: `clips` loaded, each by its own id, and the WORKSHOP copies it
 *  names (one that isn't there is its G-E009), over the library at the game's tiers; its issues (core's validateGraph),
 *  each missing clip's fix the one that finds it; and `clips` as hints give them (clips.ts naming: no JSON or absolute
 *  path, a relative path as given), undefined when none was. */
async function graphOf(ctx: ToolContext, value: string, clips: readonly string[] = []) {
  if (clips.length > MAX_CLIPS) throw new ToolError("E_ARGS", `clips takes at most ${MAX_CLIPS} clips, not ${clips.length}`, true);
  const d = await docOf(ctx, value, "graph"), lib = ctx.library(), own = new Map<string, ClipRef>(), named: string[] = [];
  for (const c of clips) {
    const r = await loadClip(ctx, c), as = naming(r).as;
    own.set(r.id, r);
    named.push(r.where === "file" && !as.startsWith("<") ? r.path! : as);
  }
  for (const id of new Set(workshopIds(d.data))) {
    const r = own.has(id) ? undefined : await loadClip(ctx, id).catch((err: unknown) => {
      if (err instanceof ToolError && err.code === "E_NO_CLIP") return undefined;
      throw err;
    });
    if (r) own.set(id, r); // by the id the graph names, as clipResolver keys a recipe's
  }
  const seen = new Set(lib.library.catalog().map((r) => r.id)), find = (id: string) => own.get(id) ?? libraryClip(lib, id);
  const issues = G.validateGraph(d.data, { clips: (id) => seen.has(id) || find(id) !== undefined }).map((i) => (i.code === "G-E009" ? missing(lib, i) : i));
  return { ...d, graph: d.data as G.Graph, issues, find, clips: named.length ? named : undefined };
}

/** `recipe.compile`: a recipe compiled into a clip file (its facts measured), or its coded issues; one too long to
 *  build refused. */
export const recipeCompile = defineTool<{ recipe: string }, unknown>({
  name: "recipe.compile",
  description: "Compile a recipe (file or JSON) into a clip file: keys, fit, license, metrics; or coded issues with fixes.",
  params: { type: "object", properties: { recipe: DOC }, required: ["recipe"] },
  output: output({ id: "string?", path: "string?", line: "string?", dur: "number?", loop: "boolean?", fps: "number?", keys: "integer?", fit: "array?", license: "string?", credit: "string?", sources: "array", sha256: "string?", events: "integer?", contacts: "integer?", metrics: "object?", issues: "array" }),
  positionals: ["recipe"],
  examples: [{ args: { recipe: "spec/recipes/Jab_Left.json" } }],
  async run(a, ctx) {
    const d = await docOf(ctx, a.recipe, "recipe"), r = d.data as recipe.Recipe, lib = ctx.library();
    let issues = recipe.validateRecipe(r), made: recipe.Compiled | null = null;
    if (!issues.length) {
      try {
        // its clips (a tampered set refused, as graph.sim refuses one) bound its length before compile builds it
        const resolve = await clipResolver(ctx, r.steps.flatMap((s) => (s.op === "clip" ? [String(s.id)] : [])));
        bounded(r, (id) => libraryClip(lib, id)?.clip ?? resolve(id)?.clip);
        made = recipe.compile(r, resolve);
      } catch (err) {
        // a library clip of a tier the game hasn't opted in to: refused as every tool refuses one, naming the game.json line
        if (err instanceof LibraryError) throw refusal(err, err.clip ?? "", lib);
        if (!(err instanceof recipe.RecipeError)) throw err;
        issues = [...err.issues];
      }
    }
    if (!made) {
      const x = issued(issues);
      return {
        verdict: `recipe.compile ${d.title}: FAIL, ${count(issues.length, "issue")}`,
        data: { id: d.id, path: null, line: null, dur: null, loop: null, fps: null, keys: null, fit: null, license: null, credit: null, sources: [], sha256: null, events: null, contacts: null, metrics: null, issues: x.rows, ...cuts({ issues: x }) },
        lines: x.lines,
        findings: true,
        next: `fix each issue as its fix says, then ${call("recipe.compile", [d.as])} again`,
      };
    }
    // the clip as the library writes one, its facts and contacts measured (a strike the simulation looks for a hit at),
    // named .clip.json so no report.json (the CLI's --json) takes its place
    const clip = withFacts(made.clip, made.rest), text = serialize(clip), path = ctx.write(`check-output/recipe.compile/${clip.id.split("/")[1]}.clip.json`, text);
    const m = metrics(clip, made.rest), p = clip.provenance, [mean, worst] = clip.quality.fit, found = capped(m.findings, 3);
    const contacts = Object.values(clip.contacts ?? {}).reduce((n: number, v) => n + (Array.isArray(v) ? v.length : 0), 0);
    return {
      verdict: `recipe.compile ${d.title}: ${clip.id}, ${sec(clip.dur)} ${clip.loop ? "loop" : "once"}, ${count(clip.keys.length, "key")}, fit ${mean}/${worst} mm (mean/worst), ${p.license}; metrics ${m.verdict.toUpperCase()}`,
      data: {
        id: clip.id, path, line: recipe.describeRecipe(r), dur: clip.dur, loop: clip.loop, fps: clip.fps, keys: clip.keys.length, fit: [mean, worst], license: p.license, credit: p.credit ?? null,
        sources: made.track.sources, sha256: recipe.sha256(text), events: clip.events?.length ?? 0, contacts, metrics: { verdict: m.verdict, findings: m.findings.length }, issues: [],
      },
      lines: [
        `wrote ${path}: a graph state names it ${clip.id}, the file given in clips`,
        ...(p.credit ? [`credit owed (${p.license}): ${p.credit}; ${call("license.check", [], { clips: [path] })} gives the credits block`] : []),
        ...found.rows.map((f) => cut(`${f.level} ${f.metric} at ${sec(f.t0)}: ${f.message}`)),
        ...more(found.more, "finding", `${call("metrics", [path])} lists them`),
      ],
      next: `${call("sheet", [path])} shows it, ${call("metrics", [path])} measures it; graph.sim plays it with the file in clips`,
    };
  },
});

/** `graph.validate`: a graph's coded issues against the clips the game sees, or its layers, parameters and clips. */
export const graphValidate = defineTool<{ graph: string; clips?: string[] }, unknown>({
  name: "graph.validate",
  description: "Check a graph (file or JSON): coded issues with fixes; its layers, parameters and clips.",
  params: { type: "object", properties: { graph: DOC, clips: CLIPS }, required: ["graph"] },
  output: output({ id: "string?", ok: "boolean", issues: "array", layers: "array", parameters: "object", clips: "integer", licenses: "object" }),
  positionals: ["graph"],
  examples: [{ args: { graph: "spec/graphs/Locomotion.json" } }],
  async run(a, ctx) {
    const g = await graphOf(ctx, a.graph, a.clips), ok = !g.issues.length, x = issued(g.issues);
    // its shape, once it checks (a malformed graph's issues say what is wrong): each layer and the parameters' types (at
    // most 20 of each), and the clips its states name with their licenses
    const all = ok ? G.layersOf(g.graph).map((L) => ({ name: L.name, start: L.start, states: Object.keys(L.states).length, transitions: L.transitions.length })) : [];
    const layers = capped(all, 20), parameters = capped(ok ? Object.entries(g.graph.parameters ?? {}).map(([k, p]) => [k, p.type] as const) : [], 20);
    const ids = ok ? [...new Set(G.layersOf(g.graph).flatMap((L) => Object.values(L.states).flatMap(G.clipsOf)))] : [], licenses: Record<string, number> = {};
    for (const id of ids) ((l) => (licenses[l] = (licenses[l] ?? 0) + 1))(g.find(id)!.clip.provenance.license);
    const n = (k: "states" | "transitions") => all.reduce((s, L) => s + L[k], 0), lic = Object.entries(licenses).map(([l, k]) => `${k} ${l}`).join(", ");
    return {
      verdict: `graph.validate ${g.title}: ${ok ? `PASS, ${count(all.length, "layer")}, ${count(n("states"), "state")}, ${count(n("transitions"), "transition")}, ${count(ids.length, "clip")} (${lic})` : `FAIL, ${count(g.issues.length, "issue")}`}`,
      data: { id: g.id, ok, issues: x.rows, layers: layers.rows, parameters: Object.fromEntries(parameters.rows), clips: ids.length, licenses, ...cuts({ issues: x, layers, parameters }) },
      lines: [
        ...x.lines,
        ...layers.rows.map((L) => `layer ${L.name}: starts at ${L.start}, ${count(L.states, "state")}, ${count(L.transitions, "transition")}`),
        ...more(layers.more, "layer"), ...more(parameters.more, "parameter"),
      ],
      findings: !ok,
      next: ok ? `${call("graph.sim", [g.as], { script: "<script>", clips: g.clips })} runs it as a game would (spec/SIM.md)` : `fix each issue as its fix says, then ${call("graph.validate", [g.as], { clips: g.clips })} again`,
    };
  },
});

/** `graph.sim`: a script of game input run on a graph and a character; its trace written, compared with an expected one;
 *  a run too long to take (its steps, layer steps or transition steps), or a clip its states name holding a foot past
 *  MAX_HOLD (judge.ts), refused. */
export const graphSim = defineTool<{ graph: string; script: string; character: string; expect?: string; clips?: string[]; mapping?: MappingPatch }, unknown>({
  name: "graph.sim",
  description: "Run a game-input script on a graph: states, events, hit windows, travel, sensors, filmstrip; diffs an expected trace.",
  params: { type: "object", properties: { graph: DOC, script: DOC, character: { ...CHARACTER, default: "tiny" }, mapping: MAPPING, expect: { type: "string", description: "expected trace file" }, clips: CLIPS }, required: ["graph", "script"] },
  output: output({ script: "string?", graph: "string?", character: "string", steps: "integer", states: "array", events: "integer", hits: "array", went: "object?", rate: "array?", sensors: "object?", findings: "array", warnings: "array", trace: "string?", matches: "boolean?", diff: "string?", issues: "array" }),
  positionals: ["graph"],
  examples: [{ args: { graph: "spec/graphs/Locomotion.json", script: "spec/sims/Walk_In_Place.json" }, expect: "findings" }],
  async run(a, ctx) {
    // every refusal first (a document, a clip, the character, a run too long), then the issues, then the run
    const g = await graphOf(ctx, a.graph, a.clips), s = await docOf(ctx, a.script, "script"), want = a.expect === undefined ? null : await docOf(ctx, a.expect, "expected trace");
    const trace = (t: unknown): t is Trace => isObj(t) && ["states", "events", "hits"].every((k) => Array.isArray(t[k]));
    if (want && !trace(want.data)) throw new ToolError("E_JSON", "the expected trace is not one: give a trace.json graph.sim wrote (spec/SIM.md §2)", want.path === null);
    // the character as a hint names it (characterName) and as prose does (`who`: the verdict, data), and body.ts's refusals
    const character = characterName(a.character), who = prose(character), script = s.data as SimScript, body = await bodyOf(ctx, a.character, a.mapping);
    const at = isObj(script) && typeof script.rate === "number" ? script.rate : 60, n = isObj(script) && typeof script.dur === "number" ? Math.round(script.dur * at) : 0;
    if (n > MAX_STEPS) throw new ToolError("E_ARGS", `the script runs ${n} steps (dur ${script.dur} s at rate ${at}), past the ${MAX_STEPS} graph.sim takes: shorten dur or lower rate`, s.path === null);
    // the run's cost, once the graph checks: what its graph and script hold (runCost), each read every step
    const Ls = g.issues.length ? [] : G.layersOf(g.graph);
    if (Ls.length) runCost(Ls, Object.keys(g.graph.parameters ?? {}).length, script, n);
    const again = (expect = want?.flag) => call("graph.sim", [g.as], { script: s.flag, character: a.character === "tiny" ? undefined : given(character, a.character), mapping: a.mapping, clips: g.clips, expect });
    const cache = new Map<string, AnimClip | undefined>(), clips = (id: string) => {
      if (!cache.has(id)) cache.set(id, ((c) => c && playable(c.clip, c.rest))(g.find(id)));
      return cache.get(id);
    };
    // no clip a state names holds a foot past MAX_HOLD as it plays (once the graph checks: its clips are then found)
    for (const id of new Set(Ls.flatMap((L) => Object.values(L.states).flatMap(G.clipsOf)))) ((c) => c && boundHolds(c, id))(clips(id));
    const issues = [...g.issues, ...validateScript(script, g.issues.length ? undefined : g.graph)], x = issued(issues);
    const none = { script: s.id, graph: g.id, character: who, steps: 0, states: [], events: 0, hits: [], went: null, rate: null, sensors: null, findings: [], warnings: [], trace: null, matches: null, diff: null };
    if (issues.length) return { verdict: `graph.sim ${s.title} on ${who}: FAIL, ${count(issues.length, "issue")}; not run`, data: { ...none, issues: x.rows, ...cuts({ issues: x }) }, lines: x.lines, findings: true, next: `fix each issue as its fix says, then ${again()} again` };
    // the states it enters, by a run without poses (a few percent of one with them: the same steps and transitions),
    // bound what its fades play out before the run that poses every step
    faded(Ls, simulate({ graph: g.graph, script, body: body.bound, clips, poses: false }).trace.states, n, at);
    const run = simulate({ graph: g.graph, script, body: body.bound, clips }), tr = run.trace, name = tr.script.split("/")[1]!, frames = script.film ?? 8;
    const written = ctx.write(`check-output/graph.sim/${name}.trace.json`, traceText(tr)), film = frames > 0 && run.frames.length > 0;
    if (film) ctx.image(name, filmstrip(run, frames));
    const diff = want ? compareTraces(want.data as Trace, tr) : null, sens = run.sensors, last = run.path.at(-1) ?? { forward: 0, right: 0, yaw: 0 };
    const entered = tr.states.filter((e) => e.from !== null), path = [...tr.states.filter((e) => e.from === null && e.layer === "base"), ...entered].map((e) => (e.layer === "base" ? e.state : `${e.layer}:${e.state}`));
    const [states, hits, found, warned] = [capped(entered, 20), capped(tr.hits, 10), capped(sens?.findings ?? [], 5), capped(run.warnings, 5)];
    const rates = run.rates.map((r) => r.rate), rate = rates.length ? [round(Math.min(...rates), 2), round(Math.max(...rates), 2)] : null;
    const total = sens?.findings.length ?? 0, failing = sens?.findings.filter((f) => f.level === "fail").length ?? 0;
    const said = sens ? `sensors ${sens.verdict.toUpperCase()}${total ? ` (${failing} fail, ${total - failing} warn)` : ""}, slide ${mm(sens.slide)}` : "no sensors (one step)";
    // the one way to hold later runs to this trace: a copy out of check-output/, which the next run overwrites
    const keep = `copy ${written} out of check-output/ (the next run overwrites it) and pass the copy: ${again("<copy>")}`, seen = film ? " (the filmstrip shows it)" : "";
    return {
      verdict: `graph.sim ${s.title} on ${who}: ${tr.steps} steps, ${cut(path.join(" > "), 60)}; ${count(tr.events.length, "event")}, ${count(tr.hits.length, "hit window")}; ${said}; went ${mm(last.forward)}${want ? `; trace ${diff === null ? "matches" : "differs"}` : ""}`,
      data: {
        ...none, steps: tr.steps, events: tr.events.length, trace: written, matches: want ? diff === null : null, diff, issues: [],
        states: states.rows.map((e) => ({ t: round(e.t, 3), layer: e.layer, state: e.state, from: e.from })), hits: hits.rows.map((h) => ({ t0: round(h.t0, 3), t1: round(h.t1, 3), layer: h.layer, state: h.state, clip: h.clip })),
        went: { forward: round(last.forward), right: round(last.right), yaw: round(last.yaw) }, rate, sensors: sens && { verdict: sens.verdict, slide: round(sens.slide), skate: sens.skate },
        findings: found.rows.map((f) => ({ metric: f.metric, level: f.level, t0: round(f.t0, 3), t1: round(f.t1, 3), where: f.where ?? null, message: cut(f.message) })), warnings: warned.rows.map((w) => cut(w)),
        ...cuts({ states, hits, findings: found, warnings: warned }),
      },
      lines: [
        ...warned.rows, ...more(warned.more, "warning"),
        ...(diff === null ? [] : [`trace differs: ${diff}`]),
        ...found.rows.map((f) => `${f.level.toUpperCase()} ${f.metric}: ${cut(f.message)}`), ...more(found.more, "finding", "fix these, then run it again"),
        ...hits.rows.map((h) => `hit ${span(h.t0, h.t1)} ${h.layer}:${h.state} ${h.clip}`), ...more(hits.more, "hit window", "the trace has them all"), ...more(states.more, "state change", "the trace has them all"),
        `went ${mm(last.forward)} forward, ${mm(last.right)} right, turned ${round(last.yaw)}°${rate ? `; stride warped ${rate[0]}–${rate[1]}×` : ""}`,
      ],
      findings: diff !== null || run.warnings.length > 0 || sens?.verdict === "fail",
      next: diff !== null ? `the first difference is above: fix the graph or the script, then ${again()} again; if this run is the right one, ${keep}`
        : run.warnings.length ? `give each strike a hit event (a recipe's events step, then recipe.compile), then ${again()} again`
        : sens?.verdict === "fail" ? `each finding names its time, and the states rows what played then${seen}; fix the graph, then ${again()} again`
        : want ? `the trace matches; before shipping, ${call("license.check")} checks game.json's clips and gives the credits block`
        : `${film ? "the filmstrip shows the run; " : ""}to hold later runs to this trace, ${keep}`,
    };
  },
});
