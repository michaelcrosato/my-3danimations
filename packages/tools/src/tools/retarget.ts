// Retarget (PLAN.md WP-7.2b §1): a character bound through core (body.ts: io reads its skeleton, core recognizes and
// binds it, never three.js's loader) and shown (retarget.inspect: how its bones were recognized, how sure, what is
// missing or odd, its rest, hip height and limb lengths, and the patch to edit and pass back; findings, with a rest
// turntable when it binds, while an issue stands: a required bone missing, only the bones' shape naming them, a
// hierarchy the mapping breaks, hips under half the legs; a mesh io can't read is said, but no patch clears it, so it
// is no finding, meshIssue), and clips played on it (retarget.apply: each judged on this body as G4's sweep judges a
// skeleton, D80, judge.ts: it passes unless the body adds a fail finding or a joint misses its point; frames of the
// first clip the body adds a fail to; an issue inspect finds a warning, the mesh's a note; at most 600 s of clips, no
// foot held past MAX_HOLD, no feet's holds reread past MAX_REREAD).
// Rows are capped with the shared more line, the character and clips are named as clips.ts names a file, and each
// reply's next names the call after it.
import { format, skeleton } from "@m3a/core";
import { turntable } from "@m3a/sensors";
import { defineTool, ToolError } from "../registry/registry.ts";
import { strip } from "../sim/film.ts";
import { bodyOf, CHARACTER, characterName, characterOf, MAPPING, meshIssue, type MappingPatch } from "./body.ts";
import { given, loadClip, naming, prose } from "./clips.ts";
import { arg, call, capped, count, cut, imageName, mm, more, output, round } from "./common.ts";
import { boundHolds, contactsFor, onBody, type Played } from "./judge.ts";

/** The most clips retarget.apply plays in one call. */
const MAX_CLIPS = 20;
/** The most clip time (s) retarget.apply plays in one call: as long as one clip may last (M2-E010), 36,000 samples at
 *  the judge's 60 a second, the most steps graph.sim runs. It bounds clip time; the cost is bounded by MAX_HOLD and
 *  MAX_REREAD (judge.ts), as core's planter is superlinear in a held foot's stretch (contact/plant.ts): no clip plays a
 *  foot held past 15 s, which takes about 2 s here, nor feet whose holds it rereads past 16 s at a step (60 s of such a
 *  clip at that limit took 4.6 s). */
const MAX_DUR = format.LIMITS.dur;
/** The clip a next hint offers to play first: the library's core walk (cc0). */
const WALK = "QUATERNIUS_3D2DGE/Walk_Loop";

/** The issues standing against the mapping: all but the patch itself and the mesh's (meshIssue: no patch clears it). */
const standing = (issues: readonly string[]) => issues.filter((i) => i !== "patched by hand" && !meshIssue(i));
/** Up to three clips by their titles, and how many more: a next hint stays short. */
const some = (xs: readonly { title: string }[]): string => `${xs.slice(0, 3).map((x) => x.title).join(", ")}${xs.length > 3 ? ` and ${xs.length - 3} more` : ""}`;

/** `retarget.inspect`: a character bound and its report, as data and lines; findings while an issue other than the patch
 *  itself or the mesh's stands: a required bone missing (its likely source bones named), topology alone naming the bones
 *  (until a patch confirms them; a VRM's humanoid names its own), a hierarchy the mapping breaks, or hips under half the
 *  legs. A mesh io can't read is an issue no patch clears: said, with what re-exporting mends, and the next plays clips. */
export const inspect = defineTool<{ character: string; mapping?: MappingPatch }, unknown>({
  name: "retarget.inspect",
  description: "Bind a character: bones recognized, confidence, missing, rest, limb lengths and a mapping patch to edit.",
  params: { type: "object", properties: { character: CHARACTER, mapping: MAPPING }, required: ["character"] },
  output: output({
    character: "string", bones: "integer", method: "string", table: "string?", vrm: "boolean", confidence: "number", required: "object", missing: "array", candidates: "object", unmapped: "array",
    issues: "array", rest: "object", H0: "number?", lengths: "object", patch: "object",
  }),
  positionals: ["character"],
  examples: [{ args: { character: "spec/vectors/tier1b/rigify.gltf" } }],
  async run(a, ctx) {
    const c = await characterOf(ctx, a.character, a.mapping), r = c.report, as = characterName(a.character), said = prose(as), of = skeleton.REQUIRED_BONES.length;
    const unsure = standing(r.issues).length > 0; // a required bone missing is one too
    const un = capped(r.unmapped, 10), is = capped(r.issues, 5), cuts = { ...(un.more ? { unmapped: un.more } : {}), ...(is.more ? { issues: is.more } : {}) };
    // a wrong mapping shows as bent limbs at rest: four sides of it, ~137 tokens
    if (unsure && c.bound) ctx.image(imageName(as), turntable(c.bound.restPts, { n: 4, size: 160 }));
    const how = r.vrm ? "by its VRM humanoid" : r.method === "table" ? `by name (${r.table})` : r.method === "topology" ? "by topology" : "not at all";
    const H0 = c.bound ? round(c.bound.rest.H0) : null, play = call("retarget.apply", [as], { clips: [WALK], mapping: a.mapping });
    const fill = { bones: { ...a.mapping?.bones, ...Object.fromEntries(r.missing.map((b) => [b, "<its bone>"])) } };
    return {
      verdict: `retarget.inspect ${said}: ${count(r.bones, "bone")} ${how}, confidence ${r.confidence.toFixed(2)}, ${of - r.missing.length} of ${of} required` +
        `, rest ${r.rest.kind}${H0 === null ? "" : `, hip height ${mm(H0)}`}`,
      data: {
        character: said, bones: r.bones, method: r.method, table: r.table, vrm: r.vrm, confidence: r.confidence, required: { mapped: of - r.missing.length, of }, missing: r.missing,
        candidates: r.candidates, unmapped: un.rows, issues: is.rows.map((i) => cut(i)), ...(un.more || is.more ? { more: cuts } : {}), rest: { kind: r.rest.kind, armDrop: round(r.rest.armDrop) }, H0, lengths: r.lengths, patch: r.patch,
      },
      lines: r.text.split("\n").slice(1).map((l) => l.replace(/^\.\.\. (\d+) more issues$/, (_, n: string) => more(Number(n), "issue")[0]!)),
      findings: unsure,
      next: r.missing.length
        ? `give each missing bone its source bone (data.candidates names the likely ones): ${call("retarget.inspect", [as], { mapping: fill })}`
        : unsure ? `check data.issues: fix data.patch and pass it back with ${call("retarget.inspect", [as], { mapping: "<the patch>" })}, or play clips on it: ${play}`
        : `${play} plays clips on it`,
    };
  },
});

/** `retarget.apply`: clips played on a bound character, each judged as the sweep judges a skeleton (D80); findings
 *  when one fails, with frames of the first the body adds a fail to as it played there. A clip that won't load, clips
 *  lasting past MAX_DUR in all, or one holding its feet past MAX_HOLD or MAX_REREAD (judge.ts) refuse the call before
 *  any plays; an issue retarget.inspect finds against the mapping is the reply's first line, a warning, and the mesh's a
 *  note. */
export const apply = defineTool<{ character: string; clips: string[]; mapping?: MappingPatch }, unknown>({
  name: "retarget.apply",
  description: "Play clips on a character: each passes or fails against its own body, with joint reach and metrics made worse.",
  params: { type: "object", properties: { character: CHARACTER, clips: { type: "array", items: { type: "string" }, description: "at most 20" }, mapping: MAPPING }, required: ["character", "clips"] },
  output: output({ character: "string", H0: "number", mapped: "string", passed: "integer", failed: "integer", clips: "array" }),
  positionals: ["character"],
  examples: [{ args: { character: "spec/vectors/tier1b/rigify.gltf", clips: [WALK] } }],
  async run(a, ctx) {
    if (!a.clips.length || a.clips.length > MAX_CLIPS) throw new ToolError("E_ARGS", `clips lists ${count(a.clips.length, "clip")}; give 1 to ${MAX_CLIPS}, and call again for more`, true);
    const loaded = [];
    for (const ref of a.clips) loaded.push(await loadClip(ctx, ref));
    const dur = loaded.reduce((t, k) => t + k.clip.dur, 0);
    // rounded up, so the total said is past the limit too
    if (dur > MAX_DUR) throw new ToolError("E_ARGS", `clips last ${Math.ceil(dur * 10) / 10} s in all, past the ${MAX_DUR} s one call plays; give fewer or shorter clips, and call again for the rest`, true);
    // no foot held past MAX_HOLD, nor feet's holds reread past MAX_REREAD, as each clip plays (onBody plays it with these
    // contacts)
    for (const k of loaded) boundHolds({ ...k.clip, contacts: contactsFor(k.clip, k.rest) }, naming(k).title);
    const c = await bodyOf(ctx, a.character, a.mapping), as = characterName(a.character), said = prose(as), H0 = round(c.bound.rest.H0), see = call("retarget.inspect", [as], { mapping: a.mapping });
    // the first clip the body adds a fail to, as it played there (the frames the metric read), to draw
    const drawn: { p: Played; dur: number; clip: string }[] = [];
    const rows = loaded.map((k) => {
      const seen: { p?: Played } = {}, j = onBody(k.clip, k.rest, c.bound, said, (p) => (seen.p = p));
      if (!drawn.length && seen.p && j.worse.some((w) => w.level === "fail")) drawn.push({ p: seen.p, dur: k.clip.dur, clip: j.clip });
      // where and path kept: a hint passes a clip file's path as given (given), not the name naming quoted for a shell
      return { ...naming(k), where: k.where, path: k.path, j };
    }), failed = rows.filter((x) => !x.j.ok), stand = standing(c.report.issues), mesh = c.report.issues.filter(meshIssue);
    for (const { p, dur, clip } of drawn) {
      const n = p.frames.length, at = [...new Set(Array.from({ length: 8 }, (_, i) => Math.round((i * (n - 1)) / 7)))];
      ctx.image(imageName(`${clip}-on-${as}`), strip(at.map((i) => p.frames[i]!), at.map((i) => p.root[i]), at.map((i) => `${((i * dur) / (n - 1)).toFixed(2)} S`), 125));
    }
    // a fail first, so the 20-line cut keeps it
    const lines = [...rows].sort((x, y) => Number(x.j.ok) - Number(y.j.ok)).flatMap(({ title, j }) => {
      const why = capped(j.why, 2);
      const warned = j.worse.filter((w) => w.level === "warn").map((w) => w.metric);
      return j.ok ? [`PASS ${title}: own ${j.own}, played ${j.played}, reach ${mm(j.reach)}${warned.length ? `; this body adds a warn: ${warned.join(", ")}` : ""}`]
        : [`FAIL ${title}: ${why.rows.map((w) => cut(w)).join("; ")}`, ...more(why.more, "reason")];
    });
    // a joint off its point, or a play that threw: the body's bones, not the clip
    const off = failed.filter((x) => x.j.why.some((w) => /^a joint |^the solve |^threw: /.test(w)));
    return {
      verdict: `retarget.apply ${said}: ${rows.length - failed.length} of ${count(rows.length, "clip")} ${rows.length - failed.length === 1 ? "passes" : "pass"} on it (hip height ${mm(H0)})`,
      data: {
        character: said, H0, mapped: a.mapping ? "patched" : c.report.vrm ? "humanoid" : c.report.method, passed: rows.length - failed.length, failed: failed.length,
        clips: rows.map(({ j }) => {
          const why = capped(j.why, 2), worse = capped(j.worse, 3), cuts = { ...(why.more ? { why: why.more } : {}), ...(worse.more ? { worse: worse.more } : {}) };
          return {
            clip: j.clip, ok: j.ok, own: j.own, played: j.played, reach: round(j.reach), why: why.rows.map((w) => cut(w)),
            worse: worse.rows.map((w) => ({ metric: w.metric, level: w.level, own: w.own === null ? null : round(w.own, 1), played: w.played === null ? null : round(w.played, 1) })), ...(why.more || worse.more ? { more: cuts } : {}),
          };
        }),
      },
      lines: [...(stand.length ? [`warning: retarget.inspect finds ${count(stand.length, "issue")} on it: ${cut(stand[0]!, 60)}; ${see} shows ${stand.length === 1 ? "it" : "them"}`] : []), ...mesh.map((i) => `note: ${cut(i)}`), ...lines],
      findings: failed.length > 0,
      next: off.length
        ? `a joint missed its point, or the play threw, on ${some(off)}: the mapping is likely wrong there; ${see} shows it`
        : failed.length && stand.length ? `${some(failed)} ${failed.length === 1 ? "fails" : "fail"} while retarget.inspect's issue stands: fix the mapping first; ${see} shows it`
        : failed.length ? `this body takes ${some(failed)} past a fail level its own body doesn't (D80): ${call("search", [arg(failed[0]!.j.clip.split("/").pop()!.replace(/_/g, " "))])} finds others like it`
        : `they play on it; ${call("license.check", [], { clips: rows.map((x) => given(x.as, x.where === "file" ? x.path! : x.as)) })} checks the game may ship them`,
    };
  },
});
