// Find and read (PLAN.md WP-7.2a): `search` the library for a game moment in words and filters, `show` a clip's keys
// as text with its source, license, fit, speed and strike (the format's legend on request), and `describe` it as a
// short timeline. Each opens the library at the game's tiers; show flags a file or workshop clip whose set the game
// hasn't opted in to (or that is no library set's), since that set's license is what would ship.
import { format } from "@m3a/core";
import { mps } from "@m3a/library";
import { describe as timeline } from "@m3a/sensors";
import { defineTool, ToolError, type LibraryAccess } from "../registry/registry.ts";
import { MAX_LINES } from "../registry/reply.ts";
import { quote } from "../registry/schema.ts";
import { loadClip, type ClipRef } from "./clips.ts";
import { capped, CLIP, count, cut, sec } from "./common.ts";

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

/** A warning line when shipping `ref` needs a tier the game hasn't opted in to, or its set is no library set's (a file's
 *  or workshop copy's: a library id is refused before); null when its set's license is the game's to ship. */
export function tierWarning(ref: ClipRef, lib: LibraryAccess): string | null {
  if (ref.tier === null) return `warning: ${quote(ref.id)} is from no library set: its license (${ref.clip.provenance.license}) is for you to check`;
  const set = ref.where === "workshop" ? (ref.source?.set ?? ref.set) : ref.set;
  return lib.tiers.includes(ref.tier) ? null : `warning: ${set} is a ${ref.tier} set: add "${ref.tier}" to "tiers" in game.json before shipping it`;
}

/** `show`: a clip's keys from `from` as the format writes them, a page at a time, with what it is and where it came from. */
export const show = defineTool<{ clip: string; from: number; legend: boolean }, unknown>({
  name: "show",
  description: "A clip's keys as text from time `from` (5 per reply), with source, license, fit, speed and strike; legend: true explains the numbers.",
  params: { type: "object", properties: { clip: CLIP, from: { type: "number", minimum: 0, default: 0 }, legend: { type: "boolean", default: false } }, required: ["clip"] },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.4 } }],
  async run(a, ctx) {
    const ref = await loadClip(ctx, a.clip), lib = ctx.library(), c = ref.clip, p = c.provenance, src = ref.source, name = ref.path ?? ref.id;
    const first = c.keys.findIndex((k) => k.t >= a.from - 1e-6), n = c.keys.length;
    if (first < 0) throw new ToolError("E_ARGS", `from is ${a.from}, past the last key (${sec(c.keys[n - 1]!.t)})`, true);
    const f = (c.facts ?? {}) as { speed?: number; strike?: number[]; height?: [number, number] }, speed = mps(f.speed ?? null), credit = src?.credit ?? p.credit ?? null;
    const summary = [
      `"${cut(c.desc)}" [${c.tags.join(" ")}]`,
      ...(f.strike?.length ? [`strike ${f.strike.map(sec).join(", ")}`] : []),
      ...(speed === null ? [] : [`${speed} m/s`]),
      ...(f.height ? [`hips ${f.height[0]}-${f.height[1]}%`] : []),
      `fit ${c.quality.fit[0]}/${c.quality.fit[1]} mm`,
      `qa ${c.quality.qa}`,
      `${p.src}${src ? ` (${src.label})` : ""}, ${p.method}, ${p.license}, ${credit ? `credit owed: ${credit}` : "no credit owed"}`,
    ].join("; ");
    const warn = tierWarning(ref, lib), head = [summary, ...(warn ? [warn] : [])];
    // a page is what the text shows uncut on every surface: the verdict, the head, a cut's line, report.json's and next's
    const keys = c.keys.slice(first).map((k) => format.keyLines({ ...k }, format.GROUPS_2, "").replace("\n", "")), size = (k: string) => k.split("\n").length;
    const room = MAX_LINES - 4 - head.length, all = keys.reduce((s, k) => s + size(k), 0) <= room + 1;
    let shown = 0;
    for (let used = 0; shown < keys.length && (all || used + size(keys[shown]!) <= room); shown++) used += size(keys[shown]!);
    const after = c.keys[first + shown], legend = a.legend ? lib.library.about(src?.set ?? lib.source.sets().sort()[0]!).legend : null;
    return {
      verdict: `show ${ref.id}: ${sec(c.dur)} ${c.loop ? "loop" : "once"}, ${c.fps} fps, keys ${first + 1}-${n} of ${n} from ${sec(c.keys[first]!.t)}`,
      data: {
        id: ref.id, set: ref.set, tier: ref.tier, dur: c.dur, loop: c.loop, fps: c.fps, keys: n, from: c.keys[first]!.t, first: first + 1, tags: c.tags, desc: c.desc,
        facts: c.facts ?? null, speed, fit: c.quality.fit, qa: c.quality.qa, credit, legend: legend && { version: c.legend, text: legend },
        source: { src: p.src, label: src?.label ?? null, origin: src?.origin ?? null, license: p.license, url: src?.url ?? null, method: p.method, ...(p.take ? { take: p.take } : {}) },
        text: format.keyLens({ ...c, keys: c.keys.slice(first, first + shown).map((k) => ({ ...k })) }),
      },
      lines: [...head, ...(legend ? legendLines(legend) : keys)],
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
    const ref = await loadClip(ctx, a.clip), d = timeline(ref.clip, ref.rest, { detail: a.detail }), name = ref.path ?? ref.id;
    const phases = capped(d.phases, 20), moments = capped(d.moments, 20), more = (phases.more ?? 0) + (moments.more ?? 0);
    const at = d.moments.find((m) => m.name === "strike" || m.name === "land"), key = at && ref.clip.keys.findLast((k) => k.t <= at.t + 1e-6);
    return {
      verdict: `describe ${ref.id}: ${d.text}`,
      data: { ...d, phases: phases.rows, moments: moments.rows, ...(more ? { more } : {}) },
      lines: a.detail ? [...d.phases.map((p) => `${p.t0.toFixed(3)}-${sec(p.t1)} ${p.name}${p.detail ? `: ${p.detail}` : ""}`), ...d.moments.map((m) => m.text)] : [],
      next: `show ${name}${at && key ? ` from: ${key.t} reads the keys at its ${at.name}` : " reads its keys"}; sheet ${name} draws it`,
    };
  },
});
