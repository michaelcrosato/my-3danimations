// The check tools (PLAN.md WP-7.2a §1): a clip measured by the sensors (metrics), drawn as a contact sheet with its
// findings in red (sheet) or as frames moving through space around a moment (film), two clips compared (diff: where
// their poses part, travel, both verdicts and a picture of what moved; findings when b is worse), and the repairs a
// clip needs (lint). Rows are capped, each reply's `next` names the call to make after it (common.ts call) with the
// clip as given (clips.ts naming), and images go through ctx.image with cells at most 125 px wide (film's 160), so
// their cost stays near the plan's: sheet 8 frames ~331 tokens, film 8 ~346, diff 6 ~614.
import { clip as clipNs, format, measureFacts, type Clip, type Rest } from "@m3a/core";
import { measureClipFacts, tagConflicts } from "@m3a/library";
import { checks, fixes, metrics as measure, raster, sheets, type Report } from "@m3a/sensors";
import { defineTool, ToolError, type ToolContext } from "../registry/registry.ts";
import { imageTokens } from "../registry/reply.ts";
import { strip } from "../sim/film.ts";
import { loadClip, naming } from "./clips.ts";
import { call, capped, CLIP, count, cut, mm, round, sec } from "./common.ts";

const RANK = { pass: 0, warn: 1, fail: 2 } as const;
/** Seconds either side of film's moment. */
const AROUND = 0.2;
/** A pose distance over this (mm) counts as a difference in diff's intervals. */
const OVER = 5;

/** A time span with 3 decimals: "0.367–0.433 s". */
const span = (t0: number, t1: number) => `${round(t0, 3).toFixed(3)}–${sec(t1)}`;
/** "more: n" for a capped list, naming its cap. */
const more = (n: number | undefined, cap: number): string[] => (n ? [`more: ${n} (the first ${cap} shown)`] : []);
/** A finding as a row: its times to 3 decimals, its value with its unit, its message cut to a row's 90 characters. */
const row = (f: checks.Finding) => ({
  metric: f.metric, level: f.level, t0: round(f.t0, 3), t1: round(f.t1, 3), value: round(f.value, 2), unit: f.unit, where: f.where ?? null, message: cut(f.message),
});
/** Fail and warn counts: "2 fail, 2 warn". */
const tally = (r: Report) => ((n) => `${n} fail, ${r.findings.length - n} warn`)(r.findings.filter((f) => f.level === "fail").length);
/** The metrics whose findings no fix operator answers. */
const unanswered = (r: Report) => ((all) => [...new Set(r.findings.map((f) => f.metric))].filter((m) => !all.has(m)))(new Set(Object.values(fixes.ANSWERS).flat()));
/** An image's width for `frames` cells of at most 125 px (eight to the sheets' 1,000 px row): fewer frames, a smaller image. */
const cells = (frames: number) => Math.min(1000, frames * 125);
/** A drawing whose poses show no body refused as E_BLANK, an error naming the times. A guard: core's validator refuses
 *  the non-numbers and out-of-range keys that would draw none before a tool gets here. */
export function drawn<T>(draw: () => T): T {
  try {
    return draw();
  } catch (err) {
    if (err instanceof Error && /no body drawn/.test(err.message)) throw new ToolError("E_BLANK", err.message.replace(/^[^:]*: /, ""));
    throw err;
  }
}
/** A clip loaded for a reply, with how a hint (`as`) and a verdict (`title`) name it (clips.ts naming; `whose` tells
 *  diff's two clips apart). */
async function load(ctx: ToolContext, ref: string, whose = "the clip's") {
  const c = await loadClip(ctx, ref);
  return { ...c, ...naming(c, whose) };
}
/** The clip's pose at t on R, a loop's end its cycle's last pose. */
const poseAt = (c: Clip, t: number, R: Rest, out?: Float32Array) => clipNs.sample(c, c.loop && t >= c.dur ? c.dur * (1 - 1e-12) : t, R, out);
/** Where the root stands at t in mm (the format's % of H0 × H0 / 100). */
const rootMm = (c: Clip, t: number, R: Rest) => ((r) => ({ forward: (r.forward * R.H0) / 100, right: (r.right * R.H0) / 100, yaw: r.yaw }))(clipNs.rootAt(c, t));
/** The root's travel over the clip (one cycle of a loop): [forward, right] mm. */
const travel = (c: Clip, R: Rest) => ((r) => [round(r.forward), round(r.right)])(rootMm(c, c.dur, R));

/** Where two clips' poses part, both on rest R, every 1/60 s over the shorter: the largest point distance (mm), its
 *  point and time, the mean of each sample's largest, and the intervals where it is over 5 mm. */
export function poseDiff(a: Clip, b: Clip, R: Rest): { max: number; point: string | null; at: number; mean: number; over: [number, number][] } {
  const dur = Math.min(a.dur, b.dur), n = Math.max(1, Math.ceil(dur * 60)), X = new Float32Array(format.P * 3), Y = new Float32Array(format.P * 3);
  let max = 0, point: string | null = null, at = 0, sum = 0, open: [number, number] | null = null;
  const over: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (dur * i) / n;
    poseAt(a, t, R, X);
    poseAt(b, t, R, Y);
    let worst = 0, p = 0;
    for (let j = 0; j < format.P; j++) {
      const d = Math.sqrt((X[3 * j]! - Y[3 * j]!) ** 2 + (X[3 * j + 1]! - Y[3 * j + 1]!) ** 2 + (X[3 * j + 2]! - Y[3 * j + 2]!) ** 2);
      if (d > worst) [worst, p] = [d, j];
    }
    sum += worst;
    if (worst > max) [max, point, at] = [worst, format.POINTS[p]!, t];
    if (worst > OVER) open = open ? [open[0], t] : [t, t];
    else if (open) {
      over.push(open);
      open = null;
    }
  }
  if (open) over.push(open);
  return { max: round(max), point, at: round(at, 3), mean: round(sum / (n + 1)), over: over.map(([x, y]) => [round(x, 3), round(y, 3)]) };
}

/** `metrics`: a clip's sensors report, its findings worst first, and how it compares with the verdict it records. */
export const metrics = defineTool<{ clip: string; limit: number }, unknown>({
  name: "metrics",
  description: "Measure a clip with the sensors: pass, warn or fail, each finding with its time, body part and repair.",
  params: { type: "object", properties: { clip: CLIP, limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } }, required: ["clip"] },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop" }, expect: "findings" }],
  async run(a, ctx) {
    const c = await load(ctx, a.clip), r = measure(c.clip, c.rest), shown = capped(r.findings, a.limit), q = c.clip.quality, open = unanswered(r);
    const current = q.qaVersion === checks.QA_VERSION, agrees = current && q.qa === (r.verdict === "pass" ? "pass" : "baselined");
    const values = Object.fromEntries(checks.METRICS.filter((k) => !r.off.includes(k)).map((k) => [k, round(r.values[k], 1)]));
    const held = !current ? `, not the current ${checks.QA_VERSION}` : agrees ? ", as measured" : `; the sensors now give ${r.verdict}`;
    return {
      verdict: `metrics ${c.title}: ${r.verdict.toUpperCase()}${r.findings.length ? ` (${tally(r)})` : ""}, ${sec(r.dur)} ${r.loop ? "loop" : "once"}`,
      data: {
        clip: c.id, tier: c.tier, verdict: r.verdict, dur: r.dur, loop: r.loop, profiles: r.profiles, off: r.off, values,
        findings: shown.rows.map(row), ...(shown.more ? { more: shown.more } : {}), total: r.findings.length, recorded: { qa: q.qa, qaVersion: q.qaVersion, current, agrees },
      },
      lines: [...shown.rows.map((f) => `${f.level.toUpperCase()} ${f.metric}: ${f.message}`), ...more(shown.more, a.limit), `recorded: ${q.qa} with ${q.qaVersion}${held}`],
      findings: r.verdict === "fail",
      next: !r.findings.length
        ? `the clip measures clean; ${call("sheet", [c.as])} to look at it`
        : open.length === new Set(r.findings.map((f) => f.metric)).size ? `no repair answers ${open.join(", ")}: search for another clip, or edit its keys`
        : `${call("lint", [c.as])} names the repairs; ${call("sheet", [c.as])} shows the findings in red`,
    };
  },
});

/** `sheet`: a clip's contact sheet, the metrics' findings flagged in red. */
export const sheet = defineTool<{ clip: string; frames: number; view: raster.ViewName }, unknown>({
  name: "sheet",
  description: "A clip as a contact-sheet PNG, the sensors' findings in red.",
  params: {
    type: "object",
    properties: { clip: CLIP, frames: { type: "integer", minimum: 1, maximum: 64, default: 8 }, view: { type: "string", enum: Object.keys(raster.VIEWS), default: "three-quarter" } },
    required: ["clip"],
  },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop", frames: 8 } }],
  async run(a, ctx) {
    const c = await load(ctx, a.clip), r = measure(c.clip, c.rest);
    const s = drawn(() => sheets.sheet(c.clip, c.rest, { frames: a.frames, view: a.view, width: cells(a.frames), flags: r.findings.map((f) => ({ t0: f.t0, t1: f.t1, label: f.metric })) }));
    const image = ctx.image(c.id, s.image), tokens = imageTokens(s.width, s.height), red = capped(r.findings, 10);
    return {
      verdict: `sheet ${c.title}: ${count(s.times.length, "frame")} ${span(s.times[0]!, s.times.at(-1)!)}, ${s.width}x${s.height}, ~${tokens} tokens, ${count(r.findings.length, "finding")} in red`,
      data: {
        clip: c.id, view: a.view, frames: s.times.length, from: round(s.times[0]!, 3), to: round(s.times.at(-1)!, 3), width: s.width, height: s.height, tokens, image,
        flagged: red.rows.map((f) => ({ metric: f.metric, level: f.level, t0: round(f.t0, 3), t1: round(f.t1, 3) })), ...(red.more ? { more: red.more } : {}),
      },
      lines: [...red.rows.map((f) => `red: ${f.metric}${f.where ? ` ${f.where}` : ""} ${span(f.t0, f.t1)} (${f.level})`), ...more(red.more, 10)],
      next: `open the image: red cells are the findings; ${call("metrics", [c.as])} gives the numbers, ${call("film", [c.as])} shows it moving`,
    };
  },
});

/** `film`: frames of a clip moving through space, around a moment (its strike by default) or over the whole clip. */
export const film = defineTool<{ clip: string; frames: number; around?: number }, unknown>({
  name: "film",
  description: "A PNG strip of a clip moving through space around a moment (its strike by default).",
  params: {
    type: "object",
    properties: { clip: CLIP, frames: { type: "integer", minimum: 1, maximum: 16, default: 8 }, around: { type: "number", minimum: 0, description: "seconds" } },
    required: ["clip"],
  },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Punch_Jab", around: 0.147 } }],
  async run(a, ctx) {
    const c = await load(ctx, a.clip), { clip, rest } = c, n = a.frames;
    if (a.around !== undefined && a.around > clip.dur) throw new ToolError("E_ARGS", `around is ${a.around} s, past the clip's end (${sec(clip.dur)})`, true);
    const strike = measureFacts(clip, rest).strike?.[0] ?? null, at = a.around ?? strike;
    const [t0, t1] = at === null ? [0, clip.dur] : [Math.max(0, at - AROUND), Math.min(clip.dur, at + AROUND)];
    const times = at === null ? sheets.sheetTimes(clip, { frames: n }) : n === 1 ? [at] : Array.from({ length: n }, (_, i) => t0 + ((t1 - t0) * i) / (n - 1));
    // the frame nearest each moment (the strike, an event) carries its name: within half a step (a lone frame, a sample)
    const half = times.length > 1 ? (times[1]! - times[0]!) / 2 : 1 / 60, nearest = (t: number) => times.reduce((k, x, i) => (Math.abs(x - t) < Math.abs(times[k]! - t) ? i : k), 0);
    const marks = [...(strike === null ? [] : [{ t: strike, name: "strike" }]), ...(clip.events ?? [])]
      .filter((m) => m.t >= times[0]! - half && m.t <= times.at(-1)! + half)
      .map((m) => ({ t: round(m.t, 3), name: m.name, frame: nearest(m.t) }));
    const named = (i: number) => marks.filter((m) => m.frame === i).map((m) => m.name), labels = times.map((t, i) => [`${t.toFixed(2)} S`, ...named(i)].join(" ").toUpperCase());
    const img = strip(times.map((t) => poseAt(clip, t, rest)), times.map((t) => rootMm(clip, t, rest)), labels, Math.min(160, Math.floor((1568 - 2 * (n - 1)) / n)));
    const image = ctx.image(c.id, img), tokens = imageTokens(img.width, img.height), went = travel(clip, rest);
    const at3 = times.map((t, i) => `${round(t, 3).toFixed(3)}${named(i).length ? ` (${named(i).join(", ")})` : ""}`);
    return {
      verdict: `film ${c.title}: ${count(times.length, "frame")} ${span(times[0]!, times.at(-1)!)}${strike === null ? "" : `, strike at ${sec(strike)}`}, ` +
        `${img.width}x${img.height}, ~${tokens} tokens`,
      data: {
        clip: c.id, frames: times.length, times: times.map((t) => round(t, 3)), strike, marks: marks.map((m) => ({ ...m, name: cut(m.name) })), travel: went,
        width: img.width, height: img.height, tokens, image,
      },
      lines: [`frames at ${at3.join(", ")} s`, `travels ${mm(went[0]!)} forward, ${mm(went[1]!)} right over ${sec(clip.dur)}`],
      next: at === null
        ? `${call("film", [c.as], { around: "<seconds>" })} zooms on a moment; ${call("sheet", [c.as])} shows contacts and findings`
        : `${call("sheet", [c.as])} shows the whole clip with its findings; ${call("metrics", [c.as])} measures it`,
    };
  },
});

/** `diff`: two clips compared on a's rest, pose by pose, metric by metric and pixel by pixel, each clip's travel on its
 *  own rest (as film gives it); findings when b is worse (qa's rule: a worse verdict or more findings), each way it is
 *  worse named (with fix's rule per metric). */
export const diff = defineTool<{ a: string; b: string; frames: number }, unknown>({
  name: "diff",
  description: "Compare two clips: pose distance, travel, both verdicts and a PNG of what moved; findings when b is worse.",
  params: { type: "object", properties: { a: CLIP, b: CLIP, frames: { type: "integer", minimum: 1, maximum: 32, default: 6 } }, required: ["a", "b"] },
  positionals: ["a", "b"],
  examples: [{ args: { a: "QUATERNIUS_3D2DGE/Punch_Jab", b: "QUATERNIUS_3D2DGE/Punch_Cross" } }],
  async run(x, ctx) {
    const A = await load(ctx, x.a, "a's"), B = await load(ctx, x.b, "b's"), R = A.rest, mb = checks.motionOf(B.clip, B.rest), ra = measure(A.clip, A.rest), rb = checks.measure(mb);
    const pose = poseDiff(A.clip, B.clip, R), d = drawn(() => sheets.compareClips(A.clip, B.clip, R, { frames: x.frames, width: cells(x.frames) }));
    const image = ctx.image(`${A.id}-vs-${B.id}`, d.image), over = capped(pose.over, 5), [va, vb] = [ra.verdict, rb.verdict];
    const worse = RANK[vb] > RANK[va] || rb.findings.length > ra.findings.length ? [...(RANK[vb] > RANK[va] ? [`verdict ${va} → ${vb}`] : []), ...fixes.worse(mb, ra, rb)] : [];
    const keys = checks.METRICS.filter((k) => !ra.off.includes(k) && !rb.off.includes(k) && round(ra.values[k], 1) !== round(rb.values[k], 1));
    const by = (k: checks.MetricName) => Math.abs(rb.values[k] - ra.values[k]) / checks.THRESHOLDS[k].fail;
    const moved = capped(keys.map((k) => ({ metric: k, a: round(ra.values[k], 1), b: round(rb.values[k], 1), by: by(k) })).sort((p, q) => q.by - p.by), 8);
    const same = pose.max === 0 && d.changed === 0, went = { a: travel(A.clip, A.rest), b: travel(B.clip, B.rest) }, shorter = sec(Math.min(A.clip.dur, B.clip.dur));
    const parted = same ? "no difference" : pose.max ? `poses differ up to ${mm(pose.max)} (${pose.point} at ${sec(pose.at)})` : "the same poses";
    const verdicts = `${va.toUpperCase()} → ${vb.toUpperCase()} (${ra.findings.length} → ${count(rb.findings.length, "finding")})`;
    return {
      verdict: `diff ${A.title} → ${B.title}: ${parted}; ${verdicts}${worse.length ? "; b is worse" : ""}`,
      data: {
        a: A.id, b: B.id, rest: `${A.clip.restSrc} (a's)`, dur: [A.clip.dur, B.clip.dur], pose: { ...pose, over: over.rows, ...(over.more ? { more: over.more } : {}) }, travel: went,
        metrics: { verdict: [va, vb], findings: [ra.findings.length, rb.findings.length], changed: moved.rows.map(({ by: _, ...m }) => m), ...(moved.more ? { more: moved.more } : {}) },
        worse, pixels: { changed: d.changed, box: d.box }, image,
      },
      lines: [
        ...worse.map((w) => `worse: ${w}`),
        ...(JSON.stringify(B.rest) === JSON.stringify(R) ? [] : [`b drawn on a's rest (${A.clip.restSrc}): a clip's keys are rest-relative`]),
        ...(A.clip.dur === B.clip.dur
          ? []
          : [`the image compares by phase (frame i of n at i/n of each clip) with two cameras, so pixels.changed counts the floor too; the poses by time over the shorter ${shorter}`]),
        ...(over.rows.length ? [`poses over ${OVER} mm apart: ${over.rows.map(([p, q]) => span(p, q)).join(", ")}`, ...more(over.more, 5)] : []),
        ...moved.rows.map((m) => `${m.metric} ${m.a} → ${m.b}`),
        ...more(moved.more, 8),
        ...([...went.a, ...went.b].some((v) => v !== 0) ? [`travel ${went.a.map(mm).join(", ")} → ${went.b.map(mm).join(", ")} (forward, right)`] : []),
      ],
      findings: worse.length > 0,
      next: worse.length ? `b is worse: keep a, or ${call("lint", [B.as])} names its repairs` : `open the image: magenta marks what moved; ${call("metrics", [B.as])} gives b's findings`,
    };
  },
});

/** `lint`: the fix operators a clip's findings ask for, the tags its measured facts contradict, and what no operator
 *  answers. */
export const lint = defineTool<{ clip: string }, unknown>({
  name: "lint",
  description: "The repairs a clip needs (fix's operators) and the tags its motion doesn't bear out.",
  params: { type: "object", properties: { clip: CLIP }, required: ["clip"] },
  positionals: ["clip"],
  examples: [{ args: { clip: "QUATERNIUS_3D2DGE/Walk_Loop" }, expect: "findings" }],
  async run(a, ctx) {
    const c = await load(ctx, a.clip), r = measure(c.clip, c.rest), l = fixes.lint(c.clip, c.rest, r), open = unanswered(r);
    const tags = tagConflicts(c.clip, measureClipFacts(c.clip, c.rest).facts, c.rest), ops = l.items.map((i) => i.op), fixed = r.findings.filter((f) => !open.includes(f.metric)).length;
    const what = [
      ...(ops.length ? [`fix ${ops.join(", ")}${fixed ? ` (${count(fixed, "finding")})` : ""}`] : []),
      ...(tags.length ? [`${tags.length === 1 ? "tag" : "tags"} ${tags.map((t) => t.tag).join(", ")} ${tags.length === 1 ? "doesn't" : "don't"} hold`] : []),
      ...(open.length ? [`no repair answers ${open.join(", ")}`] : []),
    ];
    return {
      verdict: `lint ${c.title}: ${what.join("; ") || "nothing to fix"}`,
      data: {
        clip: c.id, verdict: r.verdict, repairs: l.items.map((i) => ({ op: i.op, reasons: i.why.length, why: i.why.slice(0, 3).map((w) => cut(w)) })),
        tags: tags.map((t) => ({ ...t, message: cut(t.message) })), unanswered: open,
      },
      lines: [...l.text.split("\n").slice(1).map((s) => s.replace(/^ {2}\.\.\. (\d+) more$/, "  more: $1")), ...tags.map((t) => `tag ${t.tag}: ${t.message}`)],
      findings: ops.length + tags.length > 0,
      next: ops.length
        ? `${call("fix", [c.as])} applies ${ops.join(", ")}, keeping only steps that don't make it worse; diff it with the fixed copy`
        : tags.length ? `${call("edit", [c.as], { ...(c.where === "text" && { save_as: "WORKSHOP/<Name>" }), ops: [{ op: "meta", tags: c.clip.tags.filter((t) => !tags.some((x) => x.tag === t)) }] })} drops ${tags.map((t) => t.tag).join(", ")}; or search for another clip`
        : open.length ? `no repair answers ${open.join(", ")}: search for another clip, or edit its keys` : `nothing to fix; ${call("metrics", [c.as])} gives the values`,
    };
  },
});
