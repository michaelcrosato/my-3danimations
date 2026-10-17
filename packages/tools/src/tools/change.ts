// Change (PLAN.md WP-7.2a §1, §3): the edit tools. `fix` repairs a clip with @m3a/sensors' operators; `edit` changes
// it with recipe steps compiled by @m3a/core, and undoes and redoes. Both write a WORKSHOP copy (never the library),
// revisioned (if_revision), retry-safe (request_id, through the registry's store and the history's last request) and
// sharing one history (workshop.ts). An edit in place recompiles the recipe since the copy from the library clip, so
// chained edits don't pile up the key fit's error; a slice, a chain past 32 steps or past what one call compiles
// (clips.ts bounded), or a library clip changed since the copy compiles from the file as it is.
import { parseClip, recipe, serialize, VERSION, type Clip, type Rest } from "@m3a/core";
import { LibraryError, tagConflicts, withFacts, type ClipFacts } from "@m3a/library";
import { fix as repair, fixes, metrics, type Report } from "@m3a/sensors";
import { defineTool, ToolError, type ToolContext, type ToolOutput } from "../registry/registry.ts";
import { didYouMean, quote, type Schema } from "../registry/schema.ts";
import { bounded, flagTier, fromText, loadClip, MAX_FIT_SAMPLES, naming, type Asked, type ClipRef } from "./clips.ts";
import { ARROW, call, capped, CLIP, count, cut, more, output, sec } from "./common.ts";
import { applied, back, commit, mayCopy, readTarget, replay, targetName, targetRevision, WORKSHOP, type Entry, type History, type Target } from "./workshop.ts";

const SAVE_AS: Schema = { type: "string", description: "WORKSHOP/Name" };
/** What edit's own ops take: meta sets the clip's name, tags and desc; slice (first only) cuts the clip it starts from. */
const OWN: Readonly<Record<string, readonly string[]>> = { slice: ["from", "to", "loop"], meta: ["name", "tags", "desc"] };
/** The ops edit takes: its own, then the recipe's that change the step before (clip, sequence, blend and layer compose). */
const OPS = [...Object.keys(OWN), ...Object.keys(recipe.OPS).filter((k) => recipe.OPS[k]!.reads.join() === "in")];
/** The most steps an in-place edit's recipe chain keeps; an edit past it compiles from the file as it is. */
const CHAIN = 32;
/** How bounded's refusals name an edit compiled from its clip as it is: the clip and the call's ops, which its caller
 *  changes (an edit's recipe has no fps: 30 a second), and a slice as its first op to make the clip shorter. */
const asked = (ops: number): Asked => ({
  all: () => `the clip and the edit's ${count(ops, "op")}`,
  fewer: "use fewer ops, or apply them in more than one edit",
  lower: "",
  shorter: `slice it first (ops[0] {"op": "slice", "from": 0, "to": ${MAX_FIT_SAMPLES / 30}} keeps its first ${MAX_FIT_SAMPLES / 30} s), or retime it less slowly`,
});

/** A clip as a reply sums it up: dur, keys, first strike, the sensors' verdict and findings. */
const summary = (c: Clip, m: Report) => ({ dur: c.dur, keys: c.keys.length, strike: (c.facts?.strike as number[] | undefined)?.[0] ?? null, verdict: m.verdict, findings: m.findings.length });
/** A clip's license and the credit it owes. */
const license = (c: Clip) => ({ spdx: c.provenance.license, credit: c.provenance.credit ?? null });
/** The library clip a loaded clip comes from: a workshop copy's provenance names it (wherever its file is); any other
 *  is its own. */
const originOf = (ref: ClipRef): string => (ref.id.startsWith(`${WORKSHOP}/`) ? (ref.clip.provenance.orig ?? ref.id) : ref.id);
/** The target's own origin and rest when its history doesn't hold them (there is none, or it was set aside): its file
 *  loaded as every tool loads it; undefined when there is no file, or it is no clip. */
async function ownState(ctx: ToolContext, t: Target): Promise<Pick<Entry, "from" | "rest"> | undefined> {
  if (t.history || t.text === null) return undefined;
  const r = await loadClip(ctx, t.id).catch((err: unknown) => {
    if (err instanceof ToolError) return undefined;
    throw err;
  });
  return r && { from: originOf(r), rest: r.rest };
}
/** Whether `ref` is the target's own file, whatever id it holds. */
const inPlace = (ref: ClipRef, t: Target) => ref.where === "workshop" && ref.path === t.path;
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
  output: output({ clip: "string", saved: "string?", path: "string?", before: "object", after: "object", steps: "array", undo: "integer", redo: "integer" }),
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop", dry_run: true } }],
  edit: { revision: targetRevision("fix") },
  async run(a, ctx) {
    // a dry run resolves the target too, so it promises only what the real run does (clip JSON without save_as has none)
    const named = !a.dry_run || a.save_as !== undefined || !/^\s*\{/.test(a.clip);
    const t = named ? await readTarget(ctx, targetName(a.clip, a.save_as)) : null, again = t && replay(t, "fix", a);
    if (again) return again.out;
    const ref = await loadClip(ctx, a.clip);
    if (t) mayCopy(t, inPlace(ref, t), a);
    const r = repair(ref.clip, ref.rest, { ops: a.ops, maxKeys: a.max_keys }), [b, f] = [r.before, r.after].map((m) => ({ verdict: m.verdict, findings: m.findings.length }));
    const steps = r.steps.map((s) => ({ op: s.op, changes: s.changes.length, why: s.skipped ?? (s.rejected ? cut(`would make worse: ${s.rejected.join("; ")}`) : null) }));
    // its hints name the clip as the caller gave it (their file, not the library clip inside it) until it is saved
    const { as, title } = naming(ref), fails = f!.verdict === "fail";
    const head = `fix ${title}: ${b!.verdict.toUpperCase()} ${ARROW} ${f!.verdict.toUpperCase()} (${b!.findings} ${ARROW} ${count(f!.findings, "finding")})`;
    const data = { clip: ref.id, saved: null as string | null, path: null as string | null, before: b, after: f, steps, ...stacks(t?.history ?? null) };
    const out = { data, lines: r.text.split("\n").slice(1).map((l) => cut(l)), findings: fails };
    const changes = steps.some((s) => s.changes);
    if (!t || a.dry_run || !changes) {
      const again = call("fix", [as], { ops: a.ops, save_as: a.save_as ?? (t ? undefined : "WORKSHOP/<Name>"), max_keys: a.max_keys });
      const next = changes ? `${again} saves it${t ? ` as ${t.id}` : ""}` : fails ? `${call("lint", [as])} names what is left; edit reshapes it` : `nothing to fix: ${call("sheet", [as])} shows it`;
      return { ...out, verdict: `${head}; ${changes ? "dry run" : "nothing changed"}, nothing saved`, next };
    }
    // the fixed clip is no longer a recipe's output (its lineage stays in orig), nor the motion a review saw
    const from = originOf(ref), c = r.clip, { review: _, ...kept } = c;
    const { recipe: _made, ...was } = c.provenance as Clip["provenance"] & { recipe?: unknown };
    const provenance = { ...was, orig: from, method: "edited" as const, producer: { tool: "m3a-tools", version: VERSION }, ai: "humanEdits" as const };
    const text = serialize({ ...kept, id: t.id, provenance, quality: { fit: c.quality.fit, qa: "unchecked", qaVersion: "none" } });
    const h = applied(t, text, { from, rest: ref.rest, recipe: null }, await ownState(ctx, t)), undo = `take it back: ${call("edit", [t.id], { action: "undo" })}`;
    const next = fails ? `${call("lint", [t.id])} names what is left; ${undo}` : `see it: ${call("sheet", [t.id])}; ${undo}`;
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
    next: `${now ? `see it: ${call("sheet", [t.id])}` : "the copy is gone"}; ${call("edit", [t.id], { action: way === "undo" ? "redo" : "undo" })} reverses this`,
    revision: h.head,
  };
}

/** Flags an undo or redo of `t` into history `h` as every tool that loads the clip does (clips.ts flagTier): its file as
 *  `h` left it, on `h`'s origin and rest. A state that is no clip, or no file, has nothing to flag. */
function flagRestored(ctx: ToolContext, t: Target, h: History): void {
  if (h.text === null) return;
  const lib = ctx.library();
  try {
    flagTier(lib, fromText(lib, h.text, "workshop", t.path, t.name, { origin: h.from, rest: h.rest }));
  } catch (err) {
    if (!(err instanceof ToolError)) throw err;
  }
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
  output: output({ clip: "string", path: "string", action: "string", changed: "boolean", from: "string", before: "object?", after: "object?", license: "object?", undo: "integer", redo: "integer", history_reset: "boolean", recipe: "object?" }),
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/OverhandThrow", save_as: "WORKSHOP/Throw_Heavy", ops: [{ op: "retime", speed: 0.8 }, { op: "exaggerate", amount: 1.25 }] } }],
  edit: { revision: targetRevision("edit") },
  async run(a, ctx) {
    const t = await readTarget(ctx, targetName(a.clip, a.save_as)), again = replay(t, "edit", a);
    if (again) return again.out;
    if (a.action !== "apply") {
      if (a.ops) throw new ToolError("E_ARGS", `${a.action} takes no ops: it restores the clip as it was`, true);
      const h = back(t, a.action), out = await commit(ctx, "edit", t, h, a, restored(t, h, a.action));
      flagRestored(ctx, t, h);
      return out;
    }
    const ops = a.ops ?? [];
    if (ops.length < 1 || ops.length > 16) throw new ToolError("E_ARGS", `ops takes 1 to 16 recipe steps, not ${ops.length} (spec/RECIPE.md lists them: retime, mirror, pose, ...)`, true);
    // the library clips the game sees: one out of its tiers (the resolver refuses it, E_TIER) read as none, so a copy whose
    // origin the game no longer sees compiles from its file
    const all = ctx.library().library.resolver(), lib = Object.assign((id: string) => {
      try {
        return all(id);
      } catch (err) {
        if (err instanceof LibraryError && err.code === "E_TIER") return undefined;
        throw err;
      }
    }, { ids: all.ids });
    const ref = await loadClip(ctx, a.clip), from = originOf(ref), h = t.history, here = inPlace(ref, t);
    mayCopy(t, here, a);
    // the recipe since the copy, when this edits it in place, its library clip is still the one the file was made from
    // (visible, and the content its provenance names) and the chain stays within CHAIN steps; a slice cuts the clip as
    // it is now, so it compiles from the file
    const input = (ref.clip.provenance as { recipe?: { inputs: Record<string, string> } }).recipe?.inputs[h?.from ?? ""];
    const kept = here && h?.recipe && input !== undefined && lib(h.from)?.contentId === input && ops[0]!.op !== "slice" && h.recipe.steps.length + ops.length <= CHAIN ? h.recipe : null;
    // the ops onto that chain, or onto the clip as it is (a recipe of its one clip step); `at` gives each op's step
    const onto = (base: recipe.Recipe | null) => {
      const r: recipe.Recipe = base ? structuredClone(base) : { format: "2.0", id: t.id, steps: [{ op: "clip", id: ref.id }] }, at: number[] = [];
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
      return { r, at };
    };
    const mine = ref.where === "library" ? undefined : { clip: ref.clip, rest: ref.rest, contentId: recipe.sha256(ref.text!) };
    const clipOf = (id: string) => (mine && id === ref.id ? mine.clip : lib(id)?.clip), where = (at: number[]) => (s: number) => (at[s] === undefined ? `step ${s}` : `ops[${at[s]}]`);
    // the chain is kept only while it stays within what one call compiles (bounded), as within CHAIN: past that, the
    // clip as it is takes the ops, and only those can be refused, named as the call's own
    let chain = kept, { r, at } = onto(chain);
    if (chain) {
      try {
        bounded(r, clipOf, where(at));
      } catch (err) {
        if (!(err instanceof ToolError)) throw err;
        [chain, { r, at }] = [null, onto(null)];
      }
    }
    if (!chain) bounded(r, clipOf, where(at), asked(ops.length));
    let made: recipe.Compiled;
    try {
      made = recipe.compile(r, Object.assign((id: string) => (mine && id === ref.id ? mine : lib(id)), { ids: lib.ids }));
    } catch (err) {
      if (!(err instanceof recipe.RecipeError)) throw err;
      const where = (s = 0) => (at[s] === undefined ? (s ? `step ${s}` : "ops") : `ops[${at[s]}]`);
      throw new ToolError("E_ARGS", err.issues.slice(0, 3).map((x) => `${where(x.step)}${x.field ? `.${x.field}` : ""}: ${x.message}${x.fix ? `; ${x.fix}` : ""}`).join("; "), true);
    }
    const clip = withFacts({ ...made.clip, provenance: { ...made.clip.provenance, orig: from } }, made.rest), text = serialize(clip), m = metrics(clip, made.rest);
    const hist = applied(t, text, { from, rest: made.rest, recipe: chain || ref.where === "library" ? r : null }, await ownState(ctx, t));
    const [b, n] = [summary(ref.clip, metrics(ref.clip, ref.rest)), summary(clip, m)], s = (x: number | null) => (x === null ? "none" : sec(x));
    const strike = b.strike ?? n.strike ? `, strike ${s(b.strike)} ${ARROW} ${s(n.strike)}` : "";
    const found = capped(m.findings, 3), tags = capped(tagConflicts(clip, clip.facts as unknown as ClipFacts, made.rest), 3);
    // the clip to compare the copy with: its library clip while the game sees it, else the file it was made from
    const was = lib(from) ? from : ref.where === "file" ? naming(ref).as : null;
    const lines = [
      ...found.rows.map((x) => cut(`${x.level} ${x.metric} at ${sec(x.t0)}: ${x.message}`)),
      ...more(found.more, "finding", `${call("metrics", [t.id], { limit: Math.min(50, m.findings.length) })} lists them`),
      ...tags.rows.map((x) => cut(`tag ${x.tag}: ${x.message}`)),
      ...more(tags.more, "tag", `${call("lint", [t.id])} lists them`),
      ...ops.map((o, i) => cut(`ops[${i}] ${JSON.stringify(o)}`)),
    ];
    return commit(ctx, "edit", t, hist, a, {
      verdict: `edit ${t.id}: ${count(ops.length, "op")} applied: ${sec(b.dur)} ${ARROW} ${sec(n.dur)}${strike}, ${n.keys} keys, sensors ${n.verdict} (${count(n.findings, "finding")}); revision ${hist.head}`,
      data: { clip: t.id, path: t.path, action: "apply", changed: text !== t.text, from, before: b, after: n, license: license(clip), ...stacks(hist), history_reset: t.stale !== null, recipe: hist.recipe },
      lines,
      findings: n.verdict === "fail",
      next: `see it: ${call("sheet", [t.id])}; ${was ? `compare: ${call("diff", [was, t.id])}; ` : ""}take it back: ${call("edit", [t.id], { action: "undo" })}`,
      revision: hist.head,
    });
  },
});
