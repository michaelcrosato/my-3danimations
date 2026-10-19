// Tests for `npm run conformance` (tools/conformance/): its flags (every tier once, an empty or unknown tier refused,
// the deadline in seconds), a value as the verdict shows it (anything at all, -0 as -0), the checkout it names; and the
// CLI itself, which fails a broken implementation with the vector named, whatever shape its answers take, records in
// report.json what the certification ran against, and ends a sidecar that stops answering at --timeout.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256, VECTORS } from "../../spec/conformance/runner/vectors.ts";
import { PROTOCOL } from "../../spec/conformance/kit/wire.ts";
import { ROOT, UsageError } from "../run/cli.ts";
import { checkout, show, tierList, timeoutOf } from "./report.ts";

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
});

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
