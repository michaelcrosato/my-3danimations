// `npm run bench -- <B1 to B8 | quiz>[,...] [--trials N] [--discovery N] [--parallel N] [--variant <dir>] [--model <m>]
// [--need N] [--fake]`
// (PLAN.md §7, WP-4.7): each brief given to fresh agents in workspaces outside the repository, graded headless.
// - B1: the packages packed (bench/runner/pack.ts); per trial a workspace in /tmp/m3a-bench/<run>/ with the tarballs
//   installed, the brief, the starter and its character; a fresh agent (isolation level 1, bench/runner/agent.ts)
//   works there, and B1's grader grades it. --discovery N adds trials in an ordinary game project whose brief never
//   names the packages, recording whether the agent found and used them (they don't count toward the pass mark).
//   --variant <dir> takes a held-out variant's brief.md and character.json ({"seed": n} or {"manifest", "rig"}) and
//   runs the brief's known-good solution on it first, stopping with a package or grader failure if that fails;
//   --heldout G4 takes the gate's latest held-out run's (bench/results/heldout/G4/run-<n>/B1/).
//   --parallel N runs N agents at once, each in its own workspace and home with a /tmp of its own (agents write scratch
//   files to /tmp by name); where the machine can't give them one, they run one at a time (D84, superseding D54's).
//   Each runs as an unprivileged user with no capabilities where the machine allows it (bench/runner/agent.ts), with
//   m3a's skill and MCP server (WP-7.3): a trial whose init event shows either missing fails, saying so.
// - quiz: the legend quiz (bench/runner/quiz.ts), at least 9 of 10.
// - B8: while its agent works, the intake's checker runs on the workspace's local queue every 30 s (the brief's
//   `during`), so the agent reads its bounces with `m3a library status`; its grader runs the checker there.
// --fake plays the known-good solution (or the quiz's answers) instead of an agent, to check the pipeline for free: its
// files, and the calls it makes past them (B8's m3a calls: the brief's `solve`).
// Results go to bench/results/<date>-<model>-<brief>.json (-2, -3... for later runs that day), with the commit, whether
// the tree differed from it, the models the agents ran, how they were isolated (privateTmp, ownPids, capsDropped, uid,
// unprivileged) and a variant's directory; the pass mark is 4 of 5 (PLAN.md §7), or --need N trials (a gate's clause).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gradeB1, type Grade } from "../graders/B1/grade.ts";
import { gradeB2 } from "../graders/B2/grade.ts";
import { gradeB3 } from "../graders/B3/grade.ts";
import { gradeB4 } from "../graders/B4/grade.ts";
import { gradeB5 } from "../graders/B5/grade.ts";
import { gradeB6 } from "../graders/B6/grade.ts";
import { gradeB7 } from "../graders/B7/grade.ts";
import { checkEvery, gradeB8, solveB8 } from "../graders/B8/grade.ts";
import { closest, finish, fmtMs, parseArgs, usage, type Report, type Step } from "../../tools/run/cli.ts";
import { agentUser, capsDropped, namespace, ownPids, runAgent, type AgentRun } from "./agent.ts";
import { pack } from "./pack.ts";
import { answersIn, QUIZ, quizPrompt, score } from "./quiz.ts";
import { variant } from "@m3a/three/test-characters";
import { DEFAULT_CHARACTER, prepareWorkspace, type CharacterSpec } from "./workspace.ts";

const ROOT = join(import.meta.dirname, "../.."), BENCH = join(ROOT, "bench");
/** A brief the runner gives agents: its starter, its brief, its grader, and its known-good solution's files. */
export interface BriefSpec {
  starter: string;
  grade(workspace: string): Promise<Grade>;
  /** The known-good solution: its files by path in a workspace, read from bench/graders/<brief>/known-good. */
  good: string[];
  /** Its starter character, when not the default one (B4's avatar: a VRM-named chibi). */
  character?: CharacterSpec;
  /** The bone naming a variant's generated character must have (B4's: a VRM avatar's, which seeds 0 mod 4 give). */
  naming?: string;
  /** What its known-good solution does past its files, in a workspace (B8's: its m3a calls, sending its clip). */
  solve?(workspace: string): void;
  /** What a workspace runs while its agent works, until the stop it returns (B8's: the checker on its queue). */
  during?(workspace: string): () => Promise<void>;
}
/** The briefs, by name. */
export const SPECS: Record<string, BriefSpec> = {
  B1: { starter: "B1", grade: gradeB1, good: ["src/player.ts", "src/sheet.ts"] },
  B2: { starter: "B2", grade: gradeB2, good: ["src/fighter.ts"] },
  B3: { starter: "B3", grade: gradeB3, good: ["src/reactor.ts"] },
  B4: { starter: "B4", grade: gradeB4, good: ["src/sneak.ts"], character: { seed: 40 }, naming: "vrm" },
  B5: { starter: "B5", grade: gradeB5, good: ["emote.json"] },
  B6: { starter: "B6", grade: gradeB6, good: ["punch.json"] },
  B7: { starter: "B7", grade: gradeB7, good: ["graph.json"] },
  B8: { starter: "B8", grade: gradeB8, good: ["emote.json", "submit.sh"], solve: solveB8, during: checkEvery },
};
const BRIEFS = [...Object.keys(SPECS), "quiz"];
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

/** Plays a brief's known-good solution past its files in a workspace (`solve`): what went wrong, or null. */
function solved(spec: BriefSpec, ws: string): string | null {
  try {
    spec.solve?.(ws);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

/** A brief's known-good solution's files, by path in a workspace (B1's by default). */
export function knownGood(brief = "B1"): Record<string, string> {
  return Object.fromEntries(SPECS[brief]!.good.map((f) => [f, readFileSync(join(BENCH, "graders", brief, "known-good", f), "utf8")]));
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

/** Runs B1's trials (and discovery trials) and returns their records (`runBrief` for B1). */
export function runB1(opts: Omit<Parameters<typeof runBrief>[1], "discovery"> & { discovery: number }): ReturnType<typeof runBrief> {
  return runBrief("B1", opts);
}
/** The trials of `trials` that must pass: 4 of 5 (80%, rounded up, PLAN.md §7), or `need` when a gate's clause asks
 *  for more (G9: ten clips, every one through); an error names a count out of range. */
export function passMark(trials: number, need?: unknown): number {
  const n = need === undefined ? Math.ceil(0.8 * trials) : Number(need);
  if (!(Number.isInteger(n) && n >= 1 && n <= trials)) throw new Error(`--need is a count of trials, 1 to ${trials}`);
  return n;
}

/** How many agents may run at once: `asked`, where each gets a /tmp of its own (or none run: fakes); else one (D84). */
export function lanes(asked: number, fake = false): number {
  return fake || namespace() ? Math.max(1, asked) : 1;
}

/**
 * Runs a brief's trials (and, for B1, discovery trials) and returns their records: the workspaces built one by one,
 * the agents `parallel` at a time (`lanes`), each graded once its agent is done. A variant runs the known-good solution
 * on it first, and stops there if that fails (a package or grader failure).
 */
export async function runBrief(name: string, opts: { trials: number; discovery?: number; parallel?: number; variant?: string; model?: string; fake?: boolean; base: string; packs: Record<string, string> }): Promise<{ check?: Trial; trials: Trial[]; discovery: Trial[] }> {
  const spec = SPECS[name]!, { brief, character } = opts.variant ? variantOf(opts.variant) : { brief: join(BENCH, `briefs/${name}.md`), character: spec.character ?? DEFAULT_CHARACTER };
  const out: { check?: Trial; trials: Trial[]; discovery: Trial[] } = { trials: [], discovery: [] };
  if (spec.naming && "seed" in character && variant(character.seed).naming !== spec.naming) throw new Error(`bench: ${name}'s character must have ${spec.naming} bone names, and seed ${character.seed} gives ${variant(character.seed).naming}'s (a generator seed's naming goes vrm, mixamo, ue5, rigify by its remainder over 4: ${spec.naming} for seeds that leave ${["vrm", "mixamo", "ue5", "rigify"].indexOf(spec.naming)})`);
  if (opts.variant) {
    // the brief's known-good solution on the variant first: if it fails, the package or the grader is at fault
    const ws = await prepareWorkspace(join(opts.base, `${name}-known-good`), { starter: join(BENCH, "starters", spec.starter), brief, character, packs: opts.packs, files: knownGood(name) });
    const unsolved = solved(spec, ws), g = await spec.grade(ws);
    out.check = { trial: "known-good", pass: g.pass && !unsolved, failed: [...(unsolved ? [unsolved] : []), ...failedOf(g)], agent: { fake: true } };
    if (!out.check.pass) return out;
  }
  const specs = [
    ...Array.from({ length: opts.trials }, (_, i) => ({ name: `${name}-${i + 1}`, starter: spec.starter, brief, discovery: false })),
    ...Array.from({ length: name === "B1" ? (opts.discovery ?? 0) : 0 }, (_, i) => ({ name: `B1-discovery-${i + 1}`, starter: "B1-discovery", brief: join(BENCH, "briefs/B1-discovery.md"), discovery: true })),
  ];
  const jobs: ((typeof specs)[number] & { ws: string })[] = [];
  for (const j of specs) jobs.push({ ...j, ws: await prepareWorkspace(join(opts.base, j.name), { starter: join(BENCH, "starters", j.starter), brief: j.brief, character, packs: opts.packs, ...(opts.fake && !j.discovery ? { files: knownGood(name) } : {}) }) });
  const done = await pool(jobs, lanes(opts.parallel ?? 1, opts.fake), async (j): Promise<Trial> => {
    // a fake plays the known-good's calls; an agent works while the workspace runs what the brief gives it
    const unsolved = opts.fake && !j.discovery ? solved(spec, j.ws) : null, stop = opts.fake ? null : (spec.during?.(j.ws) ?? null);
    let agent: Trial["agent"];
    try {
      agent = opts.fake ? ({ fake: true } as const) : summary(await runAgent(j.ws, PROMPT, join(opts.base, `${j.name}.jsonl`), { ...(opts.model ? { model: opts.model } : {}) }));
    } finally {
      await stop?.();
    }
    // a trial whose m3a wiring failed (its init event showed the MCP server not connected or no skill, and the agent
    // stopped there; or the stream had no init event) fails, whatever its workspace grades
    const g = await spec.grade(j.ws), unwired = "unwired" in agent ? agent.unwired : undefined, why = unwired ?? unsolved;
    return { trial: j.name, pass: g.pass && !why, failed: [...(why ? [why] : []), ...failedOf(g)], agent, ...(j.discovery ? { usedPackage: usesPackage(j.ws) } : {}) };
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
    const run = opts.fake ? null : await runAgent(ws, quizPrompt(), join(opts.base, `quiz-${i}.jsonl`), { tools: "", maxTurns: 1, m3a: false, ...(opts.model ? { model: opts.model } : {}) });
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
    { name: "need", takesValue: true, help: "trials that must pass (4 of 5 by default: 80%, rounded up)" },
    { name: "fake", help: "play the known-good solution instead of an agent (checks the pipeline)" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const names = (parsed.positionals[0] ?? "").split(",").filter(Boolean);
    if (!names.length) throw new Error(`name a brief: ${BRIEFS.join(", ")}`);
    for (const n of names) if (!BRIEFS.includes(n)) throw new Error(`no brief "${n}"; did you mean ${closest(n, BRIEFS)}?`);
    if ((typeof parsed.flags.heldout === "string" || typeof parsed.flags.variant === "string") && names.filter((n) => n !== "quiz").length !== 1) throw new Error(`--${typeof parsed.flags.heldout === "string" ? "heldout" : "variant"} takes one brief at a time: its variant is the brief's`);
    if (typeof parsed.flags.heldout === "string") parsed.flags.variant = latestVariant(parsed.flags.heldout, names.find((n) => n !== "quiz")!);
  } catch (err) {
    usage("bench", err, specs);
  }
  const f = parsed.flags, names = parsed.positionals[0]!.split(","), trials = Number(f.trials ?? 5), t0 = performance.now(), steps: Step[] = [];
  let need = 0;
  try {
    need = passMark(trials, f.need);
  } catch (err) {
    usage("bench", err, specs);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19), base = join("/tmp/m3a-bench", stamp), model = typeof f.model === "string" ? f.model : undefined, fake = f.fake === true;
  mkdirSync(base, { recursive: true });
  const results: Record<string, unknown> = { about: "npm run bench: fresh agents on the briefs (PLAN.md §7); isolation 1 is the claude CLI in a clean workspace", date: stamp, ...commitOf(), model: model ?? "the CLI's default", fake, parallel: lanes(Number(f.parallel ?? 1), fake), privateTmp: namespace() !== null, ownPids: ownPids(), capsDropped: capsDropped(), uid: agentUser().uid, unprivileged: agentUser().unprivileged };
  if (typeof f.variant === "string") results.variant = { dir: relative(ROOT, resolve(f.variant)), character: variantOf(resolve(f.variant)).character };
  const briefs = names.filter((n) => n !== "quiz"), packs = briefs.length ? pack(join(base, "packs")) : {}, models = new Set<string>();
  for (const name of briefs) {
    const s0 = performance.now();
    const r = await runBrief(name, { trials, discovery: Number(f.discovery ?? 0), parallel: Number(f.parallel ?? 1), base, packs, fake, ...(typeof f.variant === "string" ? { variant: resolve(f.variant) } : {}), ...(model ? { model } : {}) });
    results[name] = r;
    for (const t of [...r.trials, ...r.discovery]) if ("model" in t.agent && t.agent.model) models.add(t.agent.model);
    if (r.check && !r.check.pass) steps.push({ name: `${name} known-good on the variant`, ok: false, ms: performance.now() - s0, summary: "the brief's known-good solution fails: a package or grader failure, not the agents'", detail: r.check.failed });
    else {
      const passed = r.trials.filter((t) => t.pass).length;
      steps.push({ name, ok: passed >= need, ms: performance.now() - s0, summary: `${passed} of ${trials} trials pass${need !== passMark(trials) ? ` (${need} needed)` : ""}${r.discovery.length ? `; discovery: ${r.discovery.filter((t) => t.usedPackage).length} of ${r.discovery.length} used the package, ${r.discovery.filter((t) => t.pass).length} passed` : ""}`, detail: r.trials.filter((t) => !t.pass).map((t) => `${t.trial}: ${t.failed.join("; ")}`) });
    }
  }
  if (briefs.length) results.models = [...models];
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
