// `npm run bench -- <B1 | quiz>[,...] [--trials N] [--discovery N] [--parallel N] [--variant <dir>] [--model <m>] [--fake]`
// (PLAN.md §7, WP-4.7): each brief given to fresh agents in workspaces outside the repository, graded headless.
// - B1: the packages packed (bench/runner/pack.ts); per trial a workspace in /tmp/m3a-bench/<run>/ with the tarballs
//   installed, the brief, the starter and its character; a fresh agent (isolation level 1, bench/runner/agent.ts)
//   works there, and B1's grader grades it. --discovery N adds trials in an ordinary game project whose brief never
//   names the packages, recording whether the agent found and used them (they don't count toward the pass mark).
//   --variant <dir> takes a held-out variant's brief.md and character.json ({"seed": n} or {"manifest", "rig"}) and
//   runs the brief's known-good solution on it first, stopping with a package or grader failure if that fails;
//   --heldout G4 takes the gate's latest held-out run's (bench/results/heldout/G4/run-<n>/B1/).
//   --parallel N runs N agents at once (each in its own workspace, home and TMPDIR; agents still write scratch files
//   to /tmp by name, the same names, so a run that counts at a gate runs them one at a time).
// - quiz: the legend quiz (bench/runner/quiz.ts), at least 9 of 10.
// --fake plays the known-good solution (or the quiz's answers) instead of an agent, to check the pipeline for free.
// Results go to bench/results/<date>-<model>-<brief>.json (-2, -3... for later runs that day), with the commit, whether
// the tree differed from it, the models the agents ran and a variant's directory; the pass mark is 4 of 5 (PLAN.md §7).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gradeB1, type Grade } from "../graders/B1/grade.ts";
import { closest, finish, fmtMs, parseArgs, usage, type Report, type Step } from "../../tools/run/cli.ts";
import { runAgent, type AgentRun } from "./agent.ts";
import { pack } from "./pack.ts";
import { answersIn, QUIZ, quizPrompt, score } from "./quiz.ts";
import { DEFAULT_CHARACTER, prepareWorkspace, type CharacterSpec } from "./workspace.ts";

const ROOT = join(import.meta.dirname, "../.."), BENCH = join(ROOT, "bench"), BRIEFS = ["B1", "quiz"];
const GOOD = join(BENCH, "graders/B1/known-good/src");
/** What a trial is told: the brief does the rest. */
export const PROMPT = "Read BRIEF.md in this directory and do what it asks. Work only in this directory.";

/** One trial's record. */
export interface Trial {
  trial: string;
  pass: boolean;
  failed: string[];
  agent: Omit<AgentRun, "transcript" | "reply"> | { fake: true };
  /** Discovery trials: whether the solution imports an @m3a package. */
  usedPackage?: boolean;
}

/** The known-good solution's files, by path in a workspace. */
export function knownGood(): Record<string, string> {
  return { "src/player.ts": readFileSync(join(GOOD, "player.ts"), "utf8"), "src/sheet.ts": readFileSync(join(GOOD, "sheet.ts"), "utf8") };
}
/** A held-out variant's brief and character, read from its directory. */
export function variantOf(dir: string): { brief: string; character: CharacterSpec } {
  const brief = ["brief.md", "BRIEF.md"].map((f) => join(dir, f)).find(existsSync);
  if (!brief || !existsSync(join(dir, "character.json"))) throw new Error(`bench: a variant needs brief.md and character.json in ${dir}`);
  const c = JSON.parse(readFileSync(join(dir, "character.json"), "utf8")) as CharacterSpec;
  return { brief, character: "manifest" in c ? { ...c, manifest: resolve(dir, c.manifest) } : c };
}
/** The directory of brief `brief`'s variant in a gate's latest held-out run. */
export function latestVariant(gate: string, brief: string, base = join(BENCH, "results/heldout")): string {
  const dir = join(base, gate), runs = existsSync(dir) ? readdirSync(dir).filter((d) => /^run-\d+$/.test(d) && existsSync(join(dir, d, brief, "character.json"))) : [];
  const run = runs.sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))).pop();
  if (!run) throw new Error(`no held-out ${brief} variant for ${gate} yet (bench/results/heldout/${gate}/run-<n>/${brief}/; PLAN.md §7)`);
  return join(dir, run, brief);
}
/** The commit under test and whether the tree differs from it (`git`, so a worktree reads right too). */
export function commitOf(root = ROOT): { commit: string; dirty: boolean | null } {
  try {
    const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { commit: git("rev-parse", "HEAD").trim(), dirty: git("status", "--porcelain", "--untracked-files=no").trim() !== "" };
  } catch {
    return { commit: "unknown", dirty: null };
  }
}
/** A results file's path that no earlier run wrote: the name itself, or the name with -2, -3... */
function unused(file: string): string {
  let n = 1, out = file;
  while (existsSync(out)) out = file.replace(/\.json$/, `-${++n}.json`);
  return out;
}
/** Whether a solution imports an @m3a package. */
function usesPackage(ws: string): boolean {
  return readdirSync(join(ws, "src")).filter((f) => f.endsWith(".ts")).some((f) => /from\s+["']@m3a\//.test(readFileSync(join(ws, "src", f), "utf8")));
}
const failedOf = (g: Grade) => g.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
const summary = (r: AgentRun) => {
  const { transcript: _t, reply: _r, ...rest } = r;
  return rest;
};

/** Runs `work` on each item, at most `n` at once, keeping their order. */
export async function pool<T, R>(items: readonly T[], n: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, lane));
  return out;
}

/** Runs B1's trials (and discovery trials) and returns their records: the workspaces built one by one, the agents
 *  `parallel` at a time, each graded once its agent is done. */
export async function runB1(opts: { trials: number; discovery: number; parallel?: number; variant?: string; model?: string; fake?: boolean; base: string; packs: Record<string, string> }): Promise<{ check?: Trial; trials: Trial[]; discovery: Trial[] }> {
  const { brief, character } = opts.variant ? variantOf(opts.variant) : { brief: join(BENCH, "briefs/B1.md"), character: DEFAULT_CHARACTER };
  const out: { check?: Trial; trials: Trial[]; discovery: Trial[] } = { trials: [], discovery: [] };
  if (opts.variant) {
    // the brief's known-good solution on the variant first: if it fails, the package or the grader is at fault
    const ws = await prepareWorkspace(join(opts.base, "known-good"), { starter: join(BENCH, "starters/B1"), brief, character, packs: opts.packs, files: knownGood() });
    const g = await gradeB1(ws);
    out.check = { trial: "known-good", pass: g.pass, failed: failedOf(g), agent: { fake: true } };
    if (!g.pass) return out;
  }
  const specs = [
    ...Array.from({ length: opts.trials }, (_, i) => ({ name: `B1-${i + 1}`, starter: "B1", brief, discovery: false })),
    ...Array.from({ length: opts.discovery }, (_, i) => ({ name: `B1-discovery-${i + 1}`, starter: "B1-discovery", brief: join(BENCH, "briefs/B1-discovery.md"), discovery: true })),
  ];
  const jobs: ((typeof specs)[number] & { ws: string })[] = [];
  for (const j of specs) jobs.push({ ...j, ws: await prepareWorkspace(join(opts.base, j.name), { starter: join(BENCH, "starters", j.starter), brief: j.brief, character, packs: opts.packs, ...(opts.fake && !j.discovery ? { files: knownGood() } : {}) }) });
  const done = await pool(jobs, opts.parallel ?? 1, async (j): Promise<Trial> => {
    const agent = opts.fake ? ({ fake: true } as const) : summary(await runAgent(j.ws, PROMPT, join(opts.base, `${j.name}.jsonl`), { ...(opts.model ? { model: opts.model } : {}) }));
    const g = await gradeB1(j.ws);
    return { trial: j.name, pass: g.pass, failed: failedOf(g), agent, ...(j.discovery ? { usedPackage: usesPackage(j.ws) } : {}) };
  });
  for (const [k, j] of jobs.entries()) (j.discovery ? out.discovery : out.trials).push(done[k]!);
  return out;
}

/** Runs the legend quiz `trials` times. */
export async function runQuiz(opts: { trials: number; model?: string; fake?: boolean; base: string }): Promise<{ trial: string; right: number; of: number; wrong: string[]; agent: Trial["agent"] }[]> {
  const out = [];
  for (let i = 1; i <= opts.trials; i++) {
    const ws = join(opts.base, `quiz-${i}`);
    mkdirSync(ws, { recursive: true });
    const run = opts.fake ? null : await runAgent(ws, quizPrompt(), join(opts.base, `quiz-${i}.jsonl`), { tools: "", maxTurns: 1, ...(opts.model ? { model: opts.model } : {}) });
    const answers = run ? answersIn(run.reply) : Object.fromEntries(QUIZ.questions.map((q, k) => [String(k + 1), q.answer]));
    out.push({ trial: `quiz-${i}`, ...score(answers), agent: run ? summary(run) : ({ fake: true } as const) });
  }
  return out;
}

if (import.meta.main) {
  const specs = [
    { name: "trials", takesValue: true, help: "trials per brief (5)" },
    { name: "discovery", takesValue: true, help: "B1's discovery trials (0)" },
    { name: "parallel", takesValue: true, help: "agents at once (1)" },
    { name: "variant", takesValue: true, help: "a held-out variant's directory (brief.md, character.json)" },
    { name: "heldout", takesValue: true, help: "the variant of a gate's latest held-out run (G4)" },
    { name: "model", takesValue: true, help: "the model the agents run (the CLI's default)" },
    { name: "fake", help: "play the known-good solution instead of an agent (checks the pipeline)" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const names = (parsed.positionals[0] ?? "").split(",").filter(Boolean);
    if (!names.length) throw new Error(`name a brief: ${BRIEFS.join(", ")}`);
    for (const n of names) if (!BRIEFS.includes(n)) throw new Error(`no brief "${n}"; did you mean ${closest(n, BRIEFS)}? (B2 to B8 arrive with WP-6.6 and WP-9.1)`);
    if (typeof parsed.flags.heldout === "string") parsed.flags.variant = latestVariant(parsed.flags.heldout, "B1");
  } catch (err) {
    usage("bench", err, specs);
  }
  const f = parsed.flags, names = parsed.positionals[0]!.split(","), trials = Number(f.trials ?? 5), t0 = performance.now(), steps: Step[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19), base = join("/tmp/m3a-bench", stamp), model = typeof f.model === "string" ? f.model : undefined, fake = f.fake === true;
  mkdirSync(base, { recursive: true });
  const results: Record<string, unknown> = { about: "npm run bench: fresh agents on the briefs (PLAN.md §7); isolation 1 is the claude CLI in a clean workspace", date: stamp, ...commitOf(), model: model ?? "the CLI's default", fake };
  if (typeof f.variant === "string") results.variant = { dir: relative(ROOT, resolve(f.variant)), character: variantOf(resolve(f.variant)).character };
  if (names.includes("B1")) {
    const s0 = performance.now(), packs = pack(join(base, "packs"));
    const r = await runB1({ trials, discovery: Number(f.discovery ?? 0), parallel: Number(f.parallel ?? 1), base, packs, fake, ...(typeof f.variant === "string" ? { variant: resolve(f.variant) } : {}), ...(model ? { model } : {}) });
    results.B1 = r;
    results.models = [...new Set([...r.trials, ...r.discovery].map((t) => ("model" in t.agent ? t.agent.model : undefined)).filter(Boolean))];
    if (r.check && !r.check.pass) steps.push({ name: "B1 known-good on the variant", ok: false, ms: performance.now() - s0, summary: "the brief's known-good solution fails: a package or grader failure, not the agents'", detail: r.check.failed });
    else {
      const passed = r.trials.filter((t) => t.pass).length;
      steps.push({ name: "B1", ok: passed >= Math.ceil(0.8 * trials), ms: performance.now() - s0, summary: `${passed} of ${trials} trials pass${r.discovery.length ? `; discovery: ${r.discovery.filter((t) => t.usedPackage).length} of ${r.discovery.length} used the package, ${r.discovery.filter((t) => t.pass).length} passed` : ""}`, detail: r.trials.filter((t) => !t.pass).map((t) => `${t.trial}: ${t.failed.join("; ")}`) });
    }
  }
  if (names.includes("quiz")) {
    const s0 = performance.now(), q = await runQuiz({ trials: Number(f.trials ?? 1), base, fake, ...(model ? { model } : {}) });
    results.quiz = q;
    steps.push({ name: "quiz", ok: q.every((x) => x.right >= 9), ms: performance.now() - s0, summary: q.map((x) => `${x.right} of ${x.of}`).join(", "), detail: q.flatMap((x) => x.wrong.map((w) => `${x.trial} ${w}`)) });
  }
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok), file = unused(join(BENCH, "results", `${stamp.slice(0, 10)}-${(model ?? "default").replace(/[^\w.-]/g, "")}-${names.join("-")}${fake ? "-fake" : ""}${typeof f.variant === "string" ? "-variant" : ""}.json`));
  writeFileSync(file, `${JSON.stringify({ ...results, ms: Math.round(ms) }, null, 1)}\n`);
  cpSync(file, join(base, "results.json"));
  const report: Report = { tool: "bench", ok, verdict: `bench ${names.join(", ")}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps, warnings: [], ms, next: `results in ${file.slice(ROOT.length + 1)}; workspaces and transcripts in ${base}` };
  finish(report, parsed);
}
