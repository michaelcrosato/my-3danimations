// Compose and wire (PLAN.md WP-7.2b §1, D93): a recipe compiled into a clip file under check-output/recipe.compile/ (its
// keys, fit, license and the sensors' verdict, or its coded issues), a graph checked against the clips the game sees
// (the library at its tiers, and clips given: a compiled recipe's file, the user's own), and a script of game input run
// on a graph on a character (the tiny conformance rig by default): its trace under check-output/graph.sim/, the states
// it went through, hit windows, travel, the sensors' read of the run, a filmstrip and the first difference from an
// expected trace. Recipes, graphs, scripts and traces are each a file or JSON, named in replies as clips are (clips.ts
// naming); a clip the graph names that no one has gets a fix naming the closest id, the game.json line that opts in
// to its tier, or the file to pass. Issues come as rows (code, where, message, fix), at most 20.
import { graph as G, playable, recipe, serialize, type AnimClip, type Clip, type Rest } from "@m3a/core";
import { LibraryError, withFacts } from "@m3a/library";
import { metrics } from "@m3a/sensors";
import { defineTool, ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { quote, type Schema } from "../registry/schema.ts";
import { compareTraces, filmstrip, simulate, traceText, validateScript, type SimScript, type Trace } from "../sim/index.ts";
import { bodyOf, CHARACTER } from "./body.ts";
import { clipResolver, loadClip, naming, refusal, suggestId, type ClipRef } from "./clips.ts";
import { absolute, call, capped, count, cut, fileOrJson, mm, more, output, round, sec } from "./common.ts";

/** A recipe, graph or script parameter. */
const DOC: Schema = { type: "string", description: "file or JSON" };
/** The clips parameter: clips a graph names that the game's library lacks (a compiled recipe's file, the user's own). */
const CLIPS: Schema = { type: "array", items: { type: "string" }, description: "clip files the library lacks" };
/** The most clips one call takes. */
const MAX_CLIPS = 64;

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

/** A document given as a file or JSON (common.ts fileOrJson), with its id (null when it has none) and how replies name it
 *  (clips.ts naming): `as` in a hint, `title` in a verdict (`as` when it has no id). */
async function docOf(ctx: ToolContext, value: string, what: string) {
  const d = await fileOrJson(ctx, value, `the ${what}`), id = isObj(d.data) && typeof d.data.id === "string" ? d.data.id : null;
  const n = naming({ id: id ?? "", where: d.path === null ? "text" : "file", path: d.path, name: null }, `the ${what}'s`);
  return { ...d, id, as: n.as, title: id === null ? n.as : n.title };
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

/** A G-E009 (a clip neither the library at the game's tiers nor the clips given have) with the fix that finds it: its
 *  file in clips (a set the library hasn't, a compiled recipe's), the game.json line for its tier, or the closest id. */
function missing(lib: LibraryAccess, i: Issue): Issue {
  const id = /^clip (\S+) is not/.exec(i.message)?.[1] ?? "";
  if (!lib.source.sets().includes(id.split("/")[0]!)) return { ...i, fix: "pass its clip file in clips (recipe.compile writes a recipe's)" };
  try {
    lib.library.clip(id);
  } catch (err) {
    if (err instanceof LibraryError && err.code === "E_TIER") return { ...i, fix: refusal(err, id).message };
  }
  const near = suggestId(lib, id);
  return near ? { ...i, fix: `did you mean ${quote(near)}? or pass its clip file in clips` } : i;
}

/** A graph (file or JSON) and the clips it may play: `clips` loaded, each by its own id, over the library at the game's
 *  tiers; its issues (core's validateGraph), each missing clip's fix the one that finds it. */
async function graphOf(ctx: ToolContext, value: string, clips: readonly string[] = []) {
  if (clips.length > MAX_CLIPS) throw new ToolError("E_ARGS", `clips takes at most ${MAX_CLIPS} clips, not ${clips.length}`, true);
  const d = await docOf(ctx, value, "graph"), lib = ctx.library(), own = new Map<string, ClipRef>();
  for (const c of clips) {
    const r = await loadClip(ctx, c);
    own.set(r.id, r);
  }
  const seen = new Set(lib.library.catalog().map((r) => r.id)), find = (id: string) => own.get(id) ?? libraryClip(lib, id);
  const issues = G.validateGraph(d.data, { clips: (id) => seen.has(id) || find(id) !== undefined }).map((i) => (i.code === "G-E009" ? missing(lib, i) : i));
  return { ...d, graph: d.data as G.Graph, issues, find };
}

/** `recipe.compile`: a recipe compiled into a clip file (its facts measured), or its coded issues. */
export const recipeCompile = defineTool<{ recipe: string }, unknown>({
  name: "recipe.compile",
  description: "Compile a recipe (file or JSON) into a clip file: its keys, fit, license and metrics, or coded issues with fixes.",
  params: { type: "object", properties: { recipe: DOC }, required: ["recipe"] },
  output: output({ id: "string?", path: "string?", dur: "number?", loop: "boolean?", fps: "number?", keys: "integer?", fit: "array?", license: "string?", credit: "string?", sources: "array", sha256: "string?", events: "integer?", verdict: "string?", issues: "array" }),
  positionals: ["recipe"],
  examples: [{ args: { recipe: "spec/recipes/Jab_Left.json" } }],
  async run(a, ctx) {
    const d = await docOf(ctx, a.recipe, "recipe"), r = d.data as recipe.Recipe;
    let issues = recipe.validateRecipe(r), made: recipe.Compiled | null = null;
    if (!issues.length) {
      try {
        made = recipe.compile(r, await clipResolver(ctx, r.steps.flatMap((s) => (s.op === "clip" ? [String(s.id)] : []))));
      } catch (err) {
        // a library clip of a tier the game hasn't opted in to: refused as every tool refuses one, naming the game.json line
        if (err instanceof LibraryError) throw refusal(err, err.clip ?? "", ctx.library());
        if (!(err instanceof recipe.RecipeError)) throw err;
        issues = [...err.issues];
      }
    }
    if (!made) {
      const x = issued(issues);
      return {
        verdict: `recipe.compile ${d.title}: FAIL, ${count(issues.length, "issue")}`,
        data: { id: d.id, path: null, dur: null, loop: null, fps: null, keys: null, fit: null, license: null, credit: null, sources: [], sha256: null, events: null, verdict: null, issues: x.rows, ...(x.more ? { more: x.more } : {}) },
        lines: x.lines,
        findings: true,
        next: `fix each issue as its fix says, then ${call("recipe.compile", [d.as])} again`,
      };
    }
    // the clip as the library writes one, its facts and contacts measured (a strike the simulation looks for a hit at)
    const clip = withFacts(made.clip, made.rest), text = serialize(clip), path = ctx.write(`check-output/recipe.compile/${clip.id.split("/")[1]}.json`, text);
    const m = metrics(clip, made.rest), p = clip.provenance, [mean, worst] = clip.quality.fit, found = capped(m.findings, 3);
    return {
      verdict: `recipe.compile ${d.title}: ${clip.id}, ${sec(clip.dur)} ${clip.loop ? "loop" : "once"}, ${count(clip.keys.length, "key")}, fit ${mean}/${worst} mm (mean/worst), ${p.license}; metrics ${m.verdict.toUpperCase()}`,
      data: { id: clip.id, path, dur: clip.dur, loop: clip.loop, fps: clip.fps, keys: clip.keys.length, fit: [mean, worst], license: p.license, credit: p.credit ?? null, sources: made.track.sources, sha256: recipe.sha256(text), events: clip.events?.length ?? 0, verdict: m.verdict, issues: [] },
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
    // its shape, once it checks (a malformed graph's issues say what is wrong): each layer, the parameters' types, and
    // the clips its states name with their licenses
    const layers = ok ? G.layersOf(g.graph).map((L) => ({ name: L.name, start: L.start, states: Object.keys(L.states).length, transitions: L.transitions.length })) : [];
    const ids = ok ? [...new Set(G.layersOf(g.graph).flatMap((L) => Object.values(L.states).flatMap(G.clipsOf)))] : [], licenses: Record<string, number> = {};
    for (const id of ids) ((l) => (licenses[l] = (licenses[l] ?? 0) + 1))(g.find(id)!.clip.provenance.license);
    const n = (k: "states" | "transitions") => layers.reduce((s, L) => s + L[k], 0), lic = Object.entries(licenses).map(([l, k]) => `${k} ${l}`).join(", ");
    return {
      verdict: `graph.validate ${g.title}: ${ok ? `PASS, ${count(layers.length, "layer")}, ${count(n("states"), "state")}, ${count(n("transitions"), "transition")}, ${count(ids.length, "clip")} (${lic})` : `FAIL, ${count(g.issues.length, "issue")}`}`,
      data: { id: g.id, ok, issues: x.rows, ...(x.more ? { more: x.more } : {}), layers, parameters: ok ? Object.fromEntries(Object.entries(g.graph.parameters ?? {}).map(([k, p]) => [k, p.type])) : {}, clips: ids.length, licenses },
      lines: [...x.lines, ...layers.map((L) => `layer ${L.name}: starts at ${L.start}, ${count(L.states, "state")}, ${count(L.transitions, "transition")}`)],
      findings: !ok,
      next: ok ? `${call("graph.sim", [g.as], { script: "<script>", clips: a.clips })} runs it as a game would (spec/SIM.md)` : `fix each issue as its fix says, then ${call("graph.validate", [g.as], { clips: a.clips })} again`,
    };
  },
});

/** `graph.sim`: a script of game input run on a graph and a character; its trace written, compared with an expected one. */
export const graphSim = defineTool<{ graph: string; script: string; character: string; expect?: string; clips?: string[] }, unknown>({
  name: "graph.sim",
  description: "Run a script of game input on a graph: states, events, hit windows, travel, sensors, a filmstrip; diffs an expected trace.",
  params: { type: "object", properties: { graph: DOC, script: DOC, character: { ...CHARACTER, default: "tiny" }, expect: { type: "string", description: "expected trace file" }, clips: CLIPS }, required: ["graph", "script"] },
  output: output({ script: "string?", graph: "string?", character: "string", steps: "integer", states: "array", events: "integer", hits: "array", went: "object?", rate: "array?", sensors: "object?", findings: "array", warnings: "array", trace: "string?", matches: "boolean?", diff: "string?", issues: "array" }),
  positionals: ["graph"],
  examples: [{ args: { graph: "spec/graphs/Locomotion.json", script: "spec/sims/Walk_In_Place.json" }, expect: "findings" }],
  async run(a, ctx) {
    // every refusal first (a document, a clip, the character), then the issues, then the run
    const g = await graphOf(ctx, a.graph, a.clips), s = await docOf(ctx, a.script, "script"), want = a.expect === undefined ? null : await docOf(ctx, a.expect, "expected trace");
    const trace = (t: unknown): t is Trace => isObj(t) && ["states", "events", "hits"].every((k) => Array.isArray(t[k]));
    if (want && !trace(want.data)) throw new ToolError("E_JSON", "the expected trace is not one: give a trace.json graph.sim wrote (spec/SIM.md §2)", want.path === null);
    const body = await bodyOf(ctx, a.character), character = absolute(a.character) ? "<the character's file>" : a.character, script = s.data as SimScript;
    const again = () => call("graph.sim", [g.as], { script: s.as, character: a.character === "tiny" ? undefined : character, clips: a.clips, expect: want?.as });
    const issues = [...g.issues, ...validateScript(script, g.issues.length ? undefined : g.graph)], x = issued(issues);
    const none = { script: s.id, graph: g.id, character, steps: 0, states: [], events: 0, hits: [], went: null, rate: null, sensors: null, findings: [], warnings: [], trace: null, matches: null, diff: null };
    if (issues.length) return { verdict: `graph.sim ${s.title} on ${character}: FAIL, ${count(issues.length, "issue")}; not run`, data: { ...none, issues: x.rows, ...(x.more ? { more: x.more } : {}) }, lines: x.lines, findings: true, next: `fix each issue as its fix says, then ${again()} again` };
    const cache = new Map<string, AnimClip | undefined>(), clips = (id: string) => {
      if (!cache.has(id)) cache.set(id, ((c) => c && playable(c.clip, c.rest))(g.find(id)));
      return cache.get(id);
    };
    const run = simulate({ graph: g.graph, script, body: body.bound, clips }), tr = run.trace, name = tr.script.split("/")[1]!, frames = script.film ?? 8;
    const written = ctx.write(`check-output/graph.sim/${name}.trace.json`, traceText(tr));
    if (frames > 0 && run.frames.length) ctx.image(name, filmstrip(run, frames));
    const diff = want ? compareTraces(want.data as Trace, tr) : null, sens = run.sensors, last = run.path.at(-1) ?? { forward: 0, right: 0, yaw: 0 };
    const entered = tr.states.filter((e) => e.from !== null), path = [...tr.states.filter((e) => e.from === null && e.layer === "base"), ...entered].map((e) => (e.layer === "base" ? e.state : `${e.layer}:${e.state}`));
    const [states, hits, found, warned] = [capped(entered, 20), capped(tr.hits, 10), capped(sens?.findings ?? [], 5), capped(run.warnings, 5)];
    const cuts = Object.fromEntries(Object.entries({ states, hits, findings: found, warnings: warned }).filter(([, c]) => c.more).map(([k, c]) => [k, c.more]));
    const rates = run.rates.map((r) => r.rate), rate = rates.length ? [round(Math.min(...rates), 2), round(Math.max(...rates), 2)] : null;
    const total = sens?.findings.length ?? 0, failing = sens?.findings.filter((f) => f.level === "fail").length ?? 0;
    const said = sens ? `sensors ${sens.verdict.toUpperCase()}${total ? ` (${failing} fail, ${total - failing} warn)` : ""}, slide ${mm(sens.slide)}` : "no sensors (one step)";
    return {
      verdict: `graph.sim ${s.title} on ${character}: ${tr.steps} steps, ${cut(path.join(" > "), 60)}; ${count(tr.events.length, "event")}, ${count(tr.hits.length, "hit window")}; ${said}; went ${mm(last.forward)}${want ? `; trace ${diff === null ? "matches" : "differs"}` : ""}`,
      data: {
        ...none, steps: tr.steps, events: tr.events.length, trace: written, matches: want ? diff === null : null, diff, issues: [],
        states: states.rows.map((e) => ({ t: e.t, layer: e.layer, state: e.state, from: e.from })), hits: hits.rows.map((h) => ({ t0: h.t0, t1: h.t1, layer: h.layer, state: h.state, clip: h.clip })),
        went: { forward: round(last.forward), right: round(last.right), yaw: round(last.yaw) }, rate, sensors: sens && { verdict: sens.verdict, slide: sens.slide, skate: sens.skate },
        findings: found.rows.map((f) => ({ metric: f.metric, level: f.level, t0: round(f.t0, 3), t1: round(f.t1, 3), where: f.where ?? null, message: cut(f.message) })), warnings: warned.rows.map((w) => cut(w)),
        ...(Object.keys(cuts).length ? { more: cuts } : {}),
      },
      lines: [
        ...warned.rows, ...more(warned.more, "warning"),
        ...(diff === null ? [] : [`trace differs: ${diff}`]),
        ...found.rows.map((f) => `${f.level.toUpperCase()} ${f.metric}: ${cut(f.message)}`), ...more(found.more, "finding"),
        ...hits.rows.map((h) => `hit ${span(h.t0, h.t1)} ${h.layer}:${h.state} ${h.clip}`), ...more(hits.more, "hit window"), ...more(states.more, "state change"),
        `went ${mm(last.forward)} forward, ${mm(last.right)} right, turned ${round(last.yaw)}°${rate ? `; stride warped ${rate[0]}–${rate[1]}×` : ""}`,
      ],
      findings: diff !== null || run.warnings.length > 0 || sens?.verdict === "fail",
      next: diff !== null ? `the first difference is above: fix the graph or the script, or keep ${written} as the expected trace`
        : run.warnings.length ? `give each strike a hit event (a recipe's events step, then recipe.compile), then ${again()} again`
        : sens?.verdict === "fail" ? `each finding names its time, and the states rows what played then (the filmstrip shows it); fix the graph, then ${again()} again`
        : want ? "the trace matches; the filmstrip shows the run"
        : `the filmstrip shows the run; to hold it to this trace, copy ${written} out of check-output/ and pass it as \`--expect <copy>\``,
    };
  },
});
