// Change (PLAN.md WP-7.2a §1, §3): the edit tools. `fix` repairs a clip with @m3a/sensors' operators; `edit` changes
// it with recipe steps compiled by @m3a/core, and undoes and redoes. Both write a WORKSHOP copy (never the library),
// revisioned (if_revision), retry-safe (request_id, through the registry's store and the history's last request) and
// sharing one history (workshop.ts). An edit in place recompiles the recipe since the copy from the library clip, so
// chained edits don't pile up the key fit's error.
import { parseClip, recipe, serialize, VERSION, type Clip } from "@m3a/core";
import { tagConflicts, withFacts, type ClipFacts } from "@m3a/library";
import { fix as repair, fixes, metrics, type Report } from "@m3a/sensors";
import { defineTool, ToolError, type ToolOutput } from "../registry/registry.ts";
import { didYouMean, quote, type Schema } from "../registry/schema.ts";
import { loadClip, type ClipRef } from "./clips.ts";
import { CLIP, count, cut, sec } from "./common.ts";
import { applied, back, commit, mayCopy, readTarget, replay, targetName, targetRevision, type History, type Target } from "./workshop.ts";

const SAVE_AS: Schema = { type: "string", description: "WORKSHOP/Name" };
/** What edit's own ops take: meta sets the clip's name, tags and desc; slice (first only) cuts the clip it starts from. */
const OWN: Readonly<Record<string, readonly string[]>> = { meta: ["name", "tags", "desc"], slice: ["from", "to", "loop"] };

/** A clip as a reply sums it up: dur, keys, first strike, the sensors' verdict and findings. */
const summary = (c: Clip, m: Report) => ({ dur: c.dur, keys: c.keys.length, strike: (c.facts?.strike as number[] | undefined)?.[0] ?? null, verdict: m.verdict, findings: m.findings.length });
/** The library clip a loaded clip comes from: a workshop copy's provenance names it; any other is its own. */
const originOf = (ref: ClipRef) => (ref.where === "workshop" ? (ref.clip.provenance.orig ?? ref.id) : ref.id);
const inPlace = (ref: ClipRef, t: Target) => ref.where === "workshop" && ref.id === t.id;
const stacks = (h: History | null) => ({ undo: h?.undo.length ?? 0, redo: h?.redo.length ?? 0 });

/** `m3a fix`: the repairs lint names (or `ops`), each kept only if it makes nothing worse, saved as a WORKSHOP copy. */
export const fix = defineTool<{ clip: string; ops?: fixes.FixName[]; save_as?: string; max_keys?: number; dry_run?: boolean }, unknown>({
  name: "fix",
  description: "Repair a clip with lint's operators (or ops), keeping steps that make nothing worse, into a WORKSHOP copy.",
  params: {
    type: "object",
    properties: { clip: CLIP, ops: { type: "array", items: { type: "string", enum: fixes.FIXES } }, save_as: SAVE_AS, max_keys: { type: "integer", minimum: 2 }, dry_run: { type: "boolean" } },
    required: ["clip"],
  },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop", dry_run: true } }],
  edit: { revision: targetRevision },
  async run(a, ctx) {
    const t = a.dry_run ? null : await readTarget(ctx, targetName(a.clip, a.save_as)), again = t && replay(t, a);
    if (again) return again.out;
    const ref = await loadClip(ctx, a.clip);
    if (t) mayCopy(t, inPlace(ref, t), a);
    const r = repair(ref.clip, ref.rest, { ops: a.ops, maxKeys: a.max_keys }), [b, f] = [r.before, r.after].map((m) => ({ verdict: m.verdict, findings: m.findings.length }));
    const steps = r.steps.map((s) => ({ op: s.op, changes: s.changes.length, why: s.skipped ?? (s.rejected ? cut(`would make worse: ${s.rejected.join("; ")}`) : null) }));
    const head = `fix ${ref.id}: ${b!.verdict.toUpperCase()} -> ${f!.verdict.toUpperCase()} (${b!.findings} -> ${count(f!.findings, "finding")})`, fails = f!.verdict === "fail";
    const out = { data: { clip: ref.id, saved: null as string | null, path: null as string | null, before: b, after: f, steps, ...stacks(t?.history ?? null) }, lines: r.text.split("\n").slice(1), findings: fails };
    if (!t || !steps.some((s) => s.changes)) {
      const next = !t ? `fix ${ref.id} without dry_run saves it to the workshop` : fails ? `lint ${ref.id} names what is left; edit reshapes it` : `nothing to fix: sheet ${ref.id} shows it`;
      return { ...out, verdict: `${head}; ${t ? "nothing changed" : "dry run"}, nothing saved`, next };
    }
    const from = originOf(ref), c = r.clip, { review: _, ...kept } = c;
    const text = serialize({ ...kept, id: t.id, provenance: { ...c.provenance, orig: from, method: "edited", producer: { tool: "m3a-tools", version: VERSION }, ai: "humanEdits" }, quality: { fit: c.quality.fit, qa: "unchecked", qaVersion: "none" } });
    const h = applied(t, text, { from, rest: ref.rest, recipe: null }), undo = `take it back: edit ${t.id} --action undo`;
    const next = fails ? `lint ${t.id} names what is left; ${undo}` : `see it: sheet ${t.id}; ${undo}`;
    return commit(ctx, t, text, h, a, { ...out, data: { ...out.data, saved: t.id, path: t.path, ...stacks(h) }, verdict: `${head}; saved ${t.id} at ${h.head}`, next, revision: h.head });
  },
});

/** `m3a edit`: recipe steps applied to a clip into a WORKSHOP copy, or the copy's last change undone or redone. */
export const edit = defineTool<{ clip: string; ops?: Record<string, unknown>[]; action: "apply" | "undo" | "redo"; save_as?: string }, unknown>({
  name: "edit",
  description: "Change a clip with recipe steps (retime, mirror, pose, ...) into a WORKSHOP copy; undo and redo.",
  params: {
    type: "object",
    properties: {
      clip: CLIP,
      ops: { type: "array", items: { type: "object" }, description: "recipe steps without in; {op:slice,from,to,loop} first; {op:meta,name,tags,desc}" },
      action: { type: "string", enum: ["apply", "undo", "redo"], default: "apply" },
      save_as: SAVE_AS,
    },
    required: ["clip"],
  },
  positionals: ["clip"],
  examples: [{ args: { clip: "MESH2MOTION/Punch_Cross", save_as: "WORKSHOP/Punch_Left", ops: [{ op: "retime", speed: 1.3 }, { op: "mirror" }], request_id: "ex-1" } }],
  edit: { revision: targetRevision },
  async run(a, ctx) {
    const t = await readTarget(ctx, targetName(a.clip, a.save_as)), again = replay(t, a);
    if (again) return again.out;
    if (a.action !== "apply") {
      if (a.ops) throw new ToolError("E_ARGS", `${a.action} takes no ops: it restores the clip as it was`, true);
      const { text, history: h } = back(t, a.action), sum = (x: string | null) => (x === null ? null : ((c) => summary(c, metrics(c, h.rest)))(parseClip(x)));
      const out: ToolOutput = { verdict: `edit ${t.id}: ${a.action === "undo" ? "undone" : "redone"}, now at revision ${h.head} (${h.undo.length} to undo, ${h.redo.length} to redo)`, data: { clip: t.id, path: t.path, action: a.action, from: h.from, before: sum(t.text), after: sum(text), ...stacks(h), history_reset: false, recipe: h.recipe }, next: `${text === null ? "the copy is gone" : `see it: sheet ${t.id}`}; edit ${t.id} --action ${a.action === "undo" ? "redo" : "undo"} reverses this`, revision: h.head };
      return commit(ctx, t, text, h, a, out);
    }
    const ops = a.ops ?? [];
    if (ops.length < 1 || ops.length > 16) throw new ToolError("E_ARGS", `ops takes 1 to 16 recipe steps, not ${ops.length} (spec/RECIPE.md lists them: retime, mirror, pose, ...)`, true);
    const ref = await loadClip(ctx, a.clip), from = originOf(ref), lib = ctx.library().library.resolver(), h = t.history;
    mayCopy(t, inPlace(ref, t), a);
    // the recipe since the copy, when this edits it in place and its library clip still resolves (a slice cuts a fresh one)
    const chain = inPlace(ref, t) && h?.recipe && lib(h.from) && !(ops[0]!.op === "slice" && h.recipe.steps.length > 1) ? h.recipe : null;
    const r: recipe.Recipe = chain ? structuredClone(chain) : { format: "2.0", id: t.id, steps: [{ op: "clip", id: ref.id }] }, at: number[] = [];
    for (const [i, { op, ...f }] of ops.entries()) {
      const own = typeof op === "string" && Object.hasOwn(OWN, op) ? OWN[op]! : undefined, odd = own && Object.keys(f).find((k) => !own.includes(k));
      if (odd || (op === "slice" && i > 0) || (!own && ("in" in f || "as" in f))) throw new ToolError("E_ARGS", `ops[${i}]: ${odd ? `${op} has no field ${quote(odd)}${didYouMean(odd, own!)}` : own ? "slice comes first" : "leave out in and as: each step reads the one before"}`, true);
      if (own) Object.assign(op === "meta" ? r : r.steps[0]!, f);
      else at[r.steps.push({ ...f, op: op as string, in: `s${r.steps.length}` })] = i;
      if (op === "slice") at[1] = i;
    }
    const mine = ref.where === "library" ? undefined : { clip: ref.clip, rest: ref.rest, contentId: recipe.sha256(ref.text!) };
    let made: recipe.Compiled;
    try {
      made = recipe.compile(r, Object.assign((id: string) => (mine && id === ref.id ? mine : lib(id)), { ids: lib.ids }));
    } catch (err) {
      if (!(err instanceof recipe.RecipeError)) throw err;
      const where = (s?: number) => (s === undefined ? "ops" : at[s] === undefined ? `step ${s}` : `ops[${at[s]}]`);
      throw new ToolError("E_ARGS", err.issues.slice(0, 3).map((x) => `${where(x.step)}${x.field ? `.${x.field}` : ""}: ${x.message}${x.fix ? `; ${x.fix}` : ""}`).join("; "), true);
    }
    const clip = withFacts({ ...made.clip, provenance: { ...made.clip.provenance, orig: from } }, made.rest), text = serialize(clip), m = metrics(clip, made.rest);
    const hist = applied(t, text, { from, rest: made.rest, recipe: chain || ref.where === "library" ? r : null });
    const [b, n] = [summary(ref.clip, metrics(ref.clip, ref.rest)), summary(clip, m)], s = (x: number | null) => (x === null ? "none" : sec(x));
    const strike = b.strike ?? n.strike ? `, strike ${s(b.strike)} -> ${s(n.strike)}` : "";
    const lines = [...ops.map((o, i) => cut(`ops[${i}] ${JSON.stringify(o)}`)), ...m.findings.slice(0, 3).map((x) => cut(`${x.level} ${x.metric} at ${sec(x.t0)}: ${x.message}`)), ...tagConflicts(clip, clip.facts as unknown as ClipFacts, made.rest).map((x) => cut(`tag ${x.tag}: ${x.message}`))];
    return commit(ctx, t, text, hist, a, {
      verdict: `edit ${t.id}: ${count(ops.length, "op")} applied: ${sec(b.dur)} -> ${sec(n.dur)}${strike}, ${n.keys} keys, sensors ${n.verdict} (${count(n.findings, "finding")}); revision ${hist.head}`,
      data: { clip: t.id, path: t.path, action: "apply", from, before: b, after: n, ...stacks(hist), history_reset: t.stale !== null, recipe: hist.recipe },
      lines,
      findings: n.verdict === "fail",
      next: `see it: sheet ${t.id}; compare: diff ${from} ${t.id}; take it back: edit ${t.id} --action undo`,
      revision: hist.head,
    });
  },
});
