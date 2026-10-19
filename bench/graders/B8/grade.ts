// B8's grader (PLAN.md §7, WP-9.1b): the workspace's intake queue (the local store in .cache/intake/ that
// `m3a library submit` fills) checked by the intake's checker (tools/intake/check.ts) on the repository's library,
// every shipped tier, with the reference rigs. It passes when one of the agent's submissions waits for review with
// every gate green (one checked before the grader ran, by the trial's checker or written by hand, is checked again
// from its text in a scratch queue: the queue's record isn't taken on trust), its record its own text's (its id and
// content hash derived from it, as the store derives them), its provenance complete (method, tool and version, a CC0
// claim, an AI agent named with its Claude model, and the local report submit adds, as submit measures it), a name and
// a description of its own (not the clip's it was made from), tagged emote, in place (no walking or running, as
// `describe` reads it), and playing on the workspace's character, every joint finite. The agent's best submission is
// the one graded; `gradeQueue` grades each, which B8-ten's grader (ten.ts) counts. Here too is what the brief's
// workspace runs: the checker every 30 s while the agent works (`checkEvery`, a tick with nothing new skipped, a failed
// one logged beside the workspace), and a solution's m3a calls as an agent types them (`runCalls`), with the
// workspace's installed m3a or, inside the repository, the repository's.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { format, recipe, type Clip, type Rest } from "@m3a/core";
import { checks as sensorChecks, describe, metrics } from "@m3a/sensors";
import { intake } from "@m3a/tools";
import { INTAKE_DIR, intakeFiles } from "@m3a/tools/node";
import { check, openChecker, type Checked, type Checker, type CheckReport } from "../../../tools/intake/check.ts";
import type { Check, Grade } from "../B1/grade.ts";
import { playsOn } from "../recipes.ts";

const ROOT = join(import.meta.dirname, "../../..");

/** The gates the checker runs, as its reports name them: the grader holds a submission to each. */
export const B8_GATES = ["schema", "provenance", "license", "text", "dedup", "sensors", "retarget", "budgets", "lint"] as const;
/** How often the workspace's checker runs while its agent works (ms); the hosted queue's runs every 15 minutes. */
export const CHECK_EVERY = 30_000;
/** How far an emote may travel (hip heights over the clip, or a loop's cycle, as `describe` reads it): it stays where
 *  it stands. The library's emotes travel 0.02 at most, its jumping jacks 0.18 a cycle (which describe reads as
 *  running); a walk travels about 1. */
export const IN_PLACE = 0.25;
/** The day the grader's scratch queues date their submissions. */
const DAY = "2026-10-19";
/** The environment the hosted store is reached with, and the local store's contributor name, left out of every m3a
 *  call here: the benchmark's queue is the local one, its contributor `local`. */
const HOSTED = ["M3A_SUPABASE_URL", "M3A_SUPABASE_ANON_KEY", "M3A_SUPABASE_SERVICE_ROLE_KEY", "M3A_CONTRIBUTOR_KEY", "M3A_CONTRIBUTOR_TOKEN", "M3A_CONTRIBUTOR"];

let opened: Promise<Checker> | undefined;
/** The checker on the repository's library with the reference rigs bound, opened once a process. */
export const checker = (): Promise<Checker> => (opened ??= openChecker(join(ROOT, "library/sets")));

/** A workspace's queue as the checker (or as contributor `id`) acts on it, dated `today`. */
export function queue(workspace: string, id?: string, today = DAY): intake.IntakeStore {
  return intake.localStore({ files: intakeFiles(join(workspace, INTAKE_DIR)), role: id === undefined ? "checker" : "contributor", ...(id === undefined ? {} : { id }), today: () => today });
}

/** A verdict for a text the queue doesn't take (its submit refused it). */
const refused = (id: string, err: unknown): Checked => ({ id, state: "bounced", reason: `it isn't a submission the queue takes: ${(err as Error).message}`, report: { checker: "", gates: [], motion: null, sensors: null, rigs: [], joins: null, sheet: null } });

const again = new Map<string, Promise<Checked>>();
/** What the checker makes of a submission from its text alone, in a scratch queue, whatever its record says (once a
 *  process for each contributor, kind, improves and text: the checker is deterministic). */
function recheck(s: intake.Submission, c: Checker): Promise<Checked> {
  const key = [s.contributor, s.kind, s.improves, intake.contentHash(String(s.text))].join("\n");
  if (!again.has(key)) {
    again.set(key, (async () => {
      const dir = mkdtempSync(join(tmpdir(), "m3a-b8-"));
      try {
        await intake.localStore({ files: intakeFiles(dir), role: "contributor", id: String(s.contributor || "?"), today: () => DAY }).submit({ kind: s.kind, text: s.text, improves: s.improves });
        const [r] = await check(intake.localStore({ files: intakeFiles(dir), role: "checker", today: () => DAY }), c, { sheets: null });
        return { ...r!, id: s.id };
      } catch (err) {
        return refused(s.id, err);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    })());
  }
  return again.get(key)!;
}

/** How a grader reads the submissions waiting for review once the checker has run on the queue: from them, this run's
 *  verdicts and the checker, each submission's verdict by id (one it leaves out was bounced before and is read as it
 *  is). */
export type Again = (waiting: readonly intake.Submission[], ran: readonly Checked[], c: Checker) => Promise<Map<string, Checked>>;
/** B8's: this run's verdicts, and each submission that waited for review before it checked again from its text alone. */
export const alone: Again = async (waiting, ran, c) => {
  const out = new Map(ran.map((r) => [r.id, r]));
  for (const s of waiting) if (!out.has(s.id)) out.set(s.id, await recheck(s, c));
  return out;
};

/** Each submission checked again from its text in one scratch queue, one at a time in the checker's order (by id),
 *  each once those before it wait for review there: so the dedup gate reads a contributor's submissions against each
 *  other, as it does across the checker's runs (one run reads its batch against the library and the submissions the
 *  owner decides or will decide, not against each other). A text the queue doesn't take is bounced, saying why. */
export async function inTurn(subs: readonly intake.Submission[], c: Checker): Promise<Map<string, Checked>> {
  const dir = mkdtempSync(join(tmpdir(), "m3a-b8-turn-")), files = intakeFiles(dir), out = new Map<string, Checked>();
  try {
    for (const s of [...subs].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      try {
        await intake.localStore({ files, role: "contributor", id: String(s.contributor || "?"), today: () => DAY }).submit({ kind: s.kind, text: s.text, improves: s.improves });
        const [r] = await check(intake.localStore({ files, role: "checker", today: () => DAY }), c, { sheets: null });
        out.set(s.id, r ? { ...r, id: s.id } : refused(s.id, new Error("the scratch queue held it already")));
      } catch (err) {
        out.set(s.id, refused(s.id, err));
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

/** A submission's clip (a recipe's compiled on the checker's library) and the rest it was made on; null when it has
 *  none. */
function clipOf(s: intake.Submission, c: Checker): { clip: Clip; rest: Rest | null } | null {
  try {
    const data = JSON.parse(s.text) as unknown;
    if (s.kind === "recipe") return recipe.compile(data as recipe.Recipe, c.lib.library.resolver());
    const clip = data as Clip, lib = c.lib.library;
    return { clip, rest: lib.sets().map((x) => lib.about(x.set).sources[clip.restSrc]?.rest).find(Boolean) ?? null };
  } catch {
    return null;
  }
}

/** Whether `by` says an AI agent made the clip and names its Claude model, as the brief asks (O10: every trial runs a
 *  Claude model): "Claude" with a model's name or id (Opus, Sonnet, Haiku, Fable; claude-opus-5-5), and AI or agent. */
export const byAgent = (by: string): boolean => /\bclaude\b/i.test(by) && /\b(opus|sonnet|haiku|fable)\b/i.test(by) && /\b(ai|agent)\b/i.test(by);

/** What a submitted clip's provenance lacks of what B8 asks: its method, the tool and version that made it, a CC0
 *  claim, who made it (an AI agent with its Claude model), and the local report `m3a library submit` adds (so a recipe
 *  sent as it is, which carries none of the intake's provenance, lacks the last two). `rest` given, the report must be
 *  the one submit measures of the clip: the sensors' verdict and findings on that rest, at their QA version. */
export function provenanceGaps(clip: Clip, rest?: Rest | null): string[] {
  const p = clip.provenance ?? ({} as Clip["provenance"]), i = (p as { intake?: { by?: unknown; report?: unknown } }).intake ?? {}, out: string[] = [];
  if (!(format.METHODS as readonly string[]).includes(p.method)) out.push("its method (provenance.method)");
  if (!p.producer?.tool?.trim() || !p.producer?.version?.trim()) out.push("the tool that made it and its version (provenance.producer)");
  if (p.license !== "CC0-1.0") out.push(`a CC0 claim (provenance.license is ${JSON.stringify(p.license)}, not "CC0-1.0")`);
  if (typeof i.by !== "string" || !i.by.trim()) out.push("who made it (provenance.intake.by, which m3a library submit's --by gives a clip)");
  else if (!byAgent(i.by)) out.push(`who made it as the brief asks (provenance.intake.by ${JSON.stringify(i.by.slice(0, 60))} doesn't say an AI agent made it, naming its Claude model)`);
  if (!i.report) out.push("the local report m3a library submit adds to a clip it sends (provenance.intake.report)");
  else if (rest) {
    const r = metrics(clip, rest), got = i.report as { sensors?: unknown; findings?: unknown; qaVersion?: unknown };
    if (got.sensors !== r.verdict || got.findings !== r.findings.length || got.qaVersion !== sensorChecks.QA_VERSION) out.push(`the local report m3a library submit adds (provenance.intake.report says ${JSON.stringify(got).slice(0, 80)}, but submit measures ${JSON.stringify({ sensors: r.verdict, findings: r.findings.length, qaVersion: sensorChecks.QA_VERSION })}: send the clip with m3a library submit)`);
  }
  return out;
}

/** The library clips a submission's clip is made from (its recipe's inputs, its orig, the clip it improves) whose name
 *  or description it carries as its own: each a line saying which. Ids of sets the library hasn't are the
 *  contributor's own. */
export function sourceWords(clip: Clip, improves: string | null, c: Checker): string[] {
  const lib = c.lib.library, sets = new Set(lib.sets().map((x) => x.set)), out: string[] = [], same = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
  const inputs = Object.keys((clip.provenance as { recipe?: { inputs?: object } } | undefined)?.recipe?.inputs ?? {});
  for (const id of new Set([improves, clip.provenance?.orig, ...inputs])) {
    if (typeof id !== "string" || !sets.has(id.split("/")[0]!)) continue;
    const src = lib.clip(id).clip;
    if (same(clip.name, src.name)) out.push(`its name is ${src.id}'s`);
    if (same(clip.desc, src.desc)) out.push(`its description is ${src.id}'s`);
  }
  return out;
}

/** Whether a clip stays where it stands: what `describe` reads of it (a walking or running phase, its travel). */
export function inPlace(clip: Clip, rest: Rest): Check {
  const d = describe(clip, rest), gait = d.phases.filter((p) => p.name === "walk" || p.name === "run"), far = Math.hypot(d.travel[0], d.travel[1]);
  const why = [...(gait.length ? [`it ${gait[0]!.name}s from ${gait[0]!.t0.toFixed(2)} s`] : []), ...(far >= IN_PLACE ? [`it travels ${far.toFixed(2)} hip heights${clip.loop ? " a cycle" : ""}, past ${IN_PLACE}`] : [])];
  return { name: "it stays in place", ok: why.length === 0, detail: why.length ? `${why.join("; ")} (describe: ${d.text.slice(0, 120)}): an emote stays where it stands` : `describe: ${d.text.slice(0, 120)}` };
}

/** The checks of one submission: its state in the queue and as the checker found it (`v`, null for one that was
 *  bounced before the grader ran), its record against its text, each gate, its provenance, its own words, its tag, its
 *  staying in place, and its play on the workspace's character. */
export async function graded(workspace: string, s: intake.Submission, v: Checked | null, c: Checker): Promise<Check[]> {
  const out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const said = v && v.state !== s.state ? `${s.state} in the queue, but ${v.state} when checked again from its text${v.reason ? `: ${v.reason}` : ""}` : `${s.state}${s.reason ? `: ${s.reason}` : ""}`;
  add("it waits for review", s.state === "awaiting review" && v?.state === "awaiting review", `${s.id} (${s.kind}): ${said}`);
  // the store derives a record's content hash from its text and its id from its contributor and content hash
  const content = intake.contentHash(String(s.text)), own = s.content === content && s.id === intake.submissionId(String(s.contributor), content);
  add("its queue record is its own text's", own, own ? "its id and content hash are its text's" : `${s.content !== content ? "its content hash isn't its text's" : "its id isn't its contributor's and content hash's"}: a record edited by hand, not one m3a library submit sent`);
  const gates = v?.report.gates ?? (s.report as Partial<CheckReport> | null)?.gates ?? [];
  for (const name of B8_GATES) {
    const g = gates.find((x) => x.gate === name);
    add(`the ${name} gate is green`, g?.ok === true, !g ? "not run: the checker runs it only once the gates before it pass" : g.ok ? "green" : g.why.slice(0, 2).join("; "));
  }
  const made = clipOf(s, c);
  if (!made) {
    add("its provenance is complete", false, "no clip to read it from");
    return out;
  }
  const gaps = provenanceGaps(made.clip, made.rest), tags = Array.isArray(made.clip.tags) ? made.clip.tags : [];
  add("its provenance is complete", gaps.length === 0, gaps.length ? `it lacks ${gaps.join("; ")}` : `${made.clip.provenance.method} by ${made.clip.provenance.producer.tool} ${made.clip.provenance.producer.version}, CC0-1.0, made by ${String((made.clip.provenance as { intake?: { by?: string } }).intake?.by).slice(0, 60)}`);
  let words: string[];
  try {
    words = [...(typeof made.clip.name === "string" && made.clip.name.trim() ? [] : ["it has no name"]), ...(typeof made.clip.desc === "string" && made.clip.desc.trim() ? [] : ["it has no description"]), ...sourceWords(made.clip, s.improves, c)];
  } catch (err) {
    words = [`its sources can't be read: ${(err as Error).message}`];
  }
  add("its name and description are its own", words.length === 0, words.length ? `${words.join("; ")}: give it a name and a description that say what it does` : `${made.clip.name}: ${String(made.clip.desc).slice(0, 80)}`);
  add("it is tagged emote", tags.includes("emote"), `tags: ${tags.join(", ") || "none"}`);
  out.push(made.rest ? inPlace(made.clip, made.rest) : { name: "it stays in place", ok: false, detail: "no rest to read it on" });
  add("it is new, not a fix of a library clip", s.improves === null, s.improves ? `sent with --improves ${s.improves}: an emote of its own takes none` : "sent without --improves");
  out.push(made.rest ? await playsOn(workspace, made.clip, made.rest) : { name: "it plays on the character", ok: false, detail: `restSrc ${JSON.stringify(made.clip.restSrc)} is no library source's rest` });
  return out;
}

/** One submission graded: it, and B8's checks of it. */
export interface Graded {
  s: intake.Submission;
  checks: Check[];
}
/** A workspace's queue graded submission by submission: how many it holds, the check that stopped the grading (the
 *  queue unreadable, or the checker failing on it), and each submission's checks. */
export interface QueueGrade {
  count: number;
  stopped: Check | null;
  each: Graded[];
}

/** Grades each submission in the workspace's queue (its .cache/intake/): the checker run on the queue first when it
 *  holds anything new, then each one waiting for review read again as `again` reads it (B8's: each alone), then
 *  `graded`. */
export async function gradeQueue(workspace: string, readAgain: Again = alone): Promise<QueueGrade> {
  let mine: intake.Submission[];
  try {
    mine = await queue(workspace).list();
  } catch (err) {
    return { count: 0, stopped: { name: "the queue can be read", ok: false, detail: `the queue (.cache/intake/) can't be read: ${(err as Error).message}` }, each: [] };
  }
  if (!mine.length) return { count: 0, stopped: null, each: [] };
  let c: Checker, ran: Checked[] = [];
  try {
    c = await checker();
    // (a run with nothing new would only reread the library)
    if (mine.some((s) => s.state === "submitted" || s.state === "checking")) {
      ran = await check(queue(workspace), c, { sheets: null });
      mine = await queue(workspace).list();
    }
  } catch (err) {
    return { count: mine.length, stopped: { name: "the checker ran on the queue", ok: false, detail: (err as Error).message }, each: [] };
  }
  const verdicts = await readAgain(mine.filter((s) => s.state === "awaiting review"), ran, c), each: Graded[] = [];
  for (const s of mine) each.push({ s, checks: await graded(workspace, s, verdicts.get(s.id) ?? null, c) });
  return { count: mine.length, stopped: null, each };
}

/** Grades the workspace's queue (its .cache/intake/): the checker run on it, then the agent's best submission. */
export async function gradeB8(workspace: string): Promise<Grade> {
  const t0 = performance.now(), q = await gradeQueue(workspace), out: Check[] = [];
  const unread = q.stopped?.name === "the queue can be read";
  out.push({ name: "a submission reached the queue", ok: q.count > 0 && !unread, detail: unread ? q.stopped!.detail : q.count ? `${q.count} in .cache/intake/` : "the queue (.cache/intake/) holds none: send the emote with m3a library submit" });
  if (q.stopped && !unread) out.push(q.stopped);
  const ok = (g: Graded) => g.checks.filter((x) => x.ok).length;
  const best = q.each.reduce<Graded | null>((b, g) => (!b || ok(g) > ok(b) ? g : b), null);
  if (best) out.push(...best.checks);
  return { pass: out.every((x) => x.ok), checks: out, ms: performance.now() - t0 };
}

/** Runs the checker on the workspace's queue every `every` ms until the returned stop (which waits for a check under
 *  way; its `failed` lists the ticks whose check failed): the queue a brief's agent reads with `m3a library status`. A
 *  tick finding nothing new in the queue runs nothing (a run blocks the event loop while its gates and the retarget
 *  onto the reference rigs run, and the process's first also while the census samples the library's poses, which the
 *  checker keeps for the rest, D119); a check that fails is tried at the next tick, and its error written to `log`
 *  (beside the workspace, by its transcript: the agent's `status` would show its submissions waiting) and, the first
 *  time, to stderr. `open` opens the checker (the repository's, once a process). */
export function checkEvery(workspace: string, every = CHECK_EVERY, log = `${workspace}.checker.log`, open: () => Promise<Checker> = checker): (() => Promise<void>) & { failed: readonly string[] } {
  let last: Promise<unknown> = Promise.resolve(), busy = false, tick = 0;
  const failed: string[] = [];
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    const n = ++tick;
    last = (async () => {
      if (!(await queue(workspace).list()).some((s) => s.state === "submitted" || s.state === "checking")) return;
      await check(queue(workspace), await open(), { sheets: null });
    })()
      .catch((err: unknown) => {
        const line = `tick ${n}: the checker failed on ${INTAKE_DIR}: ${err instanceof Error ? err.message : String(err)}`;
        failed.push(line);
        try {
          (failed.length === 1 ? writeFileSync : appendFileSync)(log, `${line}\n`);
        } catch {
          // the log is a record; a check goes on without it
        }
        if (failed.length === 1) process.stderr.write(`bench: ${basename(workspace)}: ${line} (more in ${log})\n`);
      })
      .finally(() => (busy = false));
  }, every);
  return Object.assign(
    async () => {
      clearInterval(timer);
      await last;
    },
    { failed },
  );
}

/** The m3a command a workspace runs: its installed package's (a trial's, packed) or, inside the repository (a grader
 *  test), the repository's own. */
export function m3aBin(workspace: string): string {
  const own = join(workspace, "node_modules/@m3a/tools/dist/node.js");
  return existsSync(own) ? own : join(ROOT, "packages/tools/src/node.ts");
}

/** Runs the m3a calls of a solution's shell file in `workspace` one by one (`npx m3a ...` lines, as an agent types
 *  them; `#` lines are comments), on the local queue: each line, its exit code and its output. */
export function runCalls(workspace: string, file: string): { line: string; code: number | null; out: string }[] {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !HOSTED.includes(k)));
  return readFileSync(join(workspace, file), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((line) => {
    const argv = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
    if (argv[0] === "npx") argv.shift();
    if (argv.shift() !== "m3a") throw new Error(`bench: ${file}: "${line}" isn't an m3a call`);
    const r = spawnSync(process.execPath, ["--no-warnings", m3aBin(workspace), ...argv], { cwd: workspace, encoding: "utf8", env, timeout: 120_000 });
    return { line, code: r.status, out: `${r.stdout}${r.stderr}` };
  });
}

/** Runs a solution's m3a calls (`file`) in `workspace`, each exiting 0, or a refusal naming the one that didn't. */
export function solveWith(workspace: string, file: string, brief: string): void {
  for (const r of runCalls(workspace, file)) if (r.code !== 0) throw new Error(`bench: ${brief}'s known-good call "${r.line}" exited ${r.code}: ${r.out.trim().split("\n")[0]}`);
}

/** B8's known-good beyond its files: its m3a calls (submit.sh), each exiting 0, or a refusal naming the one that
 *  didn't. */
export function solveB8(workspace: string): void {
  solveWith(workspace, "submit.sh", "B8");
}
