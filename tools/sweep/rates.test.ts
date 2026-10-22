// The root-motion rate sweep (D123): a loop at a rate on a body plays as `Animator.pose()` poses it, moved by its
// root's travel; the fail rule's edges on gen-0 (a core jog passes at every rate; a keyed run's skate past its warn
// level at 0.5 warns; a side run fails at 2 alone, the manual's top rate judged as the others; B1's planted skater, the
// jog at its own rate moved at the speed B1 asks of a run, fails with no foot standing); the gate against the
// committed baseline (a failing row not in it fails, a baselined one passes the gate, a baselined one that passes now is
// reported) and the baseline's shape; and `npm run sweep -- --rates` on a sample, against the baseline. T2's full step
// (M3A_FULL=1, D74) sweeps every locomotion loop at every rate on the six bodies against the baseline.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { Animator, contact, type Bound } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { cacheChildren } from "../run/compile-cache.ts";
import { libraryClips, type LibraryClip } from "../qa/qa.ts";
import { ratesUsage, type RateResults } from "./rates-cli.ts";
import { againstRateBaseline, cycleSteps, isRateLoop, playRates, RATE_BASELINE, RATE_RIGS, rateBaselineOf, rateBaselineProblems, rateBaselineText, rateClip, rateRows, RATES, rateVerdict, readRateBaseline, rowKey, type RateRow } from "./rates.ts";
import { rigOf } from "./sweep.ts";

const FULL = process.env.M3A_FULL === "1";
let library: LibraryClip[] | undefined, body: Promise<Bound> | undefined;
/** A library clip by id. */
const load = (id: string): LibraryClip => (library ??= libraryClips()).find((c) => c.clip.id === id)!;
/** gen-0 (a chibi, hips 438 mm up), bound once. */
const gen0 = (): Promise<Bound> => (body ??= rigOf("gen-0").then((b) => b.core));
// the `npm run sweep` processes compile through one cache (tools/run/compile-cache.ts)
cacheChildren();
/** A row by hand: its verdict, reasons and readings. */
const row = (clip: string, rate: number, verdict: RateRow["verdict"]): RateRow => ({ clip, rig: "gen-0", rate, verdict, why: verdict === "fail" ? ["skate 20.0 cm/s at 1, past its fail level 17.5"] : [], warns: [], slide: 0, skate: 0, still: 0, levels: { slide: [69, 106], skate: [8.3, 17.5], still: [219, 219] } });

describe("the root-motion rate sweep", () => {
  it("plays a loop at each rate as the Animator poses it, moved by its root's travel", async () => {
    // a keyed run at every rate and a captured walk of another set's shares at two, against the Animator stepped at the
    // same step with the layer at that speed: the points (planted, on the root) and the root within a nanometre (the
    // sweep reaches a clip time by its share of the cycle, the Animator by adding its steps)
    const b = await gen0(), run = rateClip(load("MESH2MOTION/Run_Female")), walk = rateClip(load("STYLE100/Neutral_Walk")), runs = playRates(run, b);
    // a clip time two rates share is posed once: 1's every step is 0.5's every other one
    expect([runs[0]!.frames.length, runs[2]!.frames.length, runs[2]!.frames[7]]).toEqual([101, 51, runs[0]!.frames[14]]);
    expect(runs[2]!.frames[7]).toBe(runs[0]!.frames[14]);
    for (const [c, p] of [...runs.map((p) => [run, p] as const), ...playRates(walk, b, [0.75, 2]).map((p) => [walk, p] as const)]) {
      const n = p.frames.length - 1, h = 1 / p.hz, a = new Animator(b, { step: h }).layer("run", { clip: c, speed: p.rate });
      expect([n, Math.abs(p.hz - 60) / 60 < 0.015], `${c.id} at ${p.rate}`).toEqual([cycleSteps(c.dur, p.rate), true]);
      let most = 0;
      for (let i = 0; i < n; i++) {
        const q = a.pose(undefined, {});
        for (let j = 0; j < q.points.length; j++) most = Math.max(most, Math.abs(q.points[j]! - p.frames[i]![j]!));
        most = Math.max(most, Math.abs(q.root.forward - p.root[i]!.forward), Math.abs(q.root.right - p.root[i]!.right));
        a.step(h);
      }
      // a cycle on, the root has gone as far as the Animator's
      most = Math.max(most, Math.abs(a.root.forward - p.root[n]!.forward));
      expect(most, `${c.id} at ${p.rate}`).toBeLessThan(1e-6);
    }
  }, 60_000);
  it("plays every rate's cycle in whole steps near 60 a second", () => {
    expect(RATES.map((r) => cycleSteps(0.833, r))).toEqual([100, 67, 50, 33, 25]);
    for (const c of (library ??= libraryClips()).filter((x) => isRateLoop(x.clip))) for (const r of RATES) expect(Math.abs((cycleSteps(c.clip.dur, r) * r) / c.clip.dur - 60), `${c.clip.id} at ${r}`).toBeLessThanOrEqual(1);
  });
  it("passes, warns and fails a row by the sensors' levels on its body, every rate judged alike", async () => {
    const b = await gen0(), rows = (id: string) => rateRows(load(id), b, "gen-0");
    // the core jog: still feet at every rate
    expect(rows("QUATERNIUS_3D2DGE/Jog_Fwd_Loop").map((r) => [r.rate, r.verdict, r.still])).toEqual(RATES.map((r) => [r, "pass", 0]));
    // a keyed run (D106's): its skate past its warn level at 0.5, and no further
    const run = rows("MESH2MOTION/Run_Female");
    expect(run.map((r) => r.verdict)).toEqual(["warn", "pass", "pass", "pass", "pass"]);
    expect([run[0]!.why, run[0]!.warns]).toEqual([[], [expect.stringMatching(/^skate \d+\.\d cm\/s at 0\.5, past its warn level 8\.3$/)]]);
    // a side run that fails at the manual's top rate alone fails there: 2 is judged as 1 is
    const side = rows("STYLE100_SIDERUN/Morris_SideRunRight");
    expect(side.map((r) => r.verdict)).toEqual(["pass", "pass", "pass", "pass", "fail"]);
    expect(side[4]!.why).toEqual([expect.stringMatching(/^slide \d+\.\d mm at 2, past its fail level 105\.9$/), expect.stringMatching(/^skate \d+\.\d cm\/s at 2, past its fail level 17\.5$/)]);
  }, 60_000);
  it("fails B1's planted skater: the jog at its own rate, moved at the speed B1 asks of a run, has no foot that stands", async () => {
    // B1's planted "skates" solution moves the character at the asked speed (3.5 hip heights a second) with the run at
    // rate 1; this jog steps 5.25 of them, so each foot slides about 1.75 hip heights a second, too fast to read as standing
    const b = await gen0(), c = rateClip(load("QUATERNIUS_3D2DGE/Jog_Fwd_Loop")), own = contact.contactRoot(c, b.rest, c.contacts!).speed;
    expect(own / b.rest.H0).toBeCloseTo(5.25, 1);
    const [skater] = playRates(c, b, [1], 3.5 * b.rest.H0), r = rateVerdict(c.id, "gen-0", skater!, b.rest);
    expect([r.verdict, r.slide, r.skate, r.still > r.levels.still[1]]).toEqual(["fail", 0, 0, true]);
    expect(r.why).toEqual([expect.stringMatching(/^no foot stands still at 1: the stiller foot's slowest tenth moves \d\.\d\d m\/s \(at most 0\.22\)$/)]);
  }, 60_000);
  it("gates against the baseline: a failing row not in it fails, one in it doesn't, one in it that passes now is reported", () => {
    const base = { failing: { [rowKey(row("S/Baselined", 1, "fail"))]: ["skate"], [rowKey(row("S/Better", 2, "fail"))]: ["slide"] } };
    const rows = [row("S/New", 1, "fail"), row("S/Baselined", 1, "fail"), row("S/Better", 2, "pass"), row("S/Warned", 1, "warn"), row("S/Baselined", 0.5, "fail")];
    const { failures, better } = againstRateBaseline(base, rows);
    expect([failures.map(rowKey), better.map(rowKey)]).toEqual([["S/New gen-0 1", "S/Baselined gen-0 0.5"], ["S/Better gen-0 2"]]);
    // the committed baseline holds the side run's failing row at 2, and not the planted skater's
    const committed = readRateBaseline();
    expect(committed.failing["STYLE100_SIDERUN/Morris_SideRunRight gen-0 2"]).toBeDefined();
    expect(committed.failing["QUATERNIUS_3D2DGE/Jog_Fwd_Loop gen-0 1"]).toBeUndefined();
  });
  it("reads only a baseline of the shape its schema gives, and writes one failing row a line", () => {
    const schema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "rates.schema.json"), "utf8")) as object);
    const file = JSON.parse(readFileSync(RATE_BASELINE, "utf8")) as unknown;
    expect([schema(file) ? [] : schema.errors, rateBaselineProblems(file)]).toEqual([[], []]);
    expect(readRateBaseline()).toMatchObject({ rates: RATES, rigs: RATE_RIGS });
    // a field it doesn't have, a rate that isn't one, no causes or answers (D127), a key that isn't a row's, a row
    // without its reasons
    const bad = { rates: [0], rigs: ["gen-0"], loops: 1, failing: { "S/A gen-0": ["r"], "S/B gen-0 1": [] }, extra: 1 };
    expect(rateBaselineProblems(bad)).toEqual(['"extra" is not a field of the baseline (about, rates, rigs, loops, causes, answers, failing)', "rates lists the rates swept, each above 0", "causes maps a cause's name (lower-case words joined by hyphens) to what it means, a text", "answers maps a loop `<set>/<clip>` to its cause, one of causes, and why it fails, a text", "failing maps `<clip> <body> <rate>` to its reasons, each a text"]);
    expect(schema(bad)).toBe(false);
    // its about, when given, a text, as the schema has it
    const about = { ...(file as object), about: 5 };
    expect([rateBaselineProblems(about), schema(about)]).toEqual([["about says what the baseline holds, as a text"], false]);
    const made = rateBaselineOf([row("S/A", 1, "fail"), row("S/B", 2, "pass"), row("S/C", 0.5, "fail")], 3), text = rateBaselineText(made);
    expect([JSON.parse(text), text.split("\n").filter((l) => l.startsWith('  "S/')).length, schema(JSON.parse(text))]).toEqual([made, 2, true]);
    expect(Object.keys(made.failing)).toEqual(["S/A gen-0 1", "S/C gen-0 0.5"]);
  });
  it("refuses the clip sweep's flags with --rates, and --baseline but on a whole run", () => {
    const p = (...argv: string[]) => ({ flags: Object.fromEntries(argv.map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k!, v ?? true])), positionals: [] as string[] });
    expect([ratesUsage(p("--rates")), ratesUsage(p("--rates", "--check", "--jobs=2"))]).toEqual([null, null]);
    expect(ratesUsage(p("--rates", "--min-total=95"))).toBe("--rates sweeps rates, not clips on skeletons: drop --min-total");
    expect(ratesUsage(p("--rates", "--baseline", "--sample=4"))).toMatch(/^--baseline records a whole run: every loop on the six bodies/);
    expect(ratesUsage(p("--rates", "--jobs=0"))).toMatch(/^--jobs takes a whole number of worker threads/);
  });
  it("npm run sweep -- --rates checks a sample of the loops on a body against the baseline", () => {
    // to a scratch file: check-output/sweep/rates.json may hold a person's whole run
    const file = join(mkdtempSync(join(tmpdir(), "m3a-rates-")), "rates.json");
    const out = execFileSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), "--rates", "gen-0", "--sample", "6", "--check", "--jobs", "1", "--out", file], { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/^sweep --rates: PASS, 30 rows \(6 loops × 5 rates × 1 body\) in \d+\.\d s: \d+ pass, \d+ warn, \d+ fail, 0 of them not baselined$/m);
    const res = JSON.parse(readFileSync(file, "utf8")) as RateResults, base = readRateBaseline();
    expect([res.rigs, res.rates, res.loops, res.rows.length]).toEqual([["gen-0"], RATES, 6, 30]);
    for (const r of res.rows.filter((x) => x.verdict === "fail")) expect(base.failing[rowKey(r)], rowKey(r)).toEqual(r.why);
    // a clip that isn't a locomotion loop with contacts is named
    const bad = spawnSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), "--rates", "gen-0", "--clip", "QUATERNIUS_3D2DGE/Idle_Loop"], { cwd: ROOT, encoding: "utf8" });
    expect([bad.status, bad.stdout]).toEqual([2, expect.stringContaining('no locomotion loop with contacts "QUATERNIUS_3D2DGE/Idle_Loop"')]);
  }, 60_000);
  // T2's full step (M3A_FULL=1, D74): every locomotion loop at every rate on the six bodies, in worker threads
  it.runIf(FULL)("every locomotion loop at every rate on the six bodies: no failing row the baseline doesn't hold", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "m3a-rates-")), "rates.json");
    const r = spawnSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), "--rates", "--check", "--out", file], { cwd: ROOT, encoding: "utf8" });
    const res = JSON.parse(readFileSync(file, "utf8")) as RateResults, base = readRateBaseline(), { failures, better } = againstRateBaseline(base, res.rows);
    const loops = (library ??= libraryClips()).filter((c) => isRateLoop(c.clip)).length;
    expect([res.loops, res.rows.length]).toEqual([loops, loops * RATES.length * RATE_RIGS.length]);
    expect(failures.map((x) => `${rowKey(x)}: ${x.why.join("; ")}`), r.stdout).toEqual([]);
    expect(r.status, r.stdout).toBe(0);
    // the worker threads' rows are the rows one thread plays: the first two loops on gen-0
    const b = await gen0(), first = res.rows.filter((x) => x.rig === "gen-0").slice(0, 2 * RATES.length);
    expect(first).toEqual([...new Set(first.map((x) => x.clip))].flatMap((id) => rateRows(load(id), b, "gen-0")));
    // a baselined row that passes now is reported (the baseline may only shrink: npm run sweep -- --rates --baseline)
    if (better.length) console.log(`rate sweep: ${better.length} baselined rows pass or warn now: ${better.map(rowKey).join(", ")}`);
  }, 900_000);
});
