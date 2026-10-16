// Change (PLAN.md WP-7.2a §1, §3): the edit tools. `fix` repairs a clip with @m3a/sensors' operators; `edit` changes
// it with recipe steps compiled by @m3a/core, and undoes and redoes. Both write a WORKSHOP copy (never the library),
// revisioned (if_revision), retry-safe (request_id, through the registry's store and the history's last request) and
// sharing one history (workshop.ts). An edit in place recompiles the recipe since the copy from the library clip, so
// chained edits don't pile up the key fit's error; a slice, or a chain past 32 steps, compiles from the file as it is.
import { parseClip, recipe, serialize, VERSION, type Clip, type Rest } from "@m3a/core";
import { tagConflicts, withFacts, type ClipFacts } from "@m3a/library";
import { fix as repair, fixes, metrics, type Report } from "@m3a/sensors";
import { defineTool, ToolError, type ToolOutput } from "../registry/registry.ts";
import { didYouMean, quote, type Schema } from "../registry/schema.ts";
import { loadClip, WORKSHOP, type ClipRef } from "./clips.ts";
import { capped, CLIP, count, cut, sec } from "./common.ts";
import { applied, back, commit, mayCopy, readTarget, replay, targetName, targetRevision, type History, type Target } from "./workshop.ts";

const SAVE_AS: Schema = { type: "string", description: "WORKSHOP/Name" };
/** What edit's own ops take: meta sets the clip's name, tags and desc; slice (first only) cuts the clip it starts from. */
const OWN: Readonly<Record<string, readonly string[]>> = { slice: ["from", "to", "loop"], meta: ["name", "tags", "desc"] };
/** The ops edit takes: its own, then the recipe's that change the step before (clip, sequence, blend and layer compose). */
const OPS = [...Object.keys(OWN), ...Object.keys(recipe.OPS).filter((k) => recipe.OPS[k]!.reads.join() === "in")];
/** The most steps an in-place edit's recipe chain keeps; an edit past it compiles from the file as it is. */
const CHAIN = 32;

/** A clip as a reply sums it up: dur, keys, first strike, the sensors' verdict and findings. */
const summary = (c: Clip, m: Report) => ({ dur: c.dur, keys: c.keys.length, strike: (c.facts?.strike as number[] | undefined)?.[0] ?? null, verdict: m.verdict, findings: m.findings.length });
/** A clip's license and the credit it owes. */
const license = (c: Clip) => ({ spdx: c.provenance.license, credit: c.provenance.credit ?? null });
/** The library clip a loaded clip comes from: a workshop copy's provenance names it (wherever its file is); any other
 *  is its own. */
const originOf = (ref: ClipRef) => (ref.id.startsWith(`${WORKSHOP}/`) ? (ref.clip.provenance.orig ?? ref.id) : ref.id);
/** Whether `ref` is the target's own file, whatever id it holds. */
const inPlace = (ref: ClipRef, t: Target) => ref.where === "workshop" && ref.path === t.path;
const stacks = (h: History | null) => ({ undo: h?.undo.length ?? 0, redo: h?.redo.length ?? 0 });
/** A capped list's "more" line, when it cut some: how many of `what`, and where the rest are. */
const more = (n: number | undefined, what: string, rest: string) => (n ? [`more: ${count(n, what)} ${rest}`] : []);

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
  edit: { revision: targetRevision("fix") },
  async run(a, ctx) {
    const t = a.dry_run ? null : await readTarget(ctx, targetName(a.clip, a.save_as)), again = t && replay(t, "fix", a);
    if (again) return again.out;
    const ref = await loadClip(ctx, a.clip);
    if (t) mayCopy(t, inPlace(ref, t), a);
    const r = repair(ref.clip, ref.rest, { ops: a.ops, maxKeys: a.max_keys }), [b, f] = [r.before, r.after].map((m) => ({ verdict: m.verdict, findings: m.findings.length }));
    const steps = r.steps.map((s) => ({ op: s.op, changes: s.changes.length, why: s.skipped ?? (s.rejected ? cut(`would make worse: ${s.rejected.join("; ")}`) : null) }));
    const head = `fix ${ref.id}: ${b!.verdict.toUpperCase()} -> ${f!.verdict.toUpperCase()} (${b!.findings} -> ${count(f!.findings, "finding")})`, fails = f!.verdict === "fail";
    const data = { clip: ref.id, saved: null as string | null, path: null as string | null, before: b, after: f, steps, ...stacks(t?.history ?? null) };
    const out = { data, lines: r.text.split("\n").slice(1), findings: fails };
    const changes = steps.some((s) => s.changes);
    if (!t || !changes) {
      const next = changes ? `fix ${ref.id} without dry_run saves it to the workshop` : fails ? `lint ${ref.id} names what is left; edit reshapes it` : `nothing to fix: sheet ${ref.id} shows it`;
      return { ...out, verdict: `${head}; ${changes ? "dry run" : "nothing changed"}, nothing saved`, next };
    }
    // the fixed clip is no longer a recipe's output (its lineage stays in orig), nor the motion a review saw
    const from = originOf(ref), c = r.clip, { review: _, ...kept } = c;
    const { recipe: _made, ...was } = c.provenance as Clip["provenance"] & { recipe?: unknown };
    const provenance = { ...was, orig: from, method: "edited" as const, producer: { tool: "m3a-tools", version: VERSION }, ai: "humanEdits" as const };
    const text = serialize({ ...kept, id: t.id, provenance, quality: { fit: c.quality.fit, qa: "unchecked", qaVersion: "none" } });
    const h = applied(t, text, { from, rest: ref.rest, recipe: null }), undo = `take it back: edit ${t.id} --action undo`;
    const next = fails ? `lint ${t.id} names what is left; ${undo}` : `see it: sheet ${t.id}; ${undo}`;
    return commit(ctx, "fix", t, h, a, { ...out, data: { ...data, saved: t.id, path: t.path, ...stacks(h) }, verdict: `${head}; saved ${t.id} at ${h.head}`, next, revision: h.head });
  },
});

/** edit's reply to an undo or redo of `t` into history `h`: each side summed up on its own rest. */
function restored(t: Target, h: History, way: "undo" | "redo"): ToolOutput {
  const [was, now] = [t.text, h.text].map((x) => (x === null ? null : parseClip(x)));
  const sum = (c: Clip | null | undefined, rest: Rest) => (c ? summary(c, metrics(c, rest)) : null);
  const data = { clip: t.id, path: t.path, action: way, changed: h.text !== t.text, from: h.from, before: sum(was, t.history!.rest), after: sum(now, h.rest), license: now ? license(now) : null };
  return {
    verdict: `edit ${t.id}: ${way === "undo" ? "undone" : "redone"}, now at revision ${h.head} (${h.undo.length} to undo, ${h.redo.length} to redo)`,
    data: { ...data, ...stacks(h), history_reset: false, recipe: h.recipe },
    next: `${now ? `see it: sheet ${t.id}` : "the copy is gone"}; edit ${t.id} --action ${way === "undo" ? "redo" : "undo"} reverses this`,
    revision: h.head,
  };
}

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
  edit: { revision: targetRevision("edit") },
  async run(a, ctx) {
    const t = await readTarget(ctx, targetName(a.clip, a.save_as)), again = replay(t, "edit", a);
    if (again) return again.out;
    if (a.action !== "apply") {
      if (a.ops) throw new ToolError("E_ARGS", `${a.action} takes no ops: it restores the clip as it was`, true);
      const h = back(t, a.action);
      return commit(ctx, "edit", t, h, a, restored(t, h, a.action));
    }
    const ops = a.ops ?? [];
    if (ops.length < 1 || ops.length > 16) throw new ToolError("E_ARGS", `ops takes 1 to 16 recipe steps, not ${ops.length} (spec/RECIPE.md lists them: retime, mirror, pose, ...)`, true);
    const ref = await loadClip(ctx, a.clip), from = originOf(ref), lib = ctx.library().library.resolver(), h = t.history, here = inPlace(ref, t);
    mayCopy(t, here, a);
    // the recipe since the copy, when this edits it in place, its library clip still resolves and the chain stays
    // within CHAIN steps; a slice cuts the clip as it is now, so it compiles from the file
    const chain = here && h?.recipe && lib(h.from) && ops[0]!.op !== "slice" && h.recipe.steps.length + ops.length <= CHAIN ? h.recipe : null;
    const r: recipe.Recipe = chain ? structuredClone(chain) : { format: "2.0", id: t.id, steps: [{ op: "clip", id: ref.id }] }, at: number[] = [];
    for (const [i, { op, ...f }] of ops.entries()) {
      if (typeof op !== "string" || !OPS.includes(op)) {
        const composes = typeof op === "string" && Object.hasOwn(recipe.OPS, op), near = typeof op === "string" && !composes ? didYouMean(op, OPS) : "";
        const why = composes ? `${op} names or composes clips (a recipe's job); edit changes one` : op === undefined ? "missing" : `no operation ${quote(op)}`;
        throw new ToolError("E_ARGS", `ops[${i}].op: ${why}${near || `; one of ${OPS.join(", ")}`}`, true);
      }
      const own = Object.hasOwn(OWN, op) ? OWN[op]! : undefined, odd = own && Object.keys(f).find((k) => !own.includes(k));
      const wrong = odd
        ? `${op} has no field ${quote(odd)}${didYouMean(odd, own!)}`
        : op === "slice" && i > 0
          ? "slice comes first"
          : !own && ("in" in f || "as" in f)
            ? "leave out in and as: each step reads the one before"
            : null;
      if (wrong) throw new ToolError("E_ARGS", `ops[${i}]: ${wrong}`, true);
      if (own) {
        Object.assign(op === "meta" ? r : r.steps[0]!, f);
        at[op === "meta" ? 0 : 1] = i; // where() reads the recipe's own fields as step 0, the clip step as 1
      } else at[r.steps.push({ ...f, op, in: `s${r.steps.length}` })] = i;
    }
    const mine = ref.where === "library" ? undefined : { clip: ref.clip, rest: ref.rest, contentId: recipe.sha256(ref.text!) };
    let made: recipe.Compiled;
    try {
      made = recipe.compile(r, Object.assign((id: string) => (mine && id === ref.id ? mine : lib(id)), { ids: lib.ids }));
    } catch (err) {
      if (!(err instanceof recipe.RecipeError)) throw err;
      const where = (s = 0) => (at[s] === undefined ? (s ? `step ${s}` : "ops") : `ops[${at[s]}]`);
      throw new ToolError("E_ARGS", err.issues.slice(0, 3).map((x) => `${where(x.step)}${x.field ? `.${x.field}` : ""}: ${x.message}${x.fix ? `; ${x.fix}` : ""}`).join("; "), true);
    }
    const clip = withFacts({ ...made.clip, provenance: { ...made.clip.provenance, orig: from } }, made.rest), text = serialize(clip), m = metrics(clip, made.rest);
    const hist = applied(t, text, { from, rest: made.rest, recipe: chain || ref.where === "library" ? r : null });
    const [b, n] = [summary(ref.clip, metrics(ref.clip, ref.rest)), summary(clip, m)], s = (x: number | null) => (x === null ? "none" : sec(x));
    const strike = b.strike ?? n.strike ? `, strike ${s(b.strike)} -> ${s(n.strike)}` : "";
    const found = capped(m.findings, 3), tags = capped(tagConflicts(clip, clip.facts as unknown as ClipFacts, made.rest), 3);
    const lines = [
      ...found.rows.map((x) => cut(`${x.level} ${x.metric} at ${sec(x.t0)}: ${x.message}`)),
      ...more(found.more, "finding", `(metrics ${t.id} lists them)`),
      ...tags.rows.map((x) => cut(`tag ${x.tag}: ${x.message}`)),
      ...more(tags.more, "tag", `not borne out (lint ${t.id} lists them)`),
      ...ops.map((o, i) => cut(`ops[${i}] ${JSON.stringify(o)}`)),
    ];
    return commit(ctx, "edit", t, hist, a, {
      verdict: `edit ${t.id}: ${count(ops.length, "op")} applied: ${sec(b.dur)} -> ${sec(n.dur)}${strike}, ${n.keys} keys, sensors ${n.verdict} (${count(n.findings, "finding")}); revision ${hist.head}`,
      data: { clip: t.id, path: t.path, action: "apply", changed: text !== t.text, from, before: b, after: n, license: license(clip), ...stacks(hist), history_reset: t.stale !== null, recipe: hist.recipe },
      lines,
      findings: n.verdict === "fail",
      next: `see it: sheet ${t.id}; compare: diff ${from} ${t.id}; take it back: edit ${t.id} --action undo`,
      revision: hist.head,
    });
  },
});
