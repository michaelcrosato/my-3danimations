// The rate sweep's answers (D127): each loop that fails a row is answered in library/baselines/rates.json, its cause
// one of the file's causes and why it fails, with the numbers. The validator's rule on their shape; the gate (a failing
// loop with no answer fails the sweep, an answered loop that fails no row is reported, on a sample only where the
// sample played every row the baseline holds for it); --baseline carrying the answers of the loops that still fail and
// dropping the rest; the committed answers against the committed rows (each the bodies and rates of its loop's rows,
// each reading it quotes its row's); and the two loops D127 read again, played at the 6 rows they failed, passing or
// warning now.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { libraryClips } from "../qa/qa.ts";
import { answersStep } from "./rates-cli.ts";
import { againstRateAnswers, loopOf, rateBaselineOf, rateBaselineProblems, rateBaselineText, rateRows, readRateBaseline, rowKey, type RateBaseline, type RateRow } from "./rates.ts";
import { rigOf } from "./sweep.ts";

/** A row by hand on `rig`: its verdict and, failing, a reason. */
const row = (clip: string, rate: number, verdict: RateRow["verdict"], rig = "gen-0"): RateRow => ({ clip, rig, rate, verdict, why: verdict === "fail" ? ["skate 20.0 cm/s at 1, past its fail level 17.5"] : [], warns: [], slide: 0, skate: 0, still: 0, levels: { slide: [69, 106], skate: [8.3, 17.5], still: [219, 219] } });
const why = (n: number) => `${n} rows: the numbers`;
/** A body as an answer names it. */
const BODY: Record<string, string> = { "the mannequin": "quaternius-mannequin-m", "the knight": "kaykit-knight" };
const bodyOf = (name: string) => BODY[name] ?? name;
/** "a", "a and b", "a, b and c" as a list. */
const listOf = (s: string) => s.split(/, | and /);
/**
 * The rows an answer's why opens with, `<body> <rate>` each: "13 rows (1 on gen-0; 1.5 and 2 on all six bodies): ...",
 * a body named, a list of them, "all six bodies" or "every body but the knight".
 */
function rowsNamed(why: string, rigs: readonly string[]): string[] {
  const head = /^\d+ rows? \((.+?)\): /.exec(why)?.[1] ?? "", out: string[] = [];
  for (const group of head.split("; ")) {
    const at = group.indexOf(" on "), who = group.slice(at + 4);
    const bodies = who === "all six bodies" ? rigs : who.startsWith("every body but ") ? rigs.filter((r) => r !== bodyOf(who.slice(15))) : listOf(who).map(bodyOf);
    for (const rate of listOf(group.slice(0, at))) for (const b of bodies) out.push(`${b} ${rate}`);
  }
  return out.sort();
}
/**
 * Each reading an answer quotes, with the row it is of and the reason that row must hold: "slide 238.0 mm against
 * 172.8 on gen-3" at the rate of the sentence it closes ("at 0.5 its right foot ..."), and "at 2 on the knight no foot
 * stands".
 */
function readingsOf(why: string): { row: string; reason: string }[] {
  const out: { row: string; reason: string }[] = [];
  for (const m of why.matchAll(/(slide|skate) (\d+\.\d) (mm|cm\/s) against (\d+\.\d) on (gen-\d|the mannequin|the knight)/g)) {
    const rate = [...why.slice(0, m.index).matchAll(/\bat (\d+(?:\.\d+)?) (?:its|on) /g)].at(-1)?.[1];
    out.push({ row: `${bodyOf(m[5]!)} ${rate}`, reason: `${m[1]} ${m[2]} ${m[3]} at ${rate}, past its fail level ${m[4]}` });
  }
  for (const m of why.matchAll(/\bat (\d+(?:\.\d+)?) on (gen-\d|the mannequin|the knight) no foot stands/g)) out.push({ row: `${bodyOf(m[2]!)} ${m[1]}`, reason: `no foot stands still at ${m[1]}` });
  return out;
}

describe("the rate sweep's answers", () => {
  it("validates their shape: a cause named in causes, a why, keyed by loop; causes keyed by a hyphenated name", () => {
    const schema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "rates.schema.json"), "utf8")) as object);
    const base = { rates: [1], rigs: ["gen-0"], loops: 1, causes: { "steps-merge": "two contacts read as one" }, answers: { "S/A": { cause: "steps-merge", why: why(1) } }, failing: { "S/A gen-0 1": ["r"] } };
    expect([rateBaselineProblems(base), schema(base)]).toEqual([[], true]);
    const answers = "answers maps a loop `<set>/<clip>` to its cause, one of causes, and why it fails, a text", causes = "causes maps a cause's name (lower-case words joined by hyphens) to what it means, a text";
    // a cause causes doesn't name (the validator's alone: the schema can't say it), a why that's empty, a field an
    // answer doesn't have, a key that isn't a loop's
    expect(rateBaselineProblems({ ...base, answers: { "S/A": { cause: "hops", why: why(1) } } })).toEqual([answers]);
    for (const a of [{ "S/A": { cause: "steps-merge", why: "" } }, { "S/A": { cause: "steps-merge", why: why(1), rows: 1 } }, { "S/A gen-0": { cause: "steps-merge", why: why(1) } }, { "S/A": "why" }]) expect([rateBaselineProblems({ ...base, answers: a }), schema({ ...base, answers: a })], JSON.stringify(a)).toEqual([[answers], false]);
    for (const c of [{ Steps: "x" }, { "steps-merge": "" }, { "steps merge": "x" }]) expect(rateBaselineProblems({ ...base, causes: c }), JSON.stringify(c)).toContain(causes);
    expect(schema({ ...base, causes: { Steps: "x" } })).toBe(false);
  });
  it("fails the sweep on a loop failing a row with no answer, and reports an answered loop that fails no row where the sweep played every row held for it", () => {
    const base = { failing: { "S/Held gen-0 1": ["r"], "S/Held gen-1 1": ["r"], "S/Fixed gen-0 2": ["r"], "S/Gone gen-0 1": ["r"] }, answers: { "S/Held": { cause: "c", why: why(2) }, "S/Fixed": { cause: "c", why: why(1) }, "S/Gone": { cause: "c", why: why(1) }, "S/Stale": { cause: "c", why: why(1) } } };
    // a whole run: S/New fails unanswered; S/Fixed passes its row; S/Stale holds no row; S/Gone wasn't played at all
    const rows = [row("S/New", 1, "fail"), row("S/Held", 1, "fail"), row("S/Held", 1, "warn", "gen-1"), row("S/Fixed", 2, "pass")];
    expect(againstRateAnswers(base, rows)).toEqual({ unanswered: ["S/New"], passing: ["S/Fixed", "S/Stale"] });
    // a sample on gen-1 alone: S/Held passes there but fails a row the sample didn't play, so it isn't reported
    expect(againstRateAnswers(base, [row("S/Held", 1, "pass", "gen-1"), row("S/Fixed", 1, "pass", "gen-1")])).toEqual({ unanswered: [], passing: ["S/Stale"] });
    // the CLI's step: fails naming each unanswered loop with its rows, reports each answered one that fails no row
    const warnings: string[] = [], step = answersStep({ ...base, about: "", rates: [1], rigs: ["gen-0"], loops: 4, causes: { c: "c" } }, rows, "rates.json", warnings);
    expect([step.ok, step.summary, step.detail]).toEqual([false, "1 of the 2 loops failing a row answered in rates.json, 1 not: answer each; 2 answered loops fail no row now", ["S/New: fails 1 row, no answer"]]);
    expect(warnings).toEqual(["S/Fixed is answered but fails no row now: --baseline drops its answer", "S/Stale is answered but fails no row now: --baseline drops its answer"]);
    expect(answersStep({ ...base, about: "", rates: [1], rigs: ["gen-0"], loops: 4, causes: { c: "c" } }, rows.slice(1), "rates.json", []).ok).toBe(true);
  });
  it("--baseline carries the answers of the loops that still fail, drops the rest and the causes no answer names, one a line", () => {
    const kept = { causes: { hop: "a hop", drag: "a drag", unused: "none" }, answers: { "S/A": { cause: "hop", why: why(1) }, "S/B": { cause: "drag", why: why(1) }, "S/C": { cause: "hop", why: why(1) } } };
    const made = rateBaselineOf([row("S/A", 1, "fail"), row("S/B", 1, "pass"), row("S/C", 0.5, "fail"), row("S/D", 2, "fail")], 4, ["gen-0"], [0.5, 1, 2], kept), text = rateBaselineText(made);
    expect([Object.keys(made.answers), made.causes]).toEqual([["S/A", "S/C"], { hop: "a hop" }]);
    // S/D fails with no answer: the baseline holds its row, and the gate asks for its answer
    expect(againstRateAnswers(made, [row("S/D", 2, "fail")]).unanswered).toEqual(["S/D"]);
    expect([JSON.parse(text), text.split("\n").filter((l) => l.startsWith('  "S/A": {"cause"')).length, rateBaselineProblems(JSON.parse(text))]).toEqual([made, 1, []]);
  });
  it("reads an answer's rows and readings as the baseline keys and words them", () => {
    const rigs = ["gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight"];
    expect(rowsNamed("4 rows (0.5 on gen-0, gen-2 and the knight; 1.5 and 2 on every body but the knight): ...", rigs)).toEqual(["gen-0 0.5", "gen-0 1.5", "gen-0 2", "gen-1 1.5", "gen-1 2", "gen-2 0.5", "gen-2 1.5", "gen-2 2", "gen-3 1.5", "gen-3 2", "kaykit-knight 0.5", "quaternius-mannequin-m 1.5", "quaternius-mannequin-m 2"]);
    expect(rowsNamed("6 rows (1 on all six bodies): ...", rigs)).toHaveLength(6);
    expect(readingsOf("3 rows (...): at 0.5 its right foot slides 9 mm at a median 0.38 H0/s: slide 149.1 mm against 98.2 on the knight; and at 2 on the mannequin no foot stands: ...")).toEqual([
      { row: "kaykit-knight 0.5", reason: "slide 149.1 mm at 0.5, past its fail level 98.2" },
      { row: "quaternius-mannequin-m 2", reason: "no foot stands still at 2" },
    ]);
  });
  it("answers every loop the committed baseline fails, and no other: each answer the bodies and rates of its rows, each reading it quotes its row's", () => {
    const b: RateBaseline = readRateBaseline(), held = new Map<string, string[]>();
    for (const k of Object.keys(b.failing)) held.set(loopOf(k), [...(held.get(loopOf(k)) ?? []), k]);
    expect(Object.keys(b.answers).sort()).toEqual([...held.keys()].sort());
    expect(Object.keys(b.causes).sort()).toEqual([...new Set(Object.values(b.answers).map((a) => a.cause))].sort());
    for (const [id, a] of Object.entries(b.answers)) {
      const rows = held.get(id)!;
      // its count of rows, and each body and rate it fails at, as the baseline holds them
      expect(a.why, id).toMatch(new RegExp(`^${rows.length} rows? \\(`));
      expect(rowsNamed(a.why, b.rigs), id).toEqual(rows.map((k) => k.slice(id.length + 1)).sort());
      // each reading it quotes, one of its rows' reasons
      const readings = readingsOf(a.why);
      expect(readings.length, id).toBeGreaterThan(0);
      for (const { row, reason } of readings) expect(b.failing[`${id} ${row}`]?.some((r) => r.startsWith(reason)), `${id}: ${reason} on ${row}`).toBe(true);
    }
  });
  it("plays the two loops D127 read again at the 6 rows they failed: each passes or warns now", async () => {
    // the rows dropped from the baseline: a robot's run on gen-1, a swimming run on three bodies
    const dropped: [string, string, number][] = [["STYLE100_RUN/Robot_Run", "gen-1", 1], ["STYLE100_RUN/Swimming_Run", "gen-2", 1], ["STYLE100_RUN/Swimming_Run", "kaykit-knight", 1.5], ["STYLE100_RUN/Swimming_Run", "kaykit-knight", 2], ["STYLE100_RUN/Swimming_Run", "quaternius-mannequin-m", 1.5], ["STYLE100_RUN/Swimming_Run", "quaternius-mannequin-m", 2]];
    const lib = new Map(libraryClips().map((c) => [c.clip.id, c])), bodies = new Map<string, Awaited<ReturnType<typeof rigOf>>["core"]>(), out: string[] = [];
    for (const [id, rig, rate] of dropped) {
      if (!bodies.has(rig)) bodies.set(rig, (await rigOf(rig)).core);
      const [r] = rateRows(lib.get(id)!, bodies.get(rig)!, rig, [rate]);
      out.push(`${rowKey(r!)} ${r!.verdict === "fail" ? "fails" : "holds"}`);
    }
    expect(out).toEqual(dropped.map(([id, rig, rate]) => `${id} ${rig} ${rate} holds`));
    expect(dropped.filter(([id, rig, rate]) => readRateBaseline().failing[`${id} ${rig} ${rate}`])).toEqual([]);
  }, 60_000);
});
