// Find and read (PLAN.md WP-7.2a): `search` the library for a game moment in words and filters, `show` a clip's keys
// as text with its source, license, fit, speed and strike (the format's legend on request), and `describe` it as a
// short timeline. Each opens the library at the game's tiers; show flags a file, JSON or workshop clip whose set, the
// library clips its provenance names, or license need a tier the game hasn't opted in to (or that is from no library
// set), by license.check's rule, since that is what would ship.
import { format } from "@m3a/core";
import { mps, type Tier } from "@m3a/library";
import { describe as timeline } from "@m3a/sensors";
import { defineTool, ToolError } from "../registry/registry.ts";
import { MAX_LINES } from "../registry/reply.ts";
import { quote } from "../registry/schema.ts";
import { absolute, loadClip, type ClipRef } from "./clips.ts";
import { capped, CLIP, count, cut, sec } from "./common.ts";
import { credited, fits, libraryClips, namedBy, parts, tierOf } from "./ship.ts";

/** The library's opt-in as game.json takes it: `opt in with tiers: [..., "x"]` becomes `add "x" to "tiers" in game.json`. */
export const optIn = (next: string): string => next.replace(/opt in with tiers: \[(?:"[^"]*", )*"([^"]*)"\]/g, 'add "$1" to "tiers" in game.json');

/** `search`: the library's rows for a query at the game's tiers, best first, the core clips first among equals. */
export const search = defineTool<{ query: string; limit: number }, unknown>({
  name: "search",
  description: "Library clips for a game moment in words and filters (loop, once, dur<2, speed>1.5, tag:x, set:X), best first.",
  params: { type: "object", properties: { query: { type: "string", description: '"" lists the core clips' }, limit: { type: "integer", minimum: 1, maximum: 40, default: 10 } }, required: ["query"] },
  positionals: ["query"],
  examples: [{ args: { query: "drinks a potion" } }],
  run(a, ctx) {
    const lib = ctx.library(), r = lib.library.search(a.query, { limit: a.limit }), top = r.rows[0]?.id, notes = r.next && optIn(r.next);
    return {
      verdict: `search ${quote(a.query)}: ${r.rows.length} of ${count(r.total, "clip")} (tiers ${lib.tiers.join(", ")})`,
      data: { tiers: lib.tiers, total: r.total, rows: r.rows, ...(r.total > r.rows.length ? { more: r.total - r.rows.length } : {}) },
      lines: r.rows.map((h) => `${h.id} ${sec(h.dur)} ${h.loop ? "loop" : "once"}${h.speed === null ? "" : `, ${h.speed} m/s`} [${h.tags.join(" ")}] ${h.desc}${h.core ? " (core)" : ""}`),
      next: top ? `describe ${top} or show ${top}${notes ? `; ${notes}` : ""}` : `${notes || "no clip matches"}; search again`,
    };
  },
});

/** The legend's lines with each wrapped line joined to the one it continues, and its worked key left out. */
function legendLines(text: readonly string[]): string[] {
  const out: string[] = [];
  for (const l of text) {
    if (l.startsWith("A worked key")) break;
    if (/^\s/.test(l) && out.length) out[out.length - 1] += ` ${l.trim()}`;
    else out.push(l);
  }
  return out;
}

/** How a next hint names `ref`: its id (WORKSHOP/<Name> for a workshop copy, so its history applies), or its path as
 *  given (JSON-quoted when it holds a space or control character); null for clip JSON or an absolute path, which a
 *  reply doesn't echo. */
export function nameOf(ref: ClipRef): string | null {
  if (ref.where === "workshop") return `WORKSHOP/${ref.name}`;
  if (ref.where !== "file" || absolute(ref.path!)) return ref.where === "library" ? ref.id : null;
  return /[\s\p{Cc}]/u.test(ref.path!) ? JSON.stringify(ref.path) : ref.path;
}

/** A warning line when shipping `ref` (a file, JSON or workshop clip: a library id is held to the tiers before) needs
 *  tiers `tiers` lacks, by the set it came from, the sets of the library clips its provenance names (`named`, [set,
 *  tier] each) and each part of its license; else, when it is from no library set, that its license is the user's to
 *  check; null when the game may ship it. */
export function tierWarning(ref: ClipRef, tiers: readonly Tier[], named: readonly (readonly [string, Tier])[] = []): string | null {
  if (ref.where === "library") return null;
  const license = ref.clip.provenance.license;
  const out = [...(ref.tier ? [[ref.home, ref.tier] as const] : []), ...named].filter(([, t]) => !tiers.includes(t));
  const missing = [...new Set([...out.map(([, t]) => t), ...parts(license).map(tierOf).filter((t) => !fits(t, tiers))])];
  if (missing.includes("local")) return `warning: its license (${license}) fits no tier a shipped game opts in to (D10)`;
  const why = `${[...new Set(out.map(([s, t]) => `${s} is a ${t} set, `))].join("")}its license is ${license}`;
  if (missing.length) return `warning: add ${missing.map((t) => `"${t}"`).join(" and ")} to "tiers" in game.json before shipping it (${why})`;
  return ref.tier === null && !named.length ? `warning: ${quote(ref.id)} is from no library set: its license (${license}) is for you to check` : null;
}

/** `show`: a clip's keys from `from` as the format writes them, a page at a time, with what it is and where it came from. */
export const show = defineTool<{ clip: string; from: number; legend: boolean }, unknown>({
  name: "show",
  description: "A clip's keys as text from time `from` (5 per reply), with source, license, fit, speed and strike; legend: true explains the numbers.",
  params: { type: "object", properties: { clip: CLIP, from: { type: "number", minimum: 0, default: 0 }, legend: { type: "boolean", default: false } }, required: ["clip"] },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.4 } }],
  async run(a, ctx) {
    const ref = await loadClip(ctx, a.clip), lib = ctx.library(), c = ref.clip, p = c.provenance, src = ref.source, name = nameOf(ref) ?? "with the same clip";
    const first = c.keys.findIndex((k) => k.t >= a.from - 1e-6), n = c.keys.length;
    if (first < 0) throw new ToolError("E_ARGS", `from is ${a.from}, past the last key (${sec(c.keys[n - 1]!.t)})`, true);
    const f = (c.facts ?? {}) as { speed?: number; strike?: number[]; height?: [number, number] }, speed = mps(f.speed ?? null);
    // the credit owed: a library clip's set's line, as license.check's credits block gives it; else the clip's own
    const owed = parts(p.license).some((x) => credited(tierOf(x))), credit = owed ? (ref.where === "library" ? lib.library.about(ref.set).credit : p.credit)?.trim() || null : null;
    const summary = [
      `"${cut(c.desc)}" [${c.tags.join(" ")}]`,
      ...(f.strike?.length ? [`strike ${f.strike.map(sec).join(", ")}`] : []),
      ...(speed === null ? [] : [`${speed} m/s`]),
      ...(f.height ? [`hips ${f.height[0]}-${f.height[1]}%`] : []),
      `fit ${c.quality.fit[0]}/${c.quality.fit[1]} mm`,
      `qa ${c.quality.qa}`,
      `${p.src}${src ? ` (${src.label})` : ""}, ${p.method}, ${p.license}, ${credit ? `credit owed: ${credit}` : owed ? "credit owed, none given" : "no credit owed"}`,
    ].join("; ");
    const named = libraryClips(lib, [ref.origin, ...namedBy(c)]).map((id) => [id.split("/")[0]!, lib.library.about(id.split("/")[0]!).tier] as const);
    const warn = tierWarning(ref, lib.tiers, named), head = [...(a.legend ? [] : [summary]), ...(warn ? [warn] : [])];
    // a page is what the text shows whole on every surface, beside the verdict, the head, the library's warnings (a
    // deprecated id), report.json's line and next's; the reply holds that page alone, so it stays small on every page
    const keys = c.keys.slice(first).map((k) => format.keyLines({ ...k }, format.GROUPS_2, "").replace("\n", "")), size = (k: string) => k.split("\n").length;
    const room = MAX_LINES - 3 - head.length - new Set(lib.warnings).size;
    let shown = 0;
    for (let used = 0; shown < keys.length && (!shown || used + size(keys[shown]!) <= room); shown++) used += size(keys[shown]!);
    const after = c.keys[first + shown], legend = a.legend ? lib.library.about(src?.set ?? lib.source.sets().sort()[0]!).legend : null;
    return {
      verdict: `show ${ref.id}: ${legend ? "the legend of its keys' numbers" : `${sec(c.dur)} ${c.loop ? "loop" : "once"}, ${c.fps} fps, keys ${first + 1}-${first + shown} of ${n} from ${sec(c.keys[first]!.t)}`}`,
      data: {
        id: ref.id, set: ref.set, tier: ref.tier, dur: c.dur, loop: c.loop, fps: c.fps, keys: n, from: c.keys[first]!.t, first: first + 1, tags: c.tags, desc: c.desc,
        facts: c.facts ?? null, speed, fit: c.quality.fit, qa: c.quality.qa, credit, legend: legend && { version: c.legend, text: legend },
        source: { src: p.src, label: src?.label ?? null, origin: src?.origin ?? null, license: p.license, url: src?.url ?? null, method: p.method, ...(p.take ? { take: p.take } : {}) },
        text: legend ? null : format.keyLens({ ...c, keys: c.keys.slice(first, first + shown).map((k) => ({ ...k })) }),
      },
      lines: [...head, ...(legend ? legendLines(legend) : keys.slice(0, shown))],
      next: a.legend ? `show ${name} from: ${c.keys[first]!.t} for the keys` : after ? `show ${name} from: ${after.t} continues (keys ${first + shown + 1}-${n} of ${n}); describe ${name} for its timeline` : `describe ${name} for its timeline; sheet ${name} draws it`,
    };
  },
});

/** `describe`: the sensors' timeline of a clip (phases, landings, strikes, travel), one line per phase and moment with detail. */
export const describe = defineTool<{ clip: string; detail: boolean }, unknown>({
  name: "describe",
  description: "A clip as a short timeline: phases (stand, walk, run, crouch, sit, lie, air), landings, strikes, travel.",
  params: { type: "object", properties: { clip: CLIP, detail: { type: "boolean", default: false } }, required: ["clip"] },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Jump_Land" } }],
  async run(a, ctx) {
    const ref = await loadClip(ctx, a.clip), d = timeline(ref.clip, ref.rest, { detail: a.detail }), name = nameOf(ref) ?? "with the same clip";
    const phases = capped(d.phases, 20), moments = capped(d.moments, 20), more = (phases.more ?? 0) + (moments.more ?? 0);
    const at = d.moments.find((m) => m.name === "strike" || m.name === "land"), key = at && ref.clip.keys.findLast((k) => k.t <= at.t + 1e-6);
    return {
      verdict: `describe ${ref.id}: ${d.text}`,
      data: { ...d, phases: phases.rows, moments: moments.rows, ...(more ? { more } : {}) },
      // each time as the tools write one (3 decimals): a moment's text without the sensors' own " at 0.42 s"
      lines: a.detail ? [...phases.rows.map((p) => `${p.t0.toFixed(3)}-${sec(p.t1)} ${p.name}${p.detail ? `: ${p.detail}` : ""}`), ...moments.rows.map((m) => `${sec(m.t)} ${m.text.replace(/ at [\d.]+ s$/, "")}`), ...(more ? [`more: ${more}`] : [])] : [],
      next: `show ${name}${at && key ? ` from: ${key.t} reads the keys at its ${at.name}` : " reads its keys"}; sheet ${name} draws it`,
    };
  },
});
