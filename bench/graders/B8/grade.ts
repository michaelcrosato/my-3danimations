// B8's grader (PLAN.md §7, WP-9.1b): the workspace's intake queue (the local store in .cache/intake/ that
// `m3a library submit` fills) checked by the intake's checker (tools/intake/check.ts) on the repository's library,
// every shipped tier, with the reference rigs. It passes when one of the agent's submissions waits for review with
// every gate green (one checked before the grader ran, by the trial's checker or written by hand, is checked again
// from its text in a scratch queue: the queue's record isn't taken on trust), its provenance complete (method, tool and
// version, a CC0 claim, who made it, and the local report submit adds to a clip), tagged emote, and playing on the
// workspace's character, every joint finite. The agent's best submission is the one graded. Here too is what the
// brief's workspace runs: the checker every 30 s while the agent works (`checkEvery`), and a solution's m3a calls as an
// agent types them (`runCalls`), with the workspace's installed m3a or, inside the repository, the repository's.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format, recipe, type Clip, type Rest } from "@m3a/core";
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
/** The environment the hosted store is reached with, and the local store's contributor name, left out of every m3a
 *  call here: the benchmark's queue is the local one, its contributor `local`. */
const HOSTED = ["M3A_SUPABASE_URL", "M3A_SUPABASE_ANON_KEY", "M3A_SUPABASE_SERVICE_ROLE_KEY", "M3A_CONTRIBUTOR_KEY", "M3A_CONTRIBUTOR_TOKEN", "M3A_CONTRIBUTOR"];

let opened: Promise<Checker> | undefined;
/** The checker on the repository's library with the reference rigs bound, opened once a process. */
export const checker = (): Promise<Checker> => (opened ??= openChecker(join(ROOT, "library/sets")));

/** A workspace's queue as the checker (or as contributor `id`) acts on it, dated `today`. */
export function queue(workspace: string, id?: string, today = "2026-10-19"): intake.IntakeStore {
  return intake.localStore({ files: intakeFiles(join(workspace, INTAKE_DIR)), role: id === undefined ? "checker" : "contributor", ...(id === undefined ? {} : { id }), today: () => today });
}

const again = new Map<string, Promise<Checked>>();
/** What the checker makes of a submission from its text alone, in a scratch queue, whatever its record says (once a
 *  process for each contributor, kind, improves and text: the checker is deterministic). */
function recheck(s: intake.Submission, c: Checker): Promise<Checked> {
  const key = [s.contributor, s.kind, s.improves, intake.contentHash(String(s.text))].join("\n");
  if (!again.has(key)) {
    again.set(key, (async () => {
      const dir = mkdtempSync(join(tmpdir(), "m3a-b8-"));
      try {
        await intake.localStore({ files: intakeFiles(dir), role: "contributor", id: String(s.contributor || "?"), today: () => "2026-10-19" }).submit({ kind: s.kind, text: s.text, improves: s.improves });
        const [r] = await check(intake.localStore({ files: intakeFiles(dir), role: "checker", today: () => "2026-10-19" }), c, { sheets: null });
        return { ...r!, id: s.id };
      } catch (err) {
        return { id: s.id, state: "bounced", reason: `it isn't a submission the queue takes: ${(err as Error).message}`, report: { checker: "", gates: [], motion: null, sensors: null, rigs: [], joins: null, sheet: null } };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    })());
  }
  return again.get(key)!;
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

/** What a submitted clip's provenance lacks of what B8 asks: its method, the tool and version that made it, a CC0
 *  claim, who made it, and the local report `m3a library submit` adds (so a recipe sent as it is, which carries none of
 *  the intake's provenance, lacks the last two). */
export function provenanceGaps(clip: Clip): string[] {
  const p = clip.provenance ?? ({} as Clip["provenance"]), i = (p as { intake?: { by?: unknown; report?: unknown } }).intake ?? {}, out: string[] = [];
  if (!(format.METHODS as readonly string[]).includes(p.method)) out.push("its method (provenance.method)");
  if (!p.producer?.tool?.trim() || !p.producer?.version?.trim()) out.push("the tool that made it and its version (provenance.producer)");
  if (p.license !== "CC0-1.0") out.push(`a CC0 claim (provenance.license is ${JSON.stringify(p.license)}, not "CC0-1.0")`);
  if (typeof i.by !== "string" || !i.by.trim()) out.push("who made it (provenance.intake.by, which m3a library submit's --by gives a clip)");
  if (!i.report) out.push("the local report m3a library submit adds to a clip it sends (provenance.intake.report)");
  return out;
}

/** The checks of one submission: its state in the queue and as the checker found it (`v`, null for one that was
 *  bounced before the grader ran), each gate, its provenance, its tag and its play on the workspace's character. */
async function graded(workspace: string, s: intake.Submission, v: Checked | null, c: Checker): Promise<Check[]> {
  const out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const said = v && v.state !== s.state ? `${s.state} in the queue, but ${v.state} when checked again from its text${v.reason ? `: ${v.reason}` : ""}` : `${s.state}${s.reason ? `: ${s.reason}` : ""}`;
  add("it waits for review", s.state === "awaiting review" && v?.state === "awaiting review", `${s.id} (${s.kind}): ${said}`);
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
  const gaps = provenanceGaps(made.clip), tags = Array.isArray(made.clip.tags) ? made.clip.tags : [];
  add("its provenance is complete", gaps.length === 0, gaps.length ? `it lacks ${gaps.join("; ")}` : `${made.clip.provenance.method} by ${made.clip.provenance.producer.tool} ${made.clip.provenance.producer.version}, CC0-1.0, made by ${String((made.clip.provenance as { intake?: { by?: string } }).intake?.by).slice(0, 60)}`);
  add("it is tagged emote", tags.includes("emote"), `tags: ${tags.join(", ") || "none"}`);
  add("it is new, not a fix of a library clip", s.improves === null, s.improves ? `sent with --improves ${s.improves}: an emote of its own takes none` : "sent without --improves");
  out.push(made.rest ? await playsOn(workspace, made.clip, made.rest) : { name: "it plays on the character", ok: false, detail: `restSrc ${JSON.stringify(made.clip.restSrc)} is no library source's rest` });
  return out;
}

/** Grades the workspace's queue (its .cache/intake/): the checker run on it, then the agent's best submission. */
export async function gradeB8(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((x) => x.ok), checks: out, ms: performance.now() - t0 });
  let mine: intake.Submission[];
  try {
    mine = await queue(workspace).list();
  } catch (err) {
    add("a submission reached the queue", false, `the queue (.cache/intake/) can't be read: ${(err as Error).message}`);
    return done();
  }
  add("a submission reached the queue", mine.length > 0, mine.length ? `${mine.length} in .cache/intake/` : "the queue (.cache/intake/) holds none: send the emote with m3a library submit");
  if (!mine.length) return done();
  const c = await checker();
  let ran: Checked[];
  try {
    ran = await check(queue(workspace), c, { sheets: null });
    mine = await queue(workspace).list();
  } catch (err) {
    add("the checker ran on the queue", false, (err as Error).message);
    return done();
  }
  let best: Check[] | null = null;
  for (const s of mine) {
    // this run's verdict; one already awaiting review, checked again from its text; one bounced before, as it is
    const v = ran.find((r) => r.id === s.id) ?? (s.state === "awaiting review" ? await recheck(s, c) : null), checks = await graded(workspace, s, v, c);
    if (!best || checks.filter((x) => x.ok).length > best.filter((x) => x.ok).length) best = checks;
  }
  out.push(...best!);
  return done();
}

/** Runs the checker on the workspace's queue every `every` ms until the returned stop (which waits for a check under
 *  way): the queue a brief's agent reads with `m3a library status`. A check that fails is tried at the next. */
export function checkEvery(workspace: string, every = CHECK_EVERY): () => Promise<void> {
  let last: Promise<unknown> = Promise.resolve(), busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    last = checker().then((c) => check(queue(workspace), c, { sheets: null })).catch(() => undefined).finally(() => (busy = false));
  }, every);
  return async () => {
    clearInterval(timer);
    await last;
  };
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

/** B8's known-good beyond its files: its m3a calls (submit.sh), each exiting 0, or a refusal naming the one that
 *  didn't. */
export function solveB8(workspace: string): void {
  for (const r of runCalls(workspace, "submit.sh")) if (r.code !== 0) throw new Error(`bench: B8's known-good call "${r.line}" exited ${r.code}: ${r.out.trim().split("\n")[0]}`);
}
