// Ship (PLAN.md WP-7.2a, WP-5.7): `license.check`, the clips a game plays, a set, or game.json (its clips, else every
// set of its tiers) against their licenses and the tiers the game opts in to, with the credits block it shows. A
// workshop copy, a clip file or a clip's JSON is checked as each library clip it names (its history's `from`, its
// provenance's `orig` and recipe inputs, its own id), so an edit can't carry a clip out of a tier the game hasn't opted
// in to; by the set its id or history names; and by its own license, each part of which must fit an opted-in tier. The
// parts of its credit line no library clip it names carries are its own credits owed, and a license that owes credit
// with none left to give fails. One from no library clip is an open question, its terms for the game to check; one that
// won't load is a finding, so one check reports every problem.
import type { Clip } from "@m3a/core";
import { checkGame, checkSets, credited, creditsBlock, tierOf, TIERS, type Credit, type LicenseFinding, type LicenseReport, type Tier } from "@m3a/library";
import { defineTool, ToolError, type ToolContext } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";
import { absolute, fits, libraryClips, namedBy, parts, readClip, suggestId } from "./clips.ts";
import { call, capped, count, more, output, ROW_CHARS } from "./common.ts";

/** A given name as a finding echoes it (D92): as given when it is a plain id or path of at most 60 characters, else
 *  JSON-quoted and cut to 60, so no control character in it starts a line of its own. */
const echo = (x: string): string => (/^[\w./-]{1,60}$/.test(x) ? x : quote(x));
/** A clips list as license.check takes one: a clip or more, none blank. */
const listed = (c: unknown): boolean => Array.isArray(c) && c.length > 0 && c.every((x) => typeof x === "string" && x.trim() !== "");

/** A clip as license.check sees it: what a finding calls it (as given; a JSON clip or absolute path by its id), the
 *  library clips it names, and its own data unless it is a library id: the library clip its workshop history names,
 *  its provenance's `orig` and recipe inputs, and its own id, each that is a library clip; and the set it belongs to
 *  (clips.ts's `home`), with that set's tier (null when it is no library set). */
async function originsOf(ctx: ToolContext, given: string): Promise<{ label: string; ids: string[]; clip: Clip | null; set: string; tier: Tier | null }> {
  const id = given.trim();
  if (!id.startsWith("{") && !/\.json$/i.test(id) && !id.startsWith("WORKSHOP/")) return { label: echo(id), ids: [id], clip: null, set: id, tier: null };
  const r = await readClip(ctx, id), ids = libraryClips(ctx.library(), [r.origin, ...namedBy(r.clip), r.clip.id]);
  return { label: echo(id.startsWith("{") || absolute(id) ? r.clip.id : id), ids, clip: r.clip, set: r.home, tier: r.tier };
}

/** game.json's clips and ships, and whether there is one (the host reads its tiers, and refuses a file that isn't a JSON
 *  object first); E_GAME (usage) when they aren't clip ids and a boolean. */
async function gameOf(ctx: ToolContext): Promise<{ clips?: string[]; ships?: boolean; found: boolean }> {
  ctx.library(); // game.json's tiers, read and checked by the host
  const text = await ctx.tryRead("game.json"), g = JSON.parse(text ?? "{}") as { clips?: unknown; ships?: unknown };
  if ((g.clips !== undefined && !listed(g.clips)) || (g.ships !== undefined && typeof g.ships !== "boolean")) throw new ToolError("E_GAME", 'game.json\'s "clips" lists one clip id or more ("SET/Name"), none blank, and its "ships" is true or false', true);
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
  output: output({ ok: "boolean", fails: "integer", warns: "integer", findings: "array", credits: "array", block: "string" }),
  examples: [{ args: { clips: ["STYLE100/Akimbo_Walk"], tiers: ["cc0", "cc-by"] } }],
  async run(a, ctx) {
    if (a.set !== undefined && a.clips) throw new ToolError("E_ARGS", "give clips or set, not both: license.check one, then the other", true);
    if (a.clips && !listed(a.clips)) throw new ToolError("E_ARGS", 'clips lists one clip or more, as ["SET/Name"], none blank', true);
    if (a.tiers?.length === 0) throw new ToolError("E_ARGS", 'tiers lists at least one tier, as ["cc0"]', true);
    if (a.set === "library" && (a.tiers || a.ships !== undefined)) throw new ToolError("E_ARGS", 'set "library" audits every set with no tier gate: give it no tiers or ships, or name a set', true);
    const game = await gameOf(ctx), lib = ctx.library(a.tiers), tiers = [...lib.tiers], src = lib.source, ships = a.ships ?? game.ships ?? true;
    const clips = a.clips ?? (a.set === undefined ? game.clips : undefined), labels = new Map<string, { label: string; i: number }[]>();
    const own: (LicenseFinding & { i: number })[] = [], mine: Credit[] = [], end = clips?.length ?? 0, at = `this game opts into ${tiers.join(", ")}`;
    const fail = (where: string, message: string, i: number) => own.push({ level: "fail", where, message, i }), seen = new Set<Tier>(); // the tiers of what is checked
    let r: LicenseReport, what: string, stray = false;
    if (a.set !== undefined) {
      if (a.set !== "library" && !src.sets().includes(a.set)) throw new ToolError("E_ARGS", `no set ${quote(a.set)}${didYouMean(a.set, src.sets())} ("library" checks every set)`, true);
      const tier = a.set === "library" ? null : lib.library.about(a.set).tier;
      if (tier && !tiers.includes(tier)) fail(a.set, `a ${tier} set and ${at}: opt in, or use another set`, 0);
      if (tier === "local" && ships) fail(a.set, "local content never ships (D10): drop it, or mark the manifest ships: false for a game that stays on this machine", 0);
      if (tier && ships && tiers.includes("local")) fail("tiers", "a shipped game opts into local: local content never ships (D10)", 0);
      for (const s of a.set === "library" ? src.sets() : [a.set]) seen.add(lib.library.about(s).tier);
      [r, what] = [checkSets(src, a.set === "library" ? src.sets().sort() : [a.set], lib.licenseText), a.set === "library" ? "the library" : `set ${a.set}`];
    } else {
      const ids: string[] = [], made = (id: string) => (JSON.parse(src.read(id.split("/")[0]!, `${id.split("/")[1]}.json`)) as Clip).provenance;
      for (const [i, raw] of (clips ?? []).entries()) {
        const given = raw.trim(), file = !given.startsWith("{") && /\.json$/i.test(given), hide = file && absolute(given);
        let o: Awaited<ReturnType<typeof originsOf>>;
        try {
          if (file && (await ctx.tryRead(given)) === null) throw new ToolError("E_NO_CLIP", "no such file: give a path under the working directory, or a clip id", true);
          o = await originsOf(ctx, given);
        } catch (err) {
          // one that won't load is a finding, so one check reports every problem; a path out of the working directory is refused
          if (!(err instanceof ToolError) || err.code === "E_PATH") throw err;
          fail(given.startsWith("{") ? "the clip JSON" : hide ? "the clip file" : echo(given), hide ? err.message.replaceAll(quote(given), "it").replace(/^the clip file /, "it ") : err.message, i);
          continue;
        }
        for (const id of o.ids) labels.set(id, [...(labels.get(id) ?? []), { label: o.label === echo(id) ? o.label : `${o.label} (from ${echo(id)})`, i }]);
        ids.push(...o.ids);
        const named = new Set(o.ids.map((id) => id.split("/")[0]!).filter((s) => src.sets().includes(s)).map((s) => lib.library.about(s).tier));
        for (const t of named) seen.add(t);
        if (!o.clip) continue;
        // the set its id or history names, when no library clip it names is that set's; then each part of its own license
        // no such set answers for, which must fit a tier
        const p = o.clip.provenance, was = own.length;
        for (const x of parts(p.license)) seen.add(tierOf(x));
        if (o.tier && !tiers.includes(o.tier) && !named.has(o.tier)) fail(o.label, `${o.set} is a ${o.tier} set and ${at}: opt in, or use a clip from those tiers`, i);
        for (const x of parts(p.license).filter((x) => !named.has(tierOf(x)) && tierOf(x) !== o.tier && !fits(tierOf(x), tiers))) {
          fail(o.label, tierOf(x) === "local" && ships ? `its license ${x} fits no tier a shipped game may opt into (D10): replace the clip, or set ships: false` : `its license ${x} needs the ${tierOf(x)} tier and ${at}: opt in, or use a clip from those tiers`, i);
        }
        // its credit line's parts (compile joins its inputs' with "; ") that no library clip it names carries are its own to
        // credit; a credited license part that no named library clip carries, with no such credit, fails
        const owed = [...new Set(parts(p.license).filter((x) => credited(tierOf(x))))].sort(), theirs = new Set(o.ids.map((id) => made(id).credit));
        const credit = owed.length ? (p.credit ?? "").split("; ").filter((c) => c.trim() && !theirs.has(c)).join("; ") : "", had = mine.find((c) => c.credit === credit);
        const carried = new Set(o.ids.flatMap((id) => parts(made(id).license))), bare = owed.filter((x) => !carried.has(x));
        if (!credit && bare.length) fail(o.label, `its license ${bare.join(" and ")} needs a credit line (provenance.credit): add the attribution`, i);
        if (credit && had) Object.assign(had, { title: `${had.title}, ${o.clip.name}`, licenses: [...new Set([...had.licenses, ...owed])].sort(), clips: had.clips + 1 });
        else if (credit) mine.push({ set: o.label, title: o.clip.name, tier: tierOf(owed[0]!), licenses: owed, credit, clips: 1 });
        stray ||= !o.ids.length;
        if (!o.ids.length && own.length === was) own.push({ level: "warn", where: o.label, message: `from no library clip (license ${p.license}): check its terms yourself`, i });
      }
      if (!clips) for (const t of src.sets().map((s) => lib.library.about(s).tier)) if (tiers.includes(t)) seen.add(t);
      r = checkGame(src, { tiers, ships, ...(clips ? { clips: ids } : {}) }, lib.licenseText);
      what = a.clips ? count(a.clips.length, "clip") : clips ? `game.json's ${count(clips.length, "clip")}` : game.found ? "game.json" : "every set";
    }
    // each clip's findings named as it was given, with the library clip it stands for, in the order given
    const all = [...own, ...r.findings.map((f) => {
      // the library writes a given id as it was, in quotes: quoted again as a finding echoes it
      const l = labels.get(f.where)?.shift(), near = /^no clip /.test(f.message) ? suggestId(lib, f.where) : undefined, message = f.message.split(`"${f.where}"`).join(quote(f.where));
      return { ...f, where: l?.label ?? echo(f.where), message: near ? `${message}; did you mean ${quote(near)}?` : message, i: l?.i ?? end };
    })].sort((x, y) => x.i - y.i).map(({ i: _, ...f }) => f);
    // the same call, to make again (one past a row's length, as JSON clips make it, is named so)
    const same = call("license.check", [], { clips: a.clips, tiers: a.tiers, ships: a.ships, set: a.set }), again = same.length > ROW_CHARS ? "the same license.check" : same;
    const fails = all.filter((f) => f.level === "fail").length, warns = all.length - fails, ok = fails === 0, shown = capped(all, 20), credits = [...r.credits, ...mine];
    // "CC0 clips" only when every clip checked is (none from the library when one is from no library clip)
    const block = !credits.length && [...seen].some((t) => t !== "cc0") ? "Motion: no credit is owed." : stray ? creditsBlock(credits).replace(" from the m3a library", "") : creditsBlock(credits);
    return {
      verdict: `license.check ${what} (${a.set === "library" ? "every tier" : `tiers ${tiers.join(", ")}`}): ${ok ? `PASS, ${count(credits.length, "credit")} owed` : `FAIL, ${fails} failing`}${warns ? `, ${count(warns, "open question")}` : ""}`,
      data: { ok, fails, warns, findings: shown.rows, ...(shown.more ? { more: shown.more } : {}), credits, block },
      lines: [...shown.rows.map((f) => `${f.level} ${f.where}: ${f.message}`), ...more(shown.more, "finding"), ...block.split("\n")],
      findings: !ok,
      next: ok ? `put the credits block in the game's credits; ${again} again when its clips change` : `fix each failing line as it says (each names its fix), then ${again} again`,
    };
  },
});
