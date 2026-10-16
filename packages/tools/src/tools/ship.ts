// Ship (PLAN.md WP-7.2a, WP-5.7): `license.check`, the clips a game plays, a set, or game.json (its clips, else every
// set of its tiers) against their licenses and the tiers the game opts in to, with the credits block it shows. A
// workshop copy, a clip file or a clip's JSON is checked as each library clip it names (its history's `from`, its
// provenance's `orig` and recipe inputs, its own id), so an edit can't carry a clip out of a tier the game hasn't opted
// in to; and by its own license, each part of which must fit an opted-in tier, its credit owed. One from no library
// clip is an open question, its terms for the game to check.
import type { Clip } from "@m3a/core";
import { checkGame, checkSets, creditsBlock, TIERS, type Credit, type LicenseFinding, type LicenseReport, type Tier } from "@m3a/library";
import { defineTool, ToolError, type ToolContext } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";
import { historyFile, loadClip, suggestId, WORKSHOP } from "./clips.ts";
import { capped, count } from "./common.ts";

/** The tier a license fits, by the library's rule (D10): CC0-1.0 cc0, CC-BY-x.y cc-by, LicenseRef-CMU-Mocap cmu (both
 *  credited), any other only local, which never ships. */
export const tierOf = (license: string): Tier => (license === "CC0-1.0" ? "cc0" : /^CC-BY-\d\.\d$/.test(license) ? "cc-by" : license === "LicenseRef-CMU-Mocap" ? "cmu" : "local");
/** A license's parts: a composed clip carries each of its inputs' licenses, joined with " AND " (D10). */
export const parts = (license: string): string[] => license.split(" AND ").map((p) => p.trim());
/** Whether a game at `tiers` may use what `tier` holds: that tier is among them, or local, which holds anything. */
export const fits = (tier: Tier, tiers: readonly Tier[]): boolean => tiers.includes(tier) || tiers.includes("local");
/** Whether a tier's clips must be credited where they are used: cc-by and cmu. */
export const credited = (t: Tier): boolean => t === "cc-by" || t === "cmu";

/** A clip as license.check sees it: what a finding calls it (as given; a JSON clip by its id), the library clips it
 *  names, and its own data unless it is a library id: a workshop copy's history's `from`, the provenance's `orig` and
 *  recipe inputs, and its own id, each that is a library clip. */
async function originsOf(ctx: ToolContext, given: string): Promise<{ label: string; ids: string[]; clip: Clip | null }> {
  const id = given.trim(), src = ctx.library().source;
  if (!id.startsWith("{") && !/\.json$/i.test(id) && !id.startsWith(`${WORKSHOP}/`)) return { label: id, ids: [id], clip: null };
  const r = await loadClip(ctx, id), p = r.clip.provenance as Clip["provenance"] & { recipe?: { inputs?: Record<string, string> } };
  let from: unknown;
  try {
    from = r.where === "workshop" ? (JSON.parse((await ctx.tryRead(historyFile(r.path!.replace(/^workshop\/|\.json$/g, "")))) ?? "{}") as { from?: unknown }).from : undefined;
  } catch {
    from = undefined; // an unreadable history: the clip's own provenance says where it came from
  }
  const isClip = (x: unknown): x is string => {
    const [set = "", name] = typeof x === "string" ? x.split("/") : [];
    return src.sets().includes(set) && src.files(set).includes(`${name}.json`);
  };
  return { label: id.startsWith("{") ? r.clip.id : id, ids: [...new Set([from, p.orig, ...Object.keys(p.recipe?.inputs ?? {}), r.clip.id].filter(isClip))], clip: r.clip };
}

/** game.json's clips and ships, and whether there is one (the host reads its tiers, and refuses a file that isn't a JSON
 *  object first); E_GAME (usage) when they aren't clip ids and a boolean. */
async function gameOf(ctx: ToolContext): Promise<{ clips?: string[]; ships?: boolean; found: boolean }> {
  ctx.library(); // game.json's tiers, read and checked by the host
  const text = await ctx.tryRead("game.json"), g = JSON.parse(text ?? "{}") as { clips?: unknown; ships?: unknown };
  const ids = g.clips === undefined || (Array.isArray(g.clips) && g.clips.every((c) => typeof c === "string"));
  if (!ids || (g.ships !== undefined && typeof g.ships !== "boolean")) throw new ToolError("E_GAME", 'game.json\'s "clips" lists clip ids ("SET/Name") and its "ships" is true or false', true);
  return { ...(g as { clips?: string[]; ships?: boolean }), found: text !== null };
}

/** `license.check`: clips, a set ("library": every set) or game.json, at `tiers` (game.json's by default); findings
 *  when one fails, with each fix, in the order the clips were given, and the credits block either way. */
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
    if (a.set !== undefined && a.clips) throw new ToolError("E_ARGS", "give clips or set, not both: license.check one, then the other", true);
    if (a.tiers?.length === 0) throw new ToolError("E_ARGS", 'tiers lists at least one tier, as ["cc0"]', true);
    const game = await gameOf(ctx), lib = ctx.library(a.tiers), tiers = [...lib.tiers], src = lib.source, ships = a.ships ?? game.ships ?? true;
    const clips = a.clips ?? (a.set === undefined ? game.clips : undefined), labels = new Map<string, { label: string; i: number }[]>();
    const own: (LicenseFinding & { i: number })[] = [], mine: Credit[] = [], end = clips?.length ?? 0;
    let r: LicenseReport, what: string;
    if (a.set !== undefined) {
      if (a.set !== "library" && !src.sets().includes(a.set)) throw new ToolError("E_ARGS", `no set ${quote(a.set)}${didYouMean(a.set, src.sets())} ("library" checks every set)`, true);
      const tier = a.set === "library" ? null : lib.library.about(a.set).tier;
      if (tier && !tiers.includes(tier)) own.push({ level: "fail", where: a.set, message: `a ${tier} set and this game opts into ${tiers.join(", ")}: opt in, or use another set`, i: 0 });
      [r, what] = [checkSets(src, a.set === "library" ? src.sets().sort() : [a.set], lib.licenseText), a.set === "library" ? "the library" : `set ${a.set}`];
    } else {
      const ids: string[] = [];
      for (const [i, given] of (clips ?? []).entries()) {
        const o = await originsOf(ctx, given);
        for (const id of o.ids) labels.set(id, [...(labels.get(id) ?? []), { label: o.label === id ? id : `${o.label} (from ${id})`, i }]);
        ids.push(...o.ids);
        if (!o.clip) continue;
        // the parts of its own license no library clip it names answers for: each must fit a tier, its credit owed
        const p = o.clip.provenance, covered = new Set(o.ids.map((id) => lib.library.about(id.split("/")[0]!).tier));
        const left = parts(p.license).filter((x) => !covered.has(tierOf(x))), bad = left.filter((x) => !fits(tierOf(x), tiers)), owed = left.filter((x) => !bad.includes(x) && credited(tierOf(x))).sort();
        for (const x of bad) own.push({ level: "fail", where: o.label, message: `its license ${x} needs the ${tierOf(x)} tier and this game opts into ${tiers.join(", ")}: opt in, or use a clip from those tiers`, i });
        const had = mine.find((c) => c.credit === p.credit); // a CC BY or CMU license has a credit line (core's M2-E018)
        if (had && owed.length) Object.assign(had, { title: `${had.title}, ${o.clip.name}`, licenses: [...new Set([...had.licenses, ...owed])].sort(), clips: had.clips + 1 });
        else if (owed.length && p.credit) mine.push({ set: o.label, title: o.clip.name, tier: tierOf(owed[0]!), licenses: owed, credit: p.credit, clips: 1 });
        if (!o.ids.length && !bad.length) own.push({ level: "warn", where: o.label, message: `from no library clip (license ${p.license}): check its terms yourself`, i });
      }
      r = checkGame(src, { tiers, ships, ...(clips ? { clips: ids } : {}) }, lib.licenseText);
      what = a.clips ? count(a.clips.length, "clip") : clips ? `game.json's ${count(clips.length, "clip")}` : game.found ? "game.json" : "every set";
    }
    // each clip's findings named as it was given, with the library clip it stands for, in the order given
    const all = [...own, ...r.findings.map((f) => {
      const l = labels.get(f.where)?.shift(), near = /^no clip /.test(f.message) ? suggestId(lib, f.where) : undefined;
      return { ...f, where: l?.label ?? f.where, message: near ? `${f.message}; did you mean ${quote(near)}?` : f.message, i: l?.i ?? end };
    })].sort((x, y) => x.i - y.i).map(({ i: _, ...f }) => f);
    const fails = all.filter((f) => f.level === "fail").length, warns = all.length - fails, ok = fails === 0, shown = capped(all, 20), credits = [...r.credits, ...mine], block = creditsBlock(credits);
    return {
      verdict: `license.check ${what} (tiers ${tiers.join(", ")}): ${ok ? `PASS, ${count(credits.length, "credit")} owed` : `FAIL, ${fails} failing`}${warns ? `, ${count(warns, "open question")}` : ""}`,
      data: { ok, fails, warns, findings: shown.rows, ...(shown.more ? { more: shown.more } : {}), credits, block },
      lines: [...shown.rows.map((f) => `${f.level} ${f.where}: ${f.message}`), ...(shown.more ? [`more: ${shown.more}`] : []), ...block.split("\n")],
      findings: !ok,
      next: ok ? "put the credits block in the game's credits; license.check again when its clips change" : "fix each failing line (opt in to its tier, or search for a clip in yours), then license.check again",
    };
  },
});
