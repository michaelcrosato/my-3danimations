// Ship (PLAN.md WP-7.2a, WP-5.7): `license.check`, the clips a game plays, a set, or game.json (its clips, else every
// set of its tiers) against their licenses and the tiers the game opts in to, with the credits block it shows. A
// workshop copy, a clip file or a clip's JSON is checked as the library clip it came from (the history's `from`, else
// its provenance's `orig`, else its id), so an edit can't carry a clip out of a tier the game hasn't opted in to; one
// from no library set is an open question, its license for the game to check.
import { checkGame, checkSets, TIERS, type LicenseFinding, type LicenseReport, type Tier } from "@m3a/library";
import { defineTool, ToolError, type ToolContext } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";
import { historyFile, loadClip, suggestId, WORKSHOP } from "./clips.ts";
import { capped, count } from "./common.ts";

/** The library id a clip stands for in a license check, its own license, and what a finding calls it (a JSON clip by its
 *  id): a library id as given; a workshop copy's history's `from`; a file's or JSON clip's provenance `orig`, else its id. */
async function originOf(ctx: ToolContext, ref: string): Promise<{ id: string; license: string | null; label: string }> {
  const id = ref.trim(), ws = id.startsWith(`${WORKSHOP}/`);
  if (!ws && !id.startsWith("{") && !/\.json$/i.test(id)) return { id, license: null, label: id };
  const c = await loadClip(ctx, id), p = c.clip.provenance;
  let from: unknown;
  try {
    from = ws ? (JSON.parse((await ctx.tryRead(historyFile(id.slice(WORKSHOP.length + 1)))) ?? "{}") as { from?: unknown }).from : undefined;
  } catch {
    from = undefined; // an unreadable history: the clip's own provenance says where it came from
  }
  return { id: typeof from === "string" ? from : (p.orig ?? c.clip.id), license: p.license, label: id.startsWith("{") ? c.clip.id : id };
}

/** game.json's clips and ships (the host reads its tiers, and refuses a file that isn't a JSON object first); E_GAME
 *  (usage) when they aren't clip ids and a boolean. */
async function gameOf(ctx: ToolContext): Promise<{ clips?: string[]; ships?: boolean }> {
  ctx.library(); // game.json's tiers, read and checked by the host
  const g = JSON.parse((await ctx.tryRead("game.json")) ?? "{}") as { clips?: unknown; ships?: unknown };
  const ids = g.clips === undefined || (Array.isArray(g.clips) && g.clips.every((c) => typeof c === "string"));
  if (!ids || (g.ships !== undefined && typeof g.ships !== "boolean")) throw new ToolError("E_GAME", 'game.json\'s "clips" lists clip ids ("SET/Name") and its "ships" is true or false', true);
  return g as { clips?: string[]; ships?: boolean };
}

/** `license.check`: clips, a set ("library": every set) or game.json, at `tiers` (game.json's by default); findings
 *  when one fails, with each fix, and the credits block either way. */
export const licenseCheck = defineTool<{ clips?: string[]; tiers?: Tier[]; ships?: boolean; set?: string }, unknown>({
  name: "license.check",
  description: "Check clips, a set or game.json against licenses and tiers; gives the credits block to show.",
  params: {
    type: "object",
    properties: {
      clips: { type: "array", items: { type: "string" } },
      tiers: { type: "array", items: { type: "string", enum: TIERS } },
      ships: { type: "boolean", description: "default true" },
      set: { type: "string", description: 'or "library"' },
    },
  },
  examples: [{ args: { clips: ["STYLE100/Akimbo_Walk"], tiers: ["cc0", "cc-by"] } }],
  async run(a, ctx) {
    const tiers = [...(a.tiers ?? ctx.library().tiers)], game = await gameOf(ctx), lib = ctx.library(tiers), src = lib.source, ships = a.ships ?? game.ships ?? true;
    const clips = a.clips ?? (a.set === undefined ? game.clips : undefined), labels = new Map<string, string[]>(), own: LicenseFinding[] = [];
    let r: LicenseReport, what: string;
    if (a.set !== undefined) {
      if (a.set !== "library" && !src.sets().includes(a.set)) throw new ToolError("E_ARGS", `no set ${quote(a.set)}${didYouMean(a.set, src.sets())} ("library" checks every set)`, true);
      const tier = a.set === "library" ? null : lib.library.about(a.set).tier;
      if (tier && !tiers.includes(tier)) own.push({ level: "fail", where: a.set, message: `a ${tier} set and this game opts into ${tiers.join(", ")}: opt in, or use another set` });
      [r, what] = [checkSets(src, a.set === "library" ? src.sets().sort() : [a.set], lib.licenseText), a.set === "library" ? "the library" : `set ${a.set}`];
    } else {
      const ids: string[] = [];
      for (const ref of clips ?? []) {
        const o = await originOf(ctx, ref);
        if (o.license !== null && !src.sets().includes(o.id.split("/")[0]!)) own.push({ level: "warn", where: o.label, message: `from no library set (license ${o.license}): check its terms yourself` });
        else {
          ids.push(o.id);
          labels.set(o.id, [...(labels.get(o.id) ?? []), o.label]);
        }
      }
      [r, what] = [checkGame(src, { tiers, ships, ...(clips ? { clips: ids } : {}) }, lib.licenseText), a.clips ? count(a.clips.length, "clip") : clips ? `game.json's ${count(clips.length, "clip")}` : "game.json"];
    }
    // a clip's finding (one at most, in the order given) named as it was given, with the library clip it stands for
    const all = [...own, ...r.findings].map((f) => {
      const label = labels.get(f.where)?.shift() ?? f.where, near = /^no clip /.test(f.message) ? suggestId(lib, f.where) : undefined;
      return { ...f, where: label === f.where ? label : `${label} (from ${f.where})`, message: near ? `${f.message}; did you mean ${quote(near)}?` : f.message };
    });
    const fails = all.filter((f) => f.level === "fail").length, warns = all.length - fails, ok = fails === 0, shown = capped(all, 20);
    return {
      verdict: `license.check ${what} (tiers ${tiers.join(", ")}): ${ok ? `PASS, ${count(r.credits.length, "set")} to credit` : `FAIL, ${fails} failing`}${warns ? `, ${count(warns, "open question")}` : ""}`,
      data: { ok, fails, warns, findings: shown.rows, ...(shown.more ? { more: shown.more } : {}), credits: r.credits, block: r.block },
      lines: [...shown.rows.map((f) => `${f.level} ${f.where}: ${f.message}`), ...(shown.more ? [`more: ${shown.more}`] : []), ...r.block.split("\n")],
      findings: !ok,
      next: ok ? "show the block where the game credits its assets; license.check again when its clips change" : "fix each failing line (opt in to its tier, or search for a clip in yours), then license.check again",
    };
  },
});
