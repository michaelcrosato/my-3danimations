// The adopt bot (PLAN.md §5.9, WP-9.1a): it commits what the owner adopted. It acts only on adoptions recorded by the
// owner's identity (the store's owner, a fixed id: the local store's reviewer, the hosted one's auth.uid(); never a
// name a record carries), one at a time: it rechecks the submission's content hash against the decision's, writes the
// clip through @m3a/library's writer into its set (its tier's intake set, or with `improves` over the clip it improves,
// a new version of it) with its catalog row, facts, quality and provenance (the intake's, with the submission it came
// from) and the owner's approval with its motion hash, opens a pull request against `main`, runs the library's gates on
// it (a pull request opened with a workflow's own token starts no other workflow) and merges it if they pass; if they
// fail it closes it, restores what it wrote, and returns the submission to `awaiting review` with the reason. The pull
// requests are behind `PullRequests`: a dry run prints the one it would open; GitHub's (gh, with the workflow's token)
// is G9's deferred proof and nothing here calls it.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { format, type Clip } from "@m3a/core";
import { withFacts } from "@m3a/library";
import { contentHash, motionHash, type IntakeStore, type Submission } from "../../packages/tools/src/intake/index.ts";
import { restFor } from "../../packages/tools/src/tools/clips.ts";
import { clipOf, INTAKE_SETS, licenseRule, lineage, type IntakeProvenance } from "../../packages/tools/src/tools/library-submit.ts";
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

/** Where the adopt bot's pull requests go: opened (its number and link), merged, or closed with the reason. */
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

/** GitHub's pull requests from the checkout `cwd` through git and the gh CLI, with the workflow's token (GH_TOKEN): the
 *  branch committed and pushed, the pull request opened, then merged (squashed) or closed, its branch deleted. For
 *  intake.yml once O8's store is linked (G9's deferred proof); WP-9.1a never calls it. */
export function github(cwd: string): PullRequests {
  const run = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed: ${(r.stderr || r.stdout).trim().split("\n")[0]}`);
    return r.stdout.trim();
  };
  return {
    kind: "github",
    async open(d) {
      run("git", ["switch", "-c", d.branch]);
      run("git", ["add", "--", ...d.files]);
      run("git", ["-c", "user.name=m3a-adopt", "-c", "user.email=m3a-adopt@users.noreply.github.com", "commit", "-m", d.title]);
      run("git", ["push", "origin", d.branch]);
      const url = run("gh", ["pr", "create", "--base", d.base, "--head", d.branch, "--title", d.title, "--body", d.body]);
      run("git", ["switch", d.base]);
      return { number: Number(/\/pull\/(\d+)/.exec(url)?.[1] ?? 0), url };
    },
    async merge(k) {
      run("gh", ["pr", "merge", String(k), "--squash", "--delete-branch"]);
    },
    async close(k, why) {
      run("gh", ["pr", "close", String(k), "--comment", why, "--delete-branch"]);
    },
  };
}

/** How the adopt bot runs: the store (as the checker, which may return an adoption to review), the owner's fixed
 *  identity there, the checkout it writes into, its pull requests, the clock, the branch it merges into, the gates
 *  (the library's, by default) and the reference rigs they retarget onto, bound once (bound per run otherwise). */
export interface AdoptOptions {
  store: IntakeStore;
  owner: string;
  checkout: string;
  prs: PullRequests;
  today(): string;
  base?: string;
  gates?: (root: string, changed: readonly Changed[]) => Promise<Step[]>;
  rigs?: readonly Rig[];
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

/** The pull request an adoption opens. */
function draft(s: Submission, clip: Clip, w: Written, base: string): Draft {
  const d = s.decision!, gates = (s.report as { gates?: { ok: boolean }[] } | null)?.gates ?? [];
  return {
    branch: `intake/${s.id}`, base, files: w.files,
    title: `Adopt ${clip.id} from the intake queue (${s.id})`,
    body: [
      `Adopts ${s.id} as ${clip.id}: ${s.improves ? `a new version of ${s.improves}` : `a new clip in ${w.set}`}, written through @m3a/library's writer.`,
      `- contributor: ${s.contributor}`,
      `- content hash: ${s.content}`,
      `- adopted by the owner (${d.by}) on ${d.date}, on that hash`,
      `- motion hash: ${clip.review?.motion ?? motionHash(clip)}`,
      `- the checker: ${gates.filter((g) => g.ok).length} of ${gates.length} gates green`,
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
 *  became of each. */
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
    let clip: Clip;
    try {
      clip = adoptedClip(s, o.owner, o.checkout);
    } catch (err) {
      await back("returned", `its clip can't be written: ${(err as Error).message.slice(0, 200)}`);
      continue;
    }
    const w = writeClip(o.checkout, clip), pr = await o.prs.open(draft(s, clip, w, base));
    const failed = (await (o.gates ?? ((r, ch) => runGates(r, ch, o.rigs)))(o.checkout, [{ id: clip.id, added: !s.improves }])).filter((x) => !x.ok);
    if (!failed.length) {
      await o.prs.merge(pr.number);
      out.push({ id: s.id, outcome: "merged", clip: clip.id, pr: pr.number, why: null });
      continue;
    }
    const why = `its pull request #${pr.number} failed the library gates: ${failed.map((f) => `${f.name}: ${f.summary ?? "failed"}`).join("; ").slice(0, 300)}`;
    await o.prs.close(pr.number, why);
    w.restore();
    await back("closed", why, { clip: clip.id, pr: pr.number });
  }
  return out;
}
