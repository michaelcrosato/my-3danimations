// The publish workflow (WP-F.10; O2 answered 2026-10-22, D130): publish.yml, read as YAML as release.test.ts reads
// release.yml, runs only by hand and holds no key that lets a check be skipped or ignored; every job's first step is its
// go-ahead, which, run on a stub environment, fails closed unless M3A_O2_PUBLISH is "yes", the repository's owner
// started the run and the attempt, the tag reads vX.Y.Z and the run was started from it (npm's provenance names the
// run's ref and commit); the build job runs the repository's code with no token, the checkout keeping no credentials,
// npm ci running no install scripts and no step restoring a cache; the publish job checks nothing out, takes the build
// job's tarballs through an artifact, deploys to the environment npm, holds the OIDC token, and gives the npm token to
// its publish step alone, no other expression reaching a secret; its actions are pinned by the SHAs the other workflows
// use; it publishes every pack tools/bundle/build.ts makes, in the order their dependencies need (derived here from
// build.ts's packages, the library's opt-in packs and the manifests they are published with); its tag step, run in a
// scratch repository, refuses a tag off main, at another version or at another commit than the run's; its tarball step,
// run on tarballs made here, refuses a pack at another version, kept private, naming another repository, out of order,
// missing or extra; its publish step, run on a stub npm, publishes each pack in order, skips a version already on the
// registry and says so (so a re-run after a partial failure finishes the rest), stops at a failure, and stops at a
// registry that answers neither the version nor E404, naming an expired or under-scoped token.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PACKS as OPT_IN } from "../../packages/library/src/node.ts";
import { PACKAGES, publishable, publishedManifest, REPOSITORY } from "../bundle/build.ts";
import { ROOT } from "../run/cli.ts";
import { parseYaml } from "./yaml.ts";

/** A workflow as read: its triggers, permissions and jobs, each job's steps. */
interface Step { name?: string; uses?: string; run?: string; with?: Record<string, string>; env?: Record<string, string> }
interface Job { name: string; needs?: string | string[]; "runs-on": string; environment?: string; permissions?: Record<string, string>; env?: Record<string, string>; steps: Step[] }
interface Workflow { on: { workflow_dispatch?: { inputs: Record<string, Record<string, string>> } }; permissions?: Record<string, string>; concurrency?: Record<string, string>; jobs: Record<string, Job> }
const text = (name: string) => readFileSync(join(ROOT, ".github/workflows", name), "utf8");
const wf = parseYaml(text("publish.yml")) as unknown as Workflow, go = wf.jobs["go-ahead"]!, build = wf.jobs.build!, job = wf.jobs.publish!;
const steps = Object.values(wf.jobs).flatMap((j) => j.steps);
const named = (j: Job, name: string) => j.steps.find((s) => s.name === name) ?? expect.fail(`publish.yml has no step "${name}" there`);
const GO_STEP = "O2 answered by the owner, or nothing runs", TAG_STEP = "The tag is on main, at its version, and is the commit this run names";
const CHECK_STEP = "Each tarball at the tag's version, publishable, after the @m3a packages it needs", PUBLISH_STEP = "Publish each pack in order, skipping a version already on the registry";
/** A step as the order tests name it: its action without the pin, else its name, else its command. */
const said = (s: Step) => s.uses?.replace(/@.*/, "") ?? s.name ?? s.run;

/** The version every pack is at, and the tag that releases it. */
const VERSION = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version, TAG = `v${VERSION}`;
/** The packs build() makes, by the short name its tarball carries (`m3a-<it>-<version>.tgz`). */
const optIn = Object.values(OPT_IN).map((n) => n.replace("@m3a/", ""));
/** Each pack's package.json as `npm run pack -- --publishable` stages it: the packages' through build.ts's own
 *  publishedManifest and publishable; an opt-in pack's needs the library at this version (build.ts's stageOptIn). */
const manifests: Record<string, Record<string, unknown>> = Object.fromEntries([
  ...PACKAGES.map((p) => [p, publishable(publishedManifest(JSON.parse(readFileSync(join(ROOT, "packages", p, "package.json"), "utf8")) as Record<string, unknown>), `packages/${p}`)]),
  ...optIn.map((p) => [p, publishable({ name: `@m3a/${p}`, version: VERSION, peerDependencies: { "@m3a/library": VERSION } }, "library")]),
]);
/** The @m3a packages a pack names, as dependencies or peers. */
const needs = (pkg: Record<string, unknown>) => Object.keys({ ...(pkg.dependencies as object), ...(pkg.peerDependencies as object) }).filter((d) => d.startsWith("@m3a/"));
/** The order publish.yml must publish in: build.ts's packages in PACKAGES' order ("in dependency order"), the
 *  library's opt-in packs right after the library. */
const ORDER = PACKAGES.flatMap((p) => (p === "library" ? [p, ...optIn] : [p]));

const scratches: string[] = [];
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});
function scratch(what: string): string {
  const d = mkdtempSync(join(tmpdir(), `m3a-publish-${what}-`));
  scratches.push(d);
  return d;
}
/** A step's `run` as GitHub runs it (bash -e -o pipefail), in `cwd` with `env` beside PATH. */
const sh = (run: string, cwd: string, env: Record<string, string>) => spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", run], { cwd, env: { PATH: process.env.PATH!, ...env }, encoding: "utf8" });

describe("publish.yml", () => {
  it("runs only by hand on a tag it is given, reads by default, and holds no key that lets a check be skipped or ignored", () => {
    expect(Object.keys(wf)).toEqual(["name", "on", "permissions", "concurrency", "jobs"]);
    expect(Object.keys(wf.on)).toEqual(["workflow_dispatch"]);
    expect(Object.keys(wf.on.workflow_dispatch!)).toEqual(["inputs"]);
    expect(Object.keys(wf.on.workflow_dispatch!.inputs)).toEqual(["tag"]);
    expect(wf.on.workflow_dispatch!.inputs.tag!.required).toBe("true");
    expect(wf.permissions).toEqual({ contents: "read" });
    expect(wf.concurrency).toEqual({ group: "publish", "cancel-in-progress": "false" });
    // no if, continue-on-error, shell, defaults, strategy or container: each job runs its steps in order and stops at
    // the first that fails, as GitHub's bash -e does
    expect(Object.fromEntries(Object.entries(wf.jobs).map(([k, j]) => [k, Object.keys(j)]))).toEqual({
      "go-ahead": ["name", "runs-on", "timeout-minutes", "steps"],
      build: ["name", "needs", "runs-on", "timeout-minutes", "permissions", "env", "steps"],
      publish: ["name", "needs", "runs-on", "timeout-minutes", "environment", "permissions", "env", "steps"],
    });
    expect([build.needs, job.needs]).toEqual(["go-ahead", "build"]);
    for (const j of Object.values(wf.jobs)) expect(j["runs-on"]).toBe("ubuntu-latest");
    for (const s of steps) expect(Object.keys(s).filter((k) => !["name", "uses", "with", "run", "env"].includes(k)), said(s)).toEqual([]);
  });

  it("checks the go-ahead first in every job, so a re-run of one job alone checks it again before anything else", () => {
    expect(go.steps.map(said)).toEqual([GO_STEP]);
    for (const [k, j] of Object.entries(wf.jobs)) expect(j.steps[0], k).toEqual(go.steps[0]);
  });

  it("gives the OIDC token to the publish job alone and the npm token, the environment npm's, to its publish step alone", () => {
    expect([go.permissions, build.permissions, job.permissions]).toEqual([undefined, { contents: "read" }, { contents: "read", "id-token": "write" }]);
    expect(JSON.stringify(wf).match(/id-token/g)).toHaveLength(1);
    expect(Object.entries(wf.jobs).filter(([, j]) => "environment" in j).map(([k, j]) => [k, j.environment])).toEqual([["publish", "npm"]]);
    // every expression in the workflow is one of these: none reads another secret, the secrets whole or the GitHub token
    const exprs = [...JSON.stringify(wf).matchAll(/\$\{\{(.*?)\}\}/g)].map((m) => m[1]!.trim());
    expect([...new Set(exprs)].sort()).toEqual(["github.actor", "github.ref", "github.repository_owner", "github.triggering_actor", "inputs.tag", "secrets.NPM_TOKEN", "vars.M3A_O2_PUBLISH"]);
    const tokened = steps.filter((s) => /\bsecrets\b|github\.token/.test(JSON.stringify(s)));
    expect(tokened.map((s) => [s.name, s.env])).toEqual([[PUBLISH_STEP, { NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}" }]]);
    expect(job.steps.at(-1)).toBe(named(job, PUBLISH_STEP));
    for (const j of Object.values(wf.jobs)) expect(JSON.stringify(j.env ?? {})).not.toMatch(/\bsecrets\b|github\.token/);
    expect([build.env, job.env]).toEqual([{ TAG: "${{ inputs.tag }}" }, { TAG: "${{ inputs.tag }}", PACKS: expect.any(String) }]);
    for (const s of steps) expect(s.run ?? "", "inputs reach the shell only through env").not.toMatch(/\$\{\{/);
  });

  it("builds from the tag with no token: the checkout in the build job alone, keeping no credentials, no install scripts, no cache", () => {
    expect(build.steps.map(said)).toEqual([GO_STEP, "actions/checkout", "actions/setup-node", TAG_STEP, "npm ci --ignore-scripts", "npm run pack -- --check --publishable", "actions/upload-artifact"]);
    expect(Object.entries(wf.jobs).flatMap(([k, j]) => j.steps.filter((s) => s.uses?.startsWith("actions/checkout@")).map((s) => [k, s.with]))).toEqual([["build", { ref: "refs/tags/${{ inputs.tag }}", "fetch-depth": "0", "persist-credentials": "false" }]]);
    expect(steps.filter((s) => /\bnpm (ci|install|i)\b/.test(s.run ?? "")).map((s) => s.run)).toEqual(["npm ci --ignore-scripts"]);
    expect(steps.filter((s) => s.uses?.startsWith("actions/cache") || s.with?.cache !== undefined || (s.uses?.startsWith("actions/setup-node@") && s.with?.["package-manager-cache"] !== "false"))).toEqual([]);
    expect(build.steps.at(-1)!.with).toEqual({ name: "packs", path: ".cache/pack/*.tgz", "if-no-files-found": "error", "retention-days": "7" });
  });

  it("publishes from a job that checks nothing out and runs no code but its own and npm's: the build job's tarballs, checked, then published", () => {
    expect(job.steps.map(said)).toEqual([GO_STEP, "actions/download-artifact", "actions/setup-node", CHECK_STEP, PUBLISH_STEP]);
    expect(job.steps[1]!.with).toEqual({ name: "packs", path: ".cache/pack" });
    const runs = job.steps.map((s) => s.run ?? "").join("\n");
    expect(runs).not.toMatch(/\bnpx\b|\bnpm (?:run|exec|x|install|i|ci|test|start|pack)\b/);
    expect([...runs.matchAll(/\bnode\b(?!:)[^\n]*/g)].map((m) => m[0])).toEqual(["node --input-type=commonjs - <<'EOF'"]);
    const publishes = steps.filter((s) => /\bnpm publish\b/.test(s.run ?? ""));
    expect(publishes.map((s) => [s.name, s.run!.match(/^.*\bnpm publish --.*$/gm)!.map((l) => l.trim())])).toEqual([[PUBLISH_STEP, ['if ! npm publish --provenance --access public "./.cache/pack/m3a-$p-$v.tgz"; then']]]);
  });

  it("pins its actions by commit SHA, the comment naming the release, as the other workflows pin them, and sets up Node 24.21.0", () => {
    const pins = (t: string) => {
      const out: Record<string, [string, string | undefined]> = {};
      for (const [, a, sha, release] of t.matchAll(/^\s*-?\s*uses: ([^@\s]+)@(\S+)(?: # (\S+))?$/gm)) {
        expect(out[a!] ?? [sha, release], `${a} pinned one way`).toEqual([sha, release]);
        out[a!] = [sha!, release];
      }
      return out;
    };
    const ours = pins(text("publish.yml")), theirs = { ...pins(text("ci.yml")), ...pins(text("release.yml")) };
    expect(Object.keys(ours).sort()).toEqual(["actions/checkout", "actions/download-artifact", "actions/setup-node", "actions/upload-artifact"]);
    for (const [a, [sha, release]] of Object.entries(ours)) expect([a, sha, release], "pinned by commit SHA").toEqual([a, expect.stringMatching(/^[0-9a-f]{40}$/), expect.stringMatching(/^v\d+\.\d+\.\d+$/)]);
    for (const a of Object.keys(ours).filter((a) => theirs[a])) expect(ours[a], `${a} as ci.yml and release.yml pin it`).toEqual(theirs[a]);
    expect(Object.keys(ours).filter((a) => !theirs[a])).toEqual(["actions/download-artifact"]); // no other workflow downloads one
    expect(steps.filter((s) => s.uses?.startsWith("actions/setup-node@")).map((s) => s.with)).toEqual([
      { "node-version": "24.21.0", "package-manager-cache": "false" },
      { "node-version": "24.21.0", "registry-url": "https://registry.npmjs.org", "package-manager-cache": "false" },
    ]);
  });

  it("publishes every pack build.ts makes, each after every @m3a package it needs: the order derived from the code", () => {
    expect(ORDER).toEqual(["core", "sensors", "io", "library", "library-cc-by", "library-cmu", "three", "tools"]); // as the README says it
    expect(Object.keys(manifests).sort()).toEqual([...ORDER].sort());
    for (const [i, p] of ORDER.entries()) for (const d of needs(manifests[p]!)) expect(ORDER.slice(0, i), `${p} needs ${d}`).toContain(d.replace("@m3a/", ""));
    expect(job.env!.PACKS!.split(" ")).toEqual(ORDER);
  });
});

describe("publish.yml's go-ahead", () => {
  const step = go.steps[0]!;
  const run = (env: Record<string, string>) => sh(step.run!, tmpdir(), env);
  const owner = { ACTOR: "o", TRIGGER: "o", OWNER: "o", TAG, REF: `refs/tags/${TAG}` };
  it("fails closed: nothing runs unless the owner set M3A_O2_PUBLISH to yes and started both the run and this attempt", () => {
    expect(step.env).toEqual({ O2: "${{ vars.M3A_O2_PUBLISH }}", ACTOR: "${{ github.actor }}", TRIGGER: "${{ github.triggering_actor }}", OWNER: "${{ github.repository_owner }}", TAG: "${{ inputs.tag }}", REF: "${{ github.ref }}" });
    expect(run(owner)).toMatchObject({ status: 1, stdout: expect.stringMatching(/^::error title=publish::Publishing is unanswered here \(the repository variable M3A_O2_PUBLISH isn't "yes"\)/) });
    for (const O2 of ["true", "Yes", "yes "]) expect(run({ ...owner, O2 }).status, O2).toBe(1);
    expect(run({ ...owner, O2: "yes", ACTOR: "someone", TRIGGER: "someone" })).toMatchObject({ status: 1, stdout: expect.stringMatching(/Only the repository's owner \(o\) starts a publish or re-runs one, not someone/) });
    expect(run({ ...owner, O2: "yes", TRIGGER: "someone" })).toMatchObject({ status: 1, stdout: expect.stringMatching(/\(this attempt: someone\)/) }); // a re-run by someone else
    expect(run({ O2: "yes", ACTOR: "o", OWNER: "o", TAG, REF: owner.REF }).status).toBe(1);
    expect(run({ O2: "yes", ACTOR: "", TRIGGER: "", OWNER: "", TAG, REF: owner.REF }).status).toBe(1);
    expect(run({ ...owner, O2: "yes" })).toMatchObject({ status: 0, stdout: "" });
  });
  it("takes a release tag alone: vX.Y.Z", () => {
    for (const tag of ["v0.56.0", "v1.0.0", "v10.20.30"]) expect(run({ ...owner, O2: "yes", TAG: tag, REF: `refs/tags/${tag}` }).status, tag).toBe(0);
    for (const tag of ["", "0.56.0", "v0.56", "v0.56.0-rc.1", "v01.2.3", "main", "v0.56.0\nv0.57.0", "v0.56.0 ", "refs/tags/v0.56.0"]) {
      expect(run({ ...owner, O2: "yes", TAG: tag, REF: `refs/tags/${tag}` }), JSON.stringify(tag)).toMatchObject({ status: 1, stdout: expect.stringMatching(/^::error title=publish::The tag ".*" isn't vX\.Y\.Z/s) });
    }
  });
  it("runs only from the tag it is given, since npm's provenance names the run's ref and commit", () => {
    for (const REF of ["refs/heads/main", "refs/tags/v0.0.1", `refs/heads/${TAG}`, `refs/tags/${TAG}x`, ""]) {
      expect(run({ ...owner, O2: "yes", REF }), REF).toMatchObject({ status: 1, stdout: expect.stringMatching(new RegExp(`^::error title=publish::This run was started from ${REF.replace(/\./g, "\\.")}, not from the tag ${TAG.replace(/\./g, "\\.")}.*Use workflow from: Tags → `)) });
    }
  });
});

describe("publish.yml's tag step", () => {
  it("holds the tag to main, to the version its packages are at, and to the commit the run was started on", () => {
    const repo = scratch("git"), git = (...a: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...a], { cwd: repo, encoding: "utf8" });
    const sha = (ref: string) => git("rev-parse", ref).stdout.trim();
    const commit = (version: string, msg: string) => {
      writeFileSync(join(repo, "package.json"), `${JSON.stringify({ name: "x", version })}\n`);
      git("add", "-A");
      git("commit", "-qm", msg);
    };
    git("init", "-q", "-b", "main");
    commit(VERSION, "the release");
    git("tag", "-a", "-m", "the release", TAG);
    git("update-ref", "refs/remotes/origin/main", "main");
    const run = (tag: string, at = `${tag}^{commit}`) => {
      git("checkout", "-q", "--detach", tag);
      return sh(named(build, TAG_STEP).run!, repo, { TAG: tag, GITHUB_SHA: sha(at) });
    };
    expect(run(TAG)).toMatchObject({ status: 0, stdout: "" });
    expect(run(TAG, TAG), "GITHUB_SHA as the annotated tag's own object").toMatchObject({ status: 0, stdout: "" });
    git("checkout", "-q", "-b", "side", TAG);
    commit("9.9.9", "off main");
    git("tag", "v9.9.9");
    expect(run("v9.9.9")).toMatchObject({ status: 1, stdout: expect.stringMatching(/^::error title=publish::v9\.9\.9 isn't on main/) });
    git("checkout", "-q", "main");
    commit("9.9.8", "the next version");
    git("update-ref", "refs/remotes/origin/main", "main");
    git("tag", "v9.9.7");
    expect(run("v9.9.7")).toMatchObject({ status: 1, stdout: expect.stringMatching(/^::error title=publish::v9\.9\.7's packages are at 9\.9\.8, not 9\.9\.7/) });
    // the tag moved after the run started (or the run names another commit): the provenance would name the wrong one
    expect(run(TAG, "main")).toMatchObject({ status: 1, stdout: expect.stringMatching(new RegExp(`^::error title=publish::${TAG.replace(/\./g, "\\.")} is at ${sha(`${TAG}^{commit}`)}, not at ${sha("main")}, the commit this run was started on`)) });
    expect(sh(named(build, TAG_STEP).run!, repo, { TAG, GITHUB_SHA: "" }), "no GITHUB_SHA").toMatchObject({ status: 1, stdout: expect.stringMatching(/ is at [0-9a-f]{40}, not at , the commit this run was started on/) });
  });
});

describe("publish.yml's tarball step", () => {
  const step = named(job, CHECK_STEP), REPO = REPOSITORY.replace(/^git\+https:\/\/github\.com\/|\.git$/g, "");
  /** `.cache/pack/` as the artifact gives it, in a scratch directory: a tarball per pack, its package/package.json the
   *  manifest given. */
  const packed = (edit: (m: Record<string, Record<string, unknown>>) => void = () => {}) => {
    const dir = scratch("pack"), m = structuredClone(manifests);
    edit(m);
    for (const [p, pkg] of Object.entries(m)) {
      const stage = join(dir, "stage", p, "package");
      mkdirSync(stage, { recursive: true });
      writeFileSync(join(stage, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
      mkdirSync(join(dir, ".cache/pack"), { recursive: true });
      expect(spawnSync("tar", ["-czf", join(dir, ".cache/pack", `m3a-${p}-${VERSION}.tgz`), "-C", join(dir, "stage", p), "package"]).status).toBe(0);
    }
    return dir;
  };
  const run = (dir: string, packs = ORDER.join(" ")) => sh(step.run!, dir, { TAG, PACKS: packs, GITHUB_REPOSITORY: REPO });
  it("passes the packs as npm run pack -- --publishable stages them", () => {
    expect(run(packed())).toMatchObject({ status: 0, stdout: `${ORDER.length} tarballs at ${VERSION}, each publishable, each after the @m3a packages it needs: ${ORDER.join(", ")}\n` });
  });
  it("refuses a pack at another version, kept private, naming another repository, needing another version, out of order, missing or extra", () => {
    const refused = (dir: string, why: RegExp, packs?: string) => expect(run(dir, packs)).toMatchObject({ status: 1, stdout: expect.stringMatching(why) });
    refused(packed((m) => (m.tools!.version = "0.0.1")), new RegExp(`::error title=publish::@m3a/tools is at 0\\.0\\.1, not ${VERSION.replace(/\./g, "\\.")}`));
    refused(packed((m) => (m.three!.name = "@m3a/four")), /m3a-three-[\d.]+\.tgz holds @m3a\/four, not @m3a\/three/);
    refused(packed((m) => (m.three!.private = true)), /@m3a\/three isn't publishable/);
    refused(packed((m) => delete (m["library-cmu"]!.publishConfig as Record<string, unknown>).provenance), /@m3a\/library-cmu isn't publishable/);
    refused(packed((m) => (m.io!.repository = { type: "git", url: "git+https://github.com/someone/fork.git" })), /@m3a\/io names the repository git\+https:\/\/github\.com\/someone\/fork\.git, and provenance is checked against this one/);
    refused(packed((m) => ((m.sensors!.dependencies as Record<string, string>)["@m3a/core"] = "0.0.1")), new RegExp(`@m3a/sensors needs @m3a/core@0\\.0\\.1, not ${VERSION.replace(/\./g, "\\.")}`));
    refused(packed(), /@m3a\/tools needs @m3a\/three, which PACKS doesn't publish before it/, ORDER.filter((p) => p !== "three").concat("three").join(" "));
    refused(packed(), /@m3a\/library-cc-by needs @m3a\/library, which PACKS doesn't publish before it/, ["library-cc-by", ...ORDER.filter((p) => p !== "library-cc-by")].join(" "));
    refused(packed(), /m3a-library-cmu-[\d.]+\.tgz is packed but isn't one of PACKS/, ORDER.filter((p) => p !== "library-cmu").join(" "));
    for (const f of [`m3a-extra-${VERSION}.tgz`, "m3a.js"]) {
      const extra = packed();
      writeFileSync(join(extra, ".cache/pack", f), "");
      refused(extra, new RegExp(`${f.replace(/\./g, "\\.")} is packed but isn't one of PACKS`));
    }
    const missing = packed();
    rmSync(join(missing, ".cache/pack", `m3a-core-${VERSION}.tgz`));
    refused(missing, /m3a-core-[\d.]+\.tgz isn't packed/);
  });
});

describe("publish.yml's publish step", () => {
  const step = named(job, PUBLISH_STEP), dir = scratch("npm"), bin = join(dir, "bin"), registry = join(dir, "registry"), log = join(dir, "log");
  mkdirSync(bin);
  // a stub npm on PATH: it logs each call with the token it was given; `view NAME@V version` prints V when the
  // registry file holds NAME@V, fails with NPM_DOWN_CODE (else ETIMEDOUT) when NPM_DOWN names the spec, and says E404
  // else, as npm 11 does for a package or a version the registry lacks; `publish ... TARBALL` fails when NPM_FAILS
  // names the tarball, else adds its NAME@V to the registry file
  writeFileSync(join(bin, "npm"), [
    "#!/bin/sh",
    'echo "$* token=$NODE_AUTH_TOKEN" >> "$NPM_LOG"',
    'case "$1" in',
    'view) if [ "$2" = "$NPM_DOWN" ]; then echo "npm error code ${NPM_DOWN_CODE:-ETIMEDOUT}" >&2; exit 1; fi',
    '  if grep -qxF "$2" "$NPM_REGISTRY"; then echo "${2##*@}"; else echo "npm error code E404" >&2; exit 1; fi ;;',
    'publish) for a; do t="$a"; done; b="${t##*/}"; b="${b%.tgz}"; b="${b#m3a-}"',
    '  if [ "${t##*/}" = "$NPM_FAILS" ]; then echo "npm error code E500" >&2; exit 1; fi',
    '  echo "@m3a/${b%-*}@${b##*-}" >> "$NPM_REGISTRY" ;;',
    "esac",
    "",
  ].join("\n"), { mode: 0o755 });
  const spec = (p: string) => `@m3a/${p}@${VERSION}`, tarball = (p: string) => `m3a-${p}-${VERSION}.tgz`;
  /** The step run with the registry holding `on`; returns its status, what it said, npm's calls and the registry after. */
  const run = (on: string[], env: Record<string, string> = {}) => {
    rmSync(log, { force: true });
    writeFileSync(registry, on.map((p) => `${spec(p)}\n`).join(""));
    const r = sh(step.run!, dir, { TAG, PACKS: ORDER.join(" "), NODE_AUTH_TOKEN: "npm_token", NPM_REGISTRY: registry, NPM_LOG: log, PATH: `${bin}:${process.env.PATH!}`, ...env });
    const calls = (() => {
      try {
        return readFileSync(log, "utf8").trim().split("\n");
      } catch {
        return [];
      }
    })();
    return { status: r.status, said: r.stdout, err: r.stdout + r.stderr, calls, on: readFileSync(registry, "utf8").trim().split("\n").filter(Boolean) };
  };
  /** What a failure says of the token: the codes npm gives one it refuses, and why (D130's owner's steps). */
  const STALE = "E401 or E403 from npm, or E404 from npm publish: NPM_TOKEN has expired \\(a write token lasts 90 days at most\\) or isn't read and write on @m3a; EOTP: it doesn't bypass two-factor authentication; E_STAGE_REQUIRED: it is Read and write \\(stage only\\), not \\(publish and stage\\)\\. The owner renews it";
  const viewed = (p: string) => `view ${spec(p)} version token=npm_token`, published = (p: string) => `publish --provenance --access public ./.cache/pack/${tarball(p)} token=npm_token`;
  it("publishes every pack in order, the token given to npm", () => {
    const r = run([]);
    expect(r.calls).toEqual(ORDER.flatMap((p) => [viewed(p), published(p)]));
    expect(r.on).toEqual(ORDER.map(spec));
    expect([r.status, r.said.trimEnd().split("\n").at(-1)]).toEqual([0, `${TAG}: ${ORDER.length} published, 0 on the registry already`]);
  });
  it("stops at a failure, leaving the packs after it; the re-run skips what is on the registry, says so, and publishes the rest", () => {
    const failed = run([], { NPM_FAILS: tarball("library") }), at = ORDER.indexOf("library");
    expect([failed.status, failed.said, failed.calls.at(-1), failed.on]).toEqual([1, expect.stringMatching(new RegExp(`::error title=publish::npm publish ${spec("library").replace(/\./g, "\\.")} failed: it and the packs after it are left \\(a re-run skips the ones published\\)\\. ${STALE}`)), published("library"), ORDER.slice(0, at).map(spec)]);
    const again = run(ORDER.slice(0, at));
    expect(again.calls).toEqual([...ORDER.slice(0, at).map(viewed), ...ORDER.slice(at).flatMap((p) => [viewed(p), published(p)])]);
    for (const p of ORDER.slice(0, at)) expect(again.said).toContain(`${spec(p)} is on the registry already: skipped (a published version can't be replaced)\n`);
    expect([again.status, again.on, again.said.trimEnd().split("\n").at(-1)]).toEqual([0, ORDER.map(spec), `${TAG}: ${ORDER.length - at} published, ${at} on the registry already`]);
    const done = run(ORDER);
    expect([done.status, done.calls, done.said.trimEnd().split("\n").at(-1)]).toEqual([0, ORDER.map(viewed), `${TAG}: 0 published, ${ORDER.length} on the registry already`]);
  });
  it("publishes nothing more when the registry answers neither the version nor E404, naming a token gone stale, and nothing at all without the token", () => {
    const at = ORDER.indexOf("io");
    for (const code of ["ETIMEDOUT", "E401", "E403"]) {
      const down = run([], { NPM_DOWN: spec("io"), NPM_DOWN_CODE: code });
      expect([down.status, down.said, down.err, down.calls.at(-1), down.on], code).toEqual([1, expect.stringMatching(new RegExp(`::error title=publish::npm view @m3a/io@${VERSION.replace(/\./g, "\\.")} failed, so whether it is published isn't known: it and the packs after it are left\\. ${STALE}`)), expect.stringContaining(`npm error code ${code}`), viewed("io"), ORDER.slice(0, at).map(spec)]);
    }
    const none = run([], { NODE_AUTH_TOKEN: "" });
    expect([none.status, none.said, none.calls]).toEqual([1, expect.stringMatching(/^::error title=publish::The environment npm's secret NPM_TOKEN is unset: nothing is published/), []]);
  });
});
