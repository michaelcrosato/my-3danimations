// The adopt bot (PLAN.md §5.9, WP-9.1a): it commits what the owner adopted. It acts only on adoptions recorded by the
// owner's identity (the store's owner, a fixed id: the local store's reviewer, the hosted one's auth.uid(); never a
// name a record carries), one at a time: it rechecks the submission's content hash against the decision's, writes the
// clip through @m3a/library's writer into its set (its tier's intake set, or with `improves` over the clip it improves,
// a new version of it) with its catalog row, facts, quality and provenance (the intake's, with the submission it came
// from) and the owner's approval with its motion hash, regenerates in that checkout the library's derived files with
// the repository's own commands (the lock, the sensors' baseline, the distributions, docs/LIBRARY.md: WP-9.1, so the
// pull request is whole and the library's checks pass on what it merges), naming in its body each distribution now
// worse than recorded (they may only improve: the owner's adoption is the logged decision), opens a pull request
// against `main`, runs the library's gates on it (a pull request opened with a workflow's own token starts no other
// workflow), on the pull request's own tree, and merges it if they and the regeneration pass; if not it closes it,
// restores what it wrote, and returns the submission to `awaiting review` with the reason. One adoption's failure is
// its own: its pull request closed if it was opened, its files restored, it goes back to review, and the next goes on.
// The pull requests are behind `PullRequests`: a dry run prints the one it would open; GitHub's (git and gh, with the
// workflow's token) leaves the checkout on the pull request's branch until it is merged or closed, then on the base
// as the remote has it, so each adoption is made on the main the one before merged into; intake.yml uses it once O8
// is linked (G9's deferred proof), and its test runs it against a local remote with a stand-in gh.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format, type Clip } from "@m3a/core";
import { withFacts } from "@m3a/library";
import { contentHash, motionHash, type IntakeStore, type Submission } from "../../packages/tools/src/intake/index.ts";
import { restFor } from "../../packages/tools/src/tools/clips.ts";
import { clipOf, INTAKE_SETS, licenseRule, lineage, type IntakeProvenance } from "../../packages/tools/src/tools/library-submit.ts";
import { againstRecord, readRecord } from "../qa/library.ts";
import { libraryClips } from "../qa/qa.ts";
import { qualityOf, readReasons } from "../qa/verdict.ts";
import type { Step } from "../run/cli.ts";
import type { Rig } from "./check.ts";
import { runGates, type Changed } from "./gates.ts";
import { libraryAt } from "./host.ts";
import { writeClip, type Written } from "./write.ts";

/** A pull request to open: its branch, the branch it merges into, its title and body, and the files it commits. */
export interface Draft {
  branch: string;
  base: string;
  title: string;
  body: string;
  files: string[];
}

/** Where the adopt bot's pull requests go: opened (its number and link), merged, or closed with the reason. Between
 *  `open` and `merge` or `close` the checkout holds the pull request's tree, which the gates read. */
export interface PullRequests {
  readonly kind: "dry-run" | "github";
  open(d: Draft): Promise<{ number: number; url: string }>;
  merge(n: number): Promise<void>;
  close(n: number, why: string): Promise<void>;
}

/** A dry run's pull requests: each printed as it would be opened, merged or closed, numbered from 1; nothing leaves the
 *  machine. */
export function dryRun(print: (text: string) => void): PullRequests {
  let n = 0;
  return {
    kind: "dry-run",
    async open(d) {
      n++;
      print([`would open pull request #${n} against ${d.base} from ${d.branch}: ${d.title}`, ...d.body.split("\n").map((l) => `  ${l}`), `  files: ${d.files.join(", ")}`].join("\n"));
      return { number: n, url: `dry-run:#${n}` };
    },
    async merge(k) {
      print(`would merge #${k}: the library gates pass`);
    },
    async close(k, why) {
      print(`would close #${k}: ${why}`);
    },
  };
}

/** GitHub's pull requests from the checkout `cwd` through git and the gh CLI, with the workflow's token (GH_TOKEN, and
 *  git's credentials from `gh auth setup-git`), in the environment `env`: the branch made from the base as it is,
 *  committed and pushed (its own branch, so a run cut short is pushed again), the pull request opened, the checkout
 *  left on that branch for the gates; then merged (squashed) or closed, its branch deleted, and the checkout back on
 *  the base as the remote has it (the merge in it). For intake.yml once O8's store is linked (G9's deferred proof). */
export function github(cwd: string, env: NodeJS.ProcessEnv = process.env): PullRequests {
  let base: string | null = null;
  const run = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env });
    if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed: ${(r.stderr || r.stdout || r.error?.message || "").trim().split("\n")[0]}`);
    return r.stdout.trim();
  };
  // the base as the remote has it: what the next pull request is made on
  const back = () => {
    if (!base) return;
    run("git", ["switch", "--force", base]);
    run("git", ["fetch", "origin", base]);
    run("git", ["reset", "--hard", `origin/${base}`]);
    run("git", ["clean", "-fd", "--", "library"]);
  };
  return {
    kind: "github",
    async open(d) {
      base = d.base;
      try {
        run("git", ["switch", "-C", d.branch]);
        run("git", ["add", "--", ...d.files]);
        run("git", ["-c", "user.name=m3a-adopt", "-c", "user.email=m3a-adopt@users.noreply.github.com", "commit", "-m", d.title]);
        run("git", ["push", "--force", "origin", d.branch]);
        const url = run("gh", ["pr", "create", "--base", d.base, "--head", d.branch, "--title", d.title, "--body", d.body]);
        return { number: Number(/\/pull\/(\d+)/.exec(url)?.[1] ?? 0), url };
      } catch (err) {
        back(); // no pull request: the checkout back on the base, nothing of it kept
        throw err;
      }
    },
    async merge(k) {
      try {
        run("gh", ["pr", "merge", String(k), "--squash", "--delete-branch"]);
      } finally {
        back();
      }
    },
    async close(k, why) {
      try {
        run("gh", ["pr", "close", String(k), "--comment", why, "--delete-branch"]);
      } finally {
        back();
      }
    },
  };
}

/** The library's derived files an adoption changes, relative to the checkout, and the repository's commands that
 *  regenerate them, by npm script (`npm run library -- lock`; `npm run qa -- library --baseline`: the sensors'
 *  baseline, the distributions and docs/LIBRARY.md; `npm run index`: the registry index, a changed set's new
 *  version, WP-9.4). */
export const DERIVED = {
  files: ["library/sets.lock.json", "packages/sensors/fixtures/baseline.json", "library/baselines/distributions.json", "docs/LIBRARY.md", "library/index.json"],
  commands: [["library", "tools/library/main.ts", "lock"], ["qa", "tools/qa/main.ts", "library", "--baseline"], ["index", "tools/release/main.ts"]],
} as const;

/** What regenerating the derived files did: one step a command, the files it changed, each distribution now worse
 *  than was recorded, and `restore`, which puts each file back as it was. */
export interface Regenerated {
  steps: Step[];
  files: string[];
  worse: string[];
  restore(): void;
}

/** Regenerates the derived files in the whole checkout at `root` with the repository's own commands (DERIVED), and
 *  names each distribution worse than library/baselines/distributions.json recorded before. */
export async function regenerate(root: string): Promise<Regenerated> {
  const at = (f: string) => join(root, f), was = new Map(DERIVED.files.map((f) => [f, existsSync(at(f)) ? readFileSync(at(f), "utf8") : null]));
  const record = readRecord(at("library/baselines/distributions.json")), steps: Step[] = [];
  for (const [npm, script, ...args] of DERIVED.commands) {
    const t = performance.now(), r = existsSync(at(script)) ? spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }) : null;
    const said = (r?.stdout ?? "").split("\n").find((l) => / (PASS|FAIL)\b/.test(l)) ?? "";
    steps.push({ name: `npm run ${npm}${args.length ? ` -- ${args.join(" ")}` : ""}`, ok: r?.status === 0, ms: performance.now() - t, summary: r ? (r.status === 0 ? said : `${said || (r.stderr || "").trim().split("\n")[0]}`.slice(0, 200)) : `${root} is no whole checkout (no ${script}): the derived files are regenerated with the repository's commands` });
  }
  const now = readRecord(at("library/baselines/distributions.json")), worse = record && now ? againstRecord(record, now).worse : [];
  return {
    steps, worse, files: DERIVED.files.filter((f) => (existsSync(at(f)) ? readFileSync(at(f), "utf8") : null) !== was.get(f)),
    restore() {
      for (const [f, t] of was) if (t === null) rmSync(at(f), { force: true });
      else writeFileSync(at(f), t);
    },
  };
}

/** How the adopt bot runs: the store (as the checker, which may return an adoption to review), the owner's fixed
 *  identity there, the checkout it writes into, its pull requests, the clock, the branch it merges into, the gates
 *  (the library's, by default) and the reference rigs they retarget onto, bound once (bound per run otherwise), and
 *  how the derived files are regenerated (`regenerate`, the repository's commands, by default). */
export interface AdoptOptions {
  store: IntakeStore;
  owner: string;
  checkout: string;
  prs: PullRequests;
  today(): string;
  base?: string;
  gates?: (root: string, changed: readonly Changed[]) => Promise<Step[]>;
  rigs?: readonly Rig[];
  regenerate?: (root: string) => Promise<Regenerated>;
}

/** What became of one adoption: merged; closed (its gates failed: back to review); refused (not the owner's); returned
 *  (it changed since, or its clip can't be written); with the clip, the pull request and the reason. */
export interface Adopted {
  id: string;
  outcome: "merged" | "closed" | "refused" | "returned";
  clip: string | null;
  pr: number | null;
  why: string | null;
}

/** The clip an adoption writes: its set and id (over the clip it improves, as long as that clip is the version it was
 *  made on; else new in its tier's intake set, its name given a part of the submission's id if the set has one), its
 *  facts, quality and the intake's provenance, and the owner's approval with its motion hash. */
export function adoptedClip(s: Submission, owner: string, checkout: string): Clip {
  const lib = libraryAt(join(checkout, "library/sets")), c = clipOf(s.kind, s.text, lib.library), d = s.decision!;
  let id: string;
  if (s.improves) {
    // a new version of the clip it improves, made on that clip as it is now (an improvement of an older version would
    // undo what changed since)
    const got = lib.library.clip(s.improves), [set, name] = got.clip.id.split("/") as [string, string], now = contentHash(lib.source.read(set, `${name}.json`));
    const made = ((c.provenance as { intake?: IntakeProvenance }).intake?.improves?.sha256 ?? "").slice(0, 64);
    if (made !== now) throw new Error(`${got.clip.id} changed since this improvement was made (made on ${made.slice(0, 12) || "no version"}, it is ${now.slice(0, 12)} now): it is made again from the current clip`);
    id = got.clip.id;
  } else {
    const rule = licenseRule(c, lineage(c, lib.library, null).derived);
    if (!rule.tier) throw new Error(rule.problem ?? "its license fits no intake set");
    const set = INTAKE_SETS[rule.tier], name = format.slug(c.id.split("/")[1] ?? c.name), taken = lib.source.sets().includes(set) && lib.source.files(set).includes(`${name}.json`);
    id = `${set}/${taken ? `${name}_${s.id.slice(2, 8)}` : name}`;
  }
  const rest = restFor(lib, c)?.rest;
  if (!rest) throw new Error(`no set has the rest ${c.restSrc} it decodes on`);
  const { report: _, ...was } = ((c.provenance as { intake?: IntakeProvenance }).intake ?? {}) as Partial<IntakeProvenance>;
  const intake: IntakeProvenance = { ...was, by: was.by ?? `${s.contributor}, by recipe`, submission: `${s.id}@${s.content}` };
  let out = withFacts({ ...c, id, provenance: { ...c.provenance, intake } as Clip["provenance"] }, rest);
  delete out.review;
  out = { ...out, quality: qualityOf(out, rest, readReasons(join(checkout, "library/baselines/qa.json"))) };
  return { ...out, review: { state: "approved", by: owner, date: d.date, motion: motionHash(out), note: `adopted from ${s.id}@${s.content.slice(0, 12)}${d.note.trim() ? `: ${d.note.replace(/\s+/g, " ").trim()}` : ""}` } };
}

/** The pull request an adoption opens: the clip's files and the derived ones regenerated (`g`), each distribution worse
 *  than recorded named. */
export function draft(s: Submission, clip: Clip, w: Pick<Written, "set" | "files">, base: string, g: Pick<Regenerated, "files" | "worse">): Draft {
  const d = s.decision!, gates = (s.report as { gates?: { ok: boolean }[] } | null)?.gates ?? [];
  return {
    branch: `intake/${s.id}`, base, files: [...new Set([...w.files, ...g.files])].sort(),
    title: `Adopt ${clip.id} from the intake queue (${s.id})`,
    body: [
      `Adopts ${s.id} as ${clip.id}: ${s.improves ? `a new version of ${s.improves}` : `a new clip in ${w.set}`}, written through @m3a/library's writer.`,
      `- contributor: ${s.contributor}`,
      `- content hash: ${s.content}`,
      `- adopted by the owner (${d.by}) on ${d.date}, on that hash`,
      `- motion hash: ${clip.review?.motion ?? motionHash(clip)}`,
      `- the checker: ${gates.filter((x) => x.ok).length} of ${gates.length} gates green`,
      `- regenerated with the repository's commands (${DERIVED.commands.map(([npm, , ...a]) => `npm run ${npm}${a.length ? ` -- ${a.join(" ")}` : ""}`).join("; ")}): ${g.files.length ? g.files.join(", ") : "nothing changed"}`,
      g.worse.length ? `- worse than recorded, recorded with this adoption (the distributions may only improve: the owner's adoption is the logged decision): ${g.worse.join("; ")}` : "- the distributions: none worse than recorded",
      "The owner's adoption is the approval (O7); this pull request merges when the library gates pass on it.",
    ].join("\n"),
  };
}

/** The submissions the checkout's library holds already: each adopted clip names the one it came from, with its
 *  content hash (`provenance.intake.submission`), so the library, not the queue, records what was committed. */
export function committed(checkout: string): Set<string> {
  return new Set(libraryClips(join(checkout, "library/sets")).map((c) => (c.clip.provenance as { intake?: { submission?: string } }).intake?.submission).filter((x): x is string => typeof x === "string"));
}

/** Commits every adoption the store holds that the checkout's library doesn't yet, one at a time, by id; returns what
 *  became of each. One that fails on the way (a writer's, a regeneration's or a pull request's error) is returned to
 *  review with what failed, its pull request closed if one was opened and its files restored, and the next goes on. */
export async function adopt(o: AdoptOptions): Promise<Adopted[]> {
  const out: Adopted[] = [], base = o.base ?? "main", done = committed(o.checkout);
  for (const s of (await o.store.list({ state: "adopted" })).filter((x) => !done.has(`${x.id}@${x.content}`))) {
    const back = async (outcome: Adopted["outcome"], why: string, more: Partial<Adopted> = {}) => {
      await o.store.advance(s.id, "awaiting review", { reason: why });
      out.push({ id: s.id, outcome, clip: null, pr: null, why, ...more });
    };
    const d = s.decision;
    if (!d || d.as !== "adopt" || d.by !== o.owner) {
      await back("refused", `its adoption was recorded by ${d ? JSON.stringify(d.by.slice(0, 40)) : "no one"}, not by the owner's identity: the adopt bot commits only the owner's adoptions, so it waits for the owner's review again`);
      continue;
    }
    const now = contentHash(s.text);
    if (now !== s.content || d.hash !== s.content) {
      await back("returned", `it changed since the owner adopted it (adopted on ${d.hash.slice(0, 12)}, it is ${now.slice(0, 12)} now): review it again`);
      continue;
    }
    let clip: Clip, w: Written, was: string | undefined;
    try {
      clip = adoptedClip(s, o.owner, o.checkout);
      // the file it replaces, if any: the gates hold an improvement to the version it was made on
      const file = join(o.checkout, "library/sets", `${clip.id}.json`);
      was = existsSync(file) ? readFileSync(file, "utf8") : undefined;
      w = writeClip(o.checkout, clip);
    } catch (err) {
      await back("returned", `its clip can't be written: ${(err as Error).message.slice(0, 200)}`);
      continue;
    }
    let g: Regenerated | null = null, pr: { number: number; url: string } | null = null;
    try {
      g = await (o.regenerate ?? regenerate)(o.checkout);
      pr = await o.prs.open(draft(s, clip, w, base, g));
      const changed: Changed = { id: clip.id, added: was === undefined, ...(was === undefined ? {} : { was }) };
      const failed = [...g.steps, ...(await (o.gates ?? ((r, ch) => runGates(r, ch, o.rigs, { by: "bot" })))(o.checkout, [changed]))].filter((x) => !x.ok);
      if (!failed.length) {
        await o.prs.merge(pr.number);
        out.push({ id: s.id, outcome: "merged", clip: clip.id, pr: pr.number, why: null });
        continue;
      }
      const why = `its pull request #${pr.number} failed the library gates: ${failed.map((f) => `${f.name}: ${f.summary ?? "failed"}`).join("; ").slice(0, 300)}`;
      await o.prs.close(pr.number, why);
      g.restore();
      w.restore();
      await back("closed", why, { clip: clip.id, pr: pr.number });
    } catch (err) {
      const why = `the adopt bot failed on it${pr ? ` (pull request #${pr.number}, closed)` : ""}: ${(err as Error).message.slice(0, 200)}`;
      if (pr) await o.prs.close(pr.number, why).catch(() => {});
      g?.restore();
      w.restore();
      await back("returned", why, { clip: clip.id, pr: pr?.number ?? null });
    }
  }
  return out;
}
