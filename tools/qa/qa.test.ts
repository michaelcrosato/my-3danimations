// The QA run (WP-3.3): each clip's row carries its verdict's text and its findings with their times and repairs; the
// distributions have a capture group; `npm run qa -- --dist` prints them, and --json writes the run's report beside
// the clips' rows instead of over them.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../run/cli.ts";
import { CAPTURE, distributions, libraryClips, qa } from "./qa.ts";

const pick = (ids: string[]) => libraryClips().filter((c) => ids.includes(c.clip.id));

describe("the QA rows and distributions", () => {
  it("carry each clip's verdict text and findings with times and repairs", () => {
    const [row] = qa(pick(["QUATERNIUS_3D2DGE/Walk_Loop"]));
    expect(row!.text.split("\n")[0]).toMatch(/^QUATERNIUS_3D2DGE\/Walk_Loop: (PASS|WARN|FAIL)/);
    expect(row!.findings.length).toBeGreaterThan(0);
    for (const f of row!.findings) expect([typeof f.t0, typeof f.t1, f.message]).toEqual(["number", "number", expect.stringMatching(/: .+ \(fix: |: [a-z]/)]);
    expect(Object.values(row!.counts).reduce((a, b) => a + b, 0)).toBe(row!.findings.length);
  });
  it("group real capture's clips as 'capture'", () => {
    const rows = qa(pick(["CMU_CURATED/Walk_Loop", "STYLE100/Neutral_Walk", "QUATERNIUS_3D2DGE/Walk_Loop"]));
    const d = distributions(rows);
    expect(CAPTURE).toEqual(["CMU_CURATED", "STYLE100"]);
    expect([d.all!.slide.n, d.capture!.slide.n, d.STYLE100!.slide.n]).toEqual([3, 2, 1]);
  });
});

describe("npm run qa", () => {
  const run = (...args: string[]) => execFileSync(process.execPath, [join(ROOT, "tools/qa/main.ts"), ...args], { cwd: ROOT, encoding: "utf8" });
  it("prints the distributions with --dist, and --json keeps the clips' rows", () => {
    const out = run("--clip", "CMU_CURATED/Walk_Loop", "--dist", "--json");
    expect(out).toMatch(/^ {2}slide: capture [\d.]+ \/ [\d.]+ \/ [\d.]+ \/ [\d.]+ \/ [\d.]+ \(n 1\); all /m);
    expect(out).toMatch(/^ {2}skate: capture /m);
    const clips = JSON.parse(readFileSync(join(ROOT, "check-output/qa/clips.json"), "utf8"));
    expect(clips.rows.map((r: { clip: string }) => r.clip)).toEqual(["CMU_CURATED/Walk_Loop"]);
    expect(clips.distributions.capture.slide.n).toBe(1);
    expect(JSON.parse(readFileSync(join(ROOT, "check-output/qa/report.json"), "utf8")).tool).toBe("qa");
  });
});
