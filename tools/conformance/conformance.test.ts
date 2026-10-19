// Tests for `npm run conformance` (tools/conformance/): its flags (every tier once, an empty or unknown tier refused,
// the deadline in seconds), a value as the verdict shows it (anything at all, -0 as -0), the checkout it names (dirty
// when a file the run executed differs: the kit's, and with --impl ts the reference's, every import inside); and the
// CLI itself, which fails a broken implementation with the vector named, whatever shape its answers take, records in
// report.json what the certification ran against, and ends a sidecar that stops answering at --timeout.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256, VECTORS } from "../../spec/conformance/runner/vectors.ts";
import { PROTOCOL } from "../../spec/conformance/kit/wire.ts";
import { ROOT, UsageError } from "../run/cli.ts";
import { checkout, KIT_FILES, REFERENCE_FILES, show, tierList, timeoutOf } from "./report.ts";

const version = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version;

describe("the conformance CLI's parts", () => {
  it("--tier: every tier by default, each named once in the order given; an empty or unknown name is a usage error", () => {
    expect(tierList(undefined)).toEqual(["1a", "1b", "2", "3"]);
    expect(tierList("3,1a,1a")).toEqual(["3", "1a"]);
    expect(() => tierList("")).toThrow(UsageError);
    expect(() => tierList("")).toThrow('--tier "" has an empty tier name; the tiers are 1a, 1b, 2, 3');
    expect(() => tierList("1a,")).toThrow(/empty tier name/);
    expect(() => tierList("4")).toThrow('there is no tier "4"');
    expect(() => tierList("constructor")).toThrow('there is no tier "constructor"');
  });
  it("--timeout: 60 s by default, else seconds above 0 and at most a day", () => {
    expect([timeoutOf(undefined), timeoutOf("0.5"), timeoutOf("600")]).toEqual([60, 0.5, 600]);
    for (const bad of ["0", "-1", "", "soon", "1e9"]) expect(() => timeoutOf(bad), bad).toThrow(UsageError);
  });
  it("shows any value: nothing for none, -0 as the wire writes it, a string as it is, at most 100 characters", () => {
    expect([show(undefined), show(null), show(-0), show([0, -0]), show({ a: 1 }), show("text"), show(() => 1)]).toEqual(["nothing", "null", "-0", "[0,-0]", '{"a":1}', "text", "() => 1"]);
    expect(show("x".repeat(200))).toHaveLength(100);
    expect(show(1n)).toBe("1");
  });
  it("names the checkout a certification comes from: the version and the commit", () => {
    expect(checkout(ROOT)).toEqual({ version, commit: expect.stringMatching(/^([0-9a-f]{40}(-dirty)?|unknown)$/) });
  });
  it("reads -dirty when what the run executed differs from the commit: the kit's files, and the reference's for --impl ts", () => {
    const repo = mkdtempSync(join(tmpdir(), "m3a-conformance-")), git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a], { cwd: repo, encoding: "utf8" });
    const put = (file: string, text: string) => (mkdirSync(join(repo, dirname(file)), { recursive: true }), writeFileSync(join(repo, file), text));
    const commits = () => [checkout(repo).commit, checkout(repo, { reference: true }).commit].map((c) => c.replace(/^[0-9a-f]{40}/, "HEAD"));
    try {
      for (const f of ["package.json", "packages/core/src/index.ts", "tools/vectors/rig.ts", "docs/notes.md"]) put(f, f === "package.json" ? '{"version":"1.2.3"}' : "// 1\n");
      git("init", "-q");
      git("add", "-A");
      git("commit", "-qm", "clean");
      expect([checkout(repo).version, ...commits()]).toEqual(["1.2.3", "HEAD", "HEAD"]);
      put("docs/notes.md", "// 2\n");
      expect(commits(), "a file no run executes").toEqual(["HEAD", "HEAD"]);
      put("packages/core/src/index.ts", "// 2\n");
      expect(commits(), "the reference changed: dirty for --impl ts alone").toEqual(["HEAD", "HEAD-dirty"]);
      put("packages/io/src/new.ts", "// new\n");
      git("checkout", "--", "packages/core");
      expect(commits(), "a file the reference gained").toEqual(["HEAD", "HEAD-dirty"]);
      rmSync(join(repo, "packages/io"), { recursive: true });
      put("tools/vectors/rig.ts", "// 2\n");
      expect(commits(), "the rig tier 3 builds its skeletons from: dirty for every implementation").toEqual(["HEAD-dirty", "HEAD-dirty"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
  it("its dirty check covers every file the kit imports, and with --impl ts every file the reference's sidecar imports", () => {
    const covered = (files: readonly string[]) => (f: string) => files.some((p) => f === p || f.startsWith(`${p}/`));
    expect(imports("tools/conformance/main.ts").filter((f) => !covered(KIT_FILES)(f))).toEqual([]);
    expect(imports("spec/conformance/adapters/ts.ts").filter((f) => !covered([...KIT_FILES, ...REFERENCE_FILES])(f))).toEqual([]);
    expect(imports("spec/conformance/adapters/ts.ts")).toEqual(expect.arrayContaining(["packages/core/src/index.ts", "packages/io/src/index.ts"]));
  });
});

/** The repository's files `entry` runs (repository-relative), following its value imports: relative ones and the
 *  workspace's @m3a packages through their package.json exports; `import type` runs nothing, and the rest are
 *  node_modules', which package-lock.json pins. */
function imports(entry: string): string[] {
  const seen = new Set<string>(), todo = [join(ROOT, entry)];
  for (let file = todo.pop(); file; file = todo.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, type, spec] of readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      if (type) continue;
      if (spec!.startsWith(".")) todo.push(join(dirname(file), spec!));
      else if (spec!.startsWith("@m3a/")) {
        const [, pkg, ...sub] = spec!.split("/"), dir = join(ROOT, "packages", pkg!);
        const exports = (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports: Record<string, string> }).exports;
        todo.push(join(dir, exports[sub.length ? `./${sub.join("/")}` : "."]!));
      }
    }
  }
  return [...seen].map((f) => relative(ROOT, f)).sort();
}

describe("npm run conformance", () => {
  // a bound of its own, so a kit that hangs fails the test rather than the run
  const run = (...args: string[]) => spawnSync(process.execPath, [join(ROOT, "tools/conformance/main.ts"), ...args], { cwd: ROOT, encoding: "utf8", timeout: 25_000 });
  it("fails answers of the wrong shape with the vector named, and report.json names the protocol, the vectors and the commit", () => {
    const r = run("--impl", "node spec/conformance/adapters/broken.ts echo", "--tier", "1a,3", "--sample", "1", "--json");
    expect([r.status, r.stderr]).toEqual([1, ""]);
    expect(r.stdout.split("\n")[0]).toMatch(/^conformance: @m3a\/core [\d.]+ fails tier 1a at tier1a\/rig\.json, A_TPose reduce: reduce: ours \{"capture":.*, want a value that must be array \(protocol\.schema\.json \$defs\/results\/reduce\)$/);
    expect(r.stdout).toMatch(/^ {5}tier3\/bodies\.json: rig: 4 of 4 fail; first CMU\/Walk_Loop: retarget: ours \{"skeleton":/m);
    const { certification } = JSON.parse(readFileSync(join(ROOT, "check-output/conformance/report.json"), "utf8")) as { certification: { kit: unknown; tiers: unknown[] } };
    expect(certification.kit).toEqual({ protocol: PROTOCOL, manifestSha256: sha256(readFileSync(join(VECTORS, "manifest.json"))), version, commit: expect.stringMatching(/^([0-9a-f]{40}(-dirty)?|unknown)$/) });
    expect(certification.tiers).toHaveLength(2);
  }, 30_000);
  it("ends a sidecar that stops answering at --timeout, naming the op it waited on", () => {
    const r = run("--impl", "node spec/conformance/adapters/broken.ts hang", "--tier", "1a", "--timeout", "0.5");
    expect(r.status).toBe(1);
    expect(r.stdout.split("\n")[0]).toMatch(/the sidecar broke off: no answer to (hello|reduce) within 0\.5 s/);
  }, 30_000);
  it("refuses an empty --tier as a usage error, before it starts a sidecar", () => {
    const r = run("--impl", "ts", "--tier", "");
    expect([r.status, r.stdout.split("\n")[0]]).toEqual([2, 'conformance: usage error: --tier "" has an empty tier name; the tiers are 1a, 1b, 2, 3']);
  }, 30_000);
});
